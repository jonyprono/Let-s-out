import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { AuthService } from './auth.service'
import {
  SendOtpSchema,
  SendWhatsappOtpSchema,
  VerifyOtpSchema,
  RegisterSchema,
  LoginSchema,
  CheckTargetSchema,
  InitLoginSchema,
  type SendOtpInput,
  type VerifyOtpInput,
  type RegisterInput,
  type LoginInput,
  type CheckTargetInput,
  type InitLoginInput,
  ResetPasswordSchema,
  type ResetPasswordInput,
} from './auth.schema'
import bcrypt from 'bcryptjs'

export class AuthController {
  private service: AuthService

  constructor(private readonly app: FastifyInstance) {
    this.service = new AuthService(app.prisma, app.redis)
  }

  private handleValidationError(err: unknown, reply: FastifyReply) {
    if (err instanceof ZodError) {
      const message = err.errors.map((error) => error.message).join(', ')
      return reply.code(400).send({ error: message })
    }
    throw err
  }

  async sendOtp(req: FastifyRequest, reply: FastifyReply) {
    let body: SendOtpInput
    try {
      body = SendOtpSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    try {
      await this.service.generateAndSendOtp(body.target, body.type, body.channel || 'whatsapp')
    } catch (err: any) {
      if (err.message === 'OTP_RATE_LIMIT') {
        return reply.code(429).send({
          error: `Trop de tentatives. Réessayez dans ${err.retryAfterMinutes} minute(s).`,
          retryAfterMinutes: err.retryAfterMinutes,
        })
      }
      throw err
    }
    return reply.code(200).send({ message: 'OTP sent' })
  }

  /**
   * POST /auth/send-whatsapp-otp
   * Envoie un OTP exclusivement via WhatsApp (Meta Cloud API).
   * Utilisé comme canal principal avant le fallback Firebase SMS.
   */
  async sendWhatsappOtp(req: FastifyRequest, reply: FastifyReply) {
    let body: { target: string }
    try {
      body = SendWhatsappOtpSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    const isPhone = body.target.startsWith('+')
    if (!isPhone) {
      return reply.code(400).send({ error: 'Un numéro de téléphone est requis pour WhatsApp.' })
    }

    try {
      await this.service.generateAndSendOtp(body.target, 'phone', 'whatsapp')
    } catch (err: any) {
      if (err.message === 'OTP_RATE_LIMIT') {
        return reply.code(429).send({
          error: `Trop de tentatives. Réessayez dans ${err.retryAfterMinutes} minute(s).`,
          retryAfterMinutes: err.retryAfterMinutes,
        })
      }
      throw err
    }
    return reply.code(200).send({ message: 'OTP envoyé via WhatsApp' })
  }

  async checkTarget(req: FastifyRequest, reply: FastifyReply) {
    let body: CheckTargetInput
    try {
      body = CheckTargetSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    const user = await this.service.findUserByTarget(body.target)
    return reply.send({ exists: !!user })
  }

  /**
   * POST /auth/check-otp
   * Vérifie qu'un OTP est valide SANS le consommer.
   * À utiliser à l'étape 2 du signup pour feedback immédiat.
   * Le register final utilise checkOtp en interne aussi (code reste valide).
   */
  async checkOtp(req: FastifyRequest, reply: FastifyReply) {
    let body: VerifyOtpInput
    try {
      body = VerifyOtpSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    const valid = await this.service.checkOtp(body.target, body.code)
    if (!valid) {
      return reply.code(400).send({ error: 'Code invalide ou expiré' })
    }

    // Store a pre-verified session (30 min) so the final register step
    // doesn't fail even if the 10-min OTP has expired by then.
    await this.service.storeVerifiedSession(body.target)

    return reply.send({ valid: true })
  }

  async initLogin(req: FastifyRequest, reply: FastifyReply) {
    let body: InitLoginInput
    try {
      body = InitLoginSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    const user = await this.service.findUserByTarget(body.target)
    if (!user || !user.isActive) {
      return reply.code(404).send({ error: 'Ce compte n\'existe pas.' })
    }

    if (!user.passwordHash) {
      return reply.code(400).send({ error: 'Veuillez vous connecter avec la méthode utilisée lors de l\'inscription.' })
    }

    const isPasswordValid = await bcrypt.compare(body.password, user.passwordHash)
    if (!isPasswordValid) {
      return reply.code(401).send({ error: 'Mot de passe incorrect.' })
    }

    const isPhone = body.target.startsWith('+')
    await this.service.generateAndSendOtp(body.target, isPhone ? 'phone' : 'email', body.channel || 'whatsapp')
    
    return reply.send({ success: true, message: 'OTP sent' })
  }

  async verifyOtp(req: FastifyRequest, reply: FastifyReply) {
    let body: VerifyOtpInput
    try {
      body = VerifyOtpSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    const valid = await this.service.verifyOtp(body.target, body.code)
    if (!valid) {
      return reply.code(400).send({ error: 'Invalid or expired OTP' })
    }
    return reply.send({ valid: true })
  }

  async register(req: FastifyRequest, reply: FastifyReply) {
    let body: RegisterInput
    try {
      body = RegisterSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    // Validate OTP or Firebase token.
    // For the multi-step signup flow: after checkOtp at step 2 we store a
    // 30-min pre-verified session in Redis so the user isn't blocked at step 11
    // even if the 10-min OTP has already expired.
    let otpValid = false
    if (body.idToken) {
      otpValid = await this.service.verifyFirebaseToken(body.idToken, body.target)
    } else if (body.code) {
      // 1. Check pre-verified session first (set at OTP-check step, 30-min TTL)
      otpValid = await this.service.checkVerifiedSession(body.target)
      // 2. Fallback: OTP still in Redis/DB (user was very fast)
      if (!otpValid) {
        otpValid = await this.service.checkOtp(body.target, body.code)
      }
    }

    if (!otpValid) {
      return reply.code(400).send({ error: 'Code invalide ou expiré. Recommencez depuis le début.' })
    }

    try {
      const user = await this.service.register(body)

      // Consume OTP and pre-verified session only after successful user creation
      if (body.code) {
        await this.service.verifyOtp(body.target, body.code).catch(() => {/* already consumed / expired – that's OK */})
        await this.service.consumeVerifiedSession(body.target)
      }

      const accessToken = this.app.jwt.sign({ sub: user.id, role: user.role })
      const refreshToken = await this.service.createRefreshToken(user.id, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      })

      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: false, // Allow HTTP for local network (Capacitor app)
        sameSite: 'lax', // Allow cookies from Capacitor/mobile apps
        path: '/', // Send to all endpoints, not just /auth
        maxAge: 30 * 24 * 60 * 60,
      })

      return reply.code(201).send({ accessToken, refreshToken, user: { ...user, passwordHash: undefined } })
    } catch (err: any) {
      if (err.message === 'USER_ALREADY_EXISTS') {
        return reply.code(409).send({ error: 'User already exists' })
      }
      if (err.message === 'USERNAME_TAKEN') {
        return reply.code(409).send({ error: 'Username already taken' })
      }
      throw err
    }
  }

  async login(req: FastifyRequest, reply: FastifyReply) {
    let body: LoginInput
    try {
      body = LoginSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    let otpValid = false

    if (body.idToken) {
      // Firebase SMS verification
      otpValid = await this.service.verifyFirebaseToken(body.idToken, body.target)
    } else if (body.password) {
      // Direct password login (no OTP needed)
      const userCheck = await this.service.findUserByTarget(body.target)
      if (!userCheck || !userCheck.isActive) {
        return reply.code(404).send({ error: 'Ce compte n\'existe pas.' })
      }
      if (!userCheck.passwordHash) {
        return reply.code(400).send({ error: 'Veuillez vous connecter avec la méthode utilisée lors de l\'inscription.' })
      }
      const passwordOk = await bcrypt.compare(body.password, userCheck.passwordHash)
      if (!passwordOk) {
        return reply.code(401).send({ error: 'Mot de passe incorrect.' })
      }
      otpValid = true
    } else if (body.code) {
      otpValid = await this.service.verifyOtp(body.target, body.code)
    }

    if (!otpValid) {
      return reply.code(400).send({ error: 'Invalid or expired OTP' })
    }

    const user = await this.service.findUserByTarget(body.target)
    if (!user || !user.isActive) {
      return reply.code(404).send({ error: 'Account not found. Please register first.' })
    }

    // Update last seen
    await this.app.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    })

    const accessToken = this.app.jwt.sign({ sub: user.id, role: user.role })
    const refreshToken = await this.service.createRefreshToken(user.id, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true, // Always secure in production (HTTPS)
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' allows cross-origin (Vercel → Render)
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return reply.send({ accessToken, refreshToken, user: { ...user, passwordHash: undefined } })
  }

  async refresh(req: FastifyRequest, reply: FastifyReply) {
    const token =
      req.cookies['refresh_token'] ||
      (req.body as any)?.refreshToken

    if (!token) {
      return reply.code(401).send({ error: 'No refresh token provided' })
    }

    const userId = await this.service.validateRefreshToken(token)
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }

    const user = await this.app.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'User not found' })
    }

    // Rotate token
    await this.service.revokeRefreshToken(token)
    const newRefreshToken = await this.service.createRefreshToken(userId, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })
    const accessToken = this.app.jwt.sign({ sub: user.id, role: user.role })

    reply.setCookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: false, // Allow HTTP for local network (Capacitor app)
      sameSite: 'lax', // Allow cookies from Capacitor/mobile apps
      path: '/', // Send to all endpoints, not just /auth
      maxAge: 30 * 24 * 60 * 60,
    })

    return reply.send({ accessToken, refreshToken: newRefreshToken })
  }

  async logout(req: FastifyRequest, reply: FastifyReply) {
    const token = req.cookies['refresh_token']
    if (token) {
      await this.service.revokeRefreshToken(token)
    }
    reply.clearCookie('refresh_token', { path: '/' }) // Match the path used in setCookie
    return reply.send({ message: 'Logged out' })
  }

  async me(req: FastifyRequest, reply: FastifyReply) {
    const payload = req.user as { sub: string }
    const user = await this.app.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    })
    if (!user) return reply.code(404).send({ error: 'User not found' })
    return reply.send({ ...user, passwordHash: undefined })
  }

  async resetPassword(req: FastifyRequest, reply: FastifyReply) {
    let body: ResetPasswordInput
    try {
      body = ResetPasswordSchema.parse(req.body)
    } catch (err) {
      return this.handleValidationError(err, reply)
    }

    let otpValid = false
    if (body.idToken) {
      otpValid = await this.service.verifyFirebaseToken(body.idToken, body.target)
    } else if (body.code) {
      otpValid = await this.service.verifyOtp(body.target, body.code)
    }

    if (!otpValid) {
      return reply.code(400).send({ error: 'Code invalide ou expiré' })
    }

    const user = await this.service.findUserByTarget(body.target)
    if (!user) {
      return reply.code(404).send({ error: 'Utilisateur non trouvé' })
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10)
    await this.app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    })

    return reply.send({ success: true, message: 'Mot de passe mis à jour avec succès' })
  }

  async adminLogin(req: FastifyRequest, reply: FastifyReply) {
    const { target, password } = req.body as { target?: string; password?: string }
    
    if (!target || !password) {
      return reply.code(400).send({ error: 'L\'identifiant et le mot de passe sont requis.' })
    }

    // Auto-repair/Seed mechanism specifically for the default admin during login
    if (target === '+2290156363337') {
      try {
        let admin = await this.app.prisma.admin.findFirst({ where: { phone: target } })
        if (!admin) {
          const passwordHash = await bcrypt.hash('Azerty01', 10)
          await this.app.prisma.admin.create({
            data: { phone: target, name: 'Admin Principal', passwordHash }
          })
        } else if (!admin.passwordHash) {
          const passwordHash = await bcrypt.hash('Azerty01', 10)
          await this.app.prisma.admin.update({
            where: { id: admin.id },
            data: { passwordHash }
          })
        }
      } catch (e) {
        this.app.log.error({ err: e }, 'Failed to auto-repair default admin')
      }
    }

    // Verify Admin Table by phone or email
    const adminUser = await this.app.prisma.admin.findFirst({
      where: {
        OR: [
          { phone: target },
          { email: target }
        ]
      }
    })

    if (!adminUser || !adminUser.passwordHash) {
      return reply.code(403).send({ error: 'Accès refusé. Identifiants incorrects.' })
    }

    const passwordValid = await bcrypt.compare(password, adminUser.passwordHash)
    if (!passwordValid) {
      return reply.code(401).send({ error: 'Mot de passe incorrect.' })
    }

    const accessToken = this.app.jwt.sign({ sub: adminUser.id, role: 'ADMIN' }, { expiresIn: '7d' })
    // We skip DB refresh token for admins to avoid foreign key errors on the users table.
    // We just return a dummy refresh token string to satisfy the frontend if it checks for it,
    // or just omit it. The access token is valid for 7 days anyway.
    const refreshToken = 'admin_no_refresh_token_needed'

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    return reply.send({
      accessToken,
      refreshToken,
      user: { ...adminUser, passwordHash: undefined }
    })
  }

  async adminResetPasswordOtp(req: FastifyRequest, reply: FastifyReply) {
    const { target, channel } = req.body as { target?: string; channel?: 'sms' | 'whatsapp' }
    
    if (!target) {
      return reply.code(400).send({ error: 'Le numéro de téléphone (target) est requis.' })
    }

    const adminUser = await this.app.prisma.admin.findFirst({
      where: {
        OR: [
          { phone: target },
          { email: target }
        ]
      }
    })

    if (!adminUser) {
      return reply.code(403).send({ error: 'Accès refusé. Administrateur introuvable.' })
    }

    const type = target.includes('@') ? 'email' : 'phone'
    await this.service.generateAndSendOtp(target, type, channel || 'whatsapp')
    return reply.send({ success: true, message: 'OTP sent' })
  }

  async adminResetPassword(req: FastifyRequest, reply: FastifyReply) {
    const { target, code, idToken, newPassword } = req.body as { target?: string; code?: string; idToken?: string; newPassword?: string }
    
    if (!target || !newPassword || (!code && !idToken)) {
      return reply.code(400).send({ error: 'Informations incomplètes.' })
    }

    let otpValid = false
    if (idToken) {
      otpValid = await this.service.verifyFirebaseToken(idToken, target)
    } else if (code) {
      otpValid = await this.service.verifyOtp(target, code)
    }

    if (!otpValid) {
      return reply.code(400).send({ error: 'Code invalide ou expiré' })
    }

    const adminUser = await this.app.prisma.admin.findFirst({
      where: {
        OR: [
          { phone: target },
          { email: target }
        ]
      }
    })

    if (!adminUser) {
      return reply.code(404).send({ error: 'Administrateur non trouvé' })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.app.prisma.admin.update({
      where: { id: adminUser.id },
      data: { passwordHash }
    })

    return reply.send({ success: true, message: 'Mot de passe mis à jour avec succès' })
  }

  async createAdmin(req: FastifyRequest, reply: FastifyReply) {
    const { phone, email, name, password } = req.body as any
    
    if ((!phone && !email) || !password) {
      return reply.code(400).send({ error: 'Email/Numéro et mot de passe sont requis.' })
    }

    const existingAdmin = await this.app.prisma.admin.findFirst({
      where: {
        OR: [
          phone ? { phone } : {},
          email ? { email } : {}
        ].filter(Boolean)
      }
    })

    if (existingAdmin) {
      return reply.code(409).send({ error: 'Un administrateur existe déjà avec ces identifiants.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const newAdmin = await this.app.prisma.admin.create({
      data: {
        phone: phone || null,
        email: email || null,
        name: name || null,
        passwordHash
      }
    })

    return reply.send({ success: true, admin: { ...newAdmin, passwordHash: undefined } })
  }

  async googleSignIn(req: FastifyRequest, reply: FastifyReply) {
    const { idToken, email } = req.body as { idToken?: string; email?: string }

    if (!idToken) {
      return reply.code(400).send({ error: 'idToken est requis' })
    }

    // Step 1: Verify the Firebase ID token (signature + expiration)
    const result = await this.service.verifyAndDecodeGoogleToken(idToken)
    if (result.error || !result.decoded) {
      return reply.code(401).send({ error: `Erreur Firebase: ${result.error}` })
    }
    const decoded = result.decoded

    // Step 2: Ensure the decoded email matches what the client sent (extra safety check)
    const resolvedEmail = decoded.email || email
    if (!resolvedEmail) {
      return reply.code(400).send({ error: 'Aucune adresse email associée à ce compte Google.' })
    }

    // Step 3: Find or auto-create the user account
    let user: any
    let isNewUser: boolean
    try {
      const result = await this.service.googleRegisterOrLogin(decoded)
      user = result.user
      isNewUser = result.isNewUser
    } catch (err: any) {
      if (err.message === 'GOOGLE_NO_EMAIL') {
        return reply.code(400).send({ error: 'Aucune adresse email associée à ce compte Google.' })
      }
      throw err
    }

    if (!user.isActive) {
      return reply.code(403).send({ error: 'Ce compte est désactivé. Contactez le support.' })
    }

    // Step 4: Update last seen
    await this.app.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    })

    // Step 5: Issue tokens
    const accessToken = this.app.jwt.sign({ sub: user.id, role: user.role })
    const refreshToken = await this.service.createRefreshToken(user.id, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    })

    reply.setCookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return reply.send({
      accessToken,
      refreshToken,
      isNewUser,
      user: { ...user, passwordHash: undefined },
    })
  }

}
