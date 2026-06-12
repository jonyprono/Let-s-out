import type { PrismaClient } from '@prisma/client'
import type Redis from 'ioredis'
import { randomInt } from 'crypto'
import { addMinutes, isAfter } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'
import type { RegisterInput } from './auth.schema'
import * as admin from 'firebase-admin'

// Per-target OTP send limit: 5 per 10 minutes
const OTP_SEND_LIMIT = 5
const OTP_SEND_WINDOW_SECONDS = 10 * 60

// Initialize Firebase Admin only if ALL required credentials are present
const hasFirebaseCreds = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
)

if (!admin.apps.length && hasFirebaseCreds) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    })
    console.log('[Firebase Admin] Initialized ✓')
  } catch (error) {
    console.error('[Firebase Admin] Initialization error:', error)
  }
} else if (!hasFirebaseCreds) {
  console.warn('[Firebase Admin] Not initialized — FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY manquants (mode dev: idToken non supporté)')
}

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const REFRESH_TOKEN_TTL_DAYS = 30
const PRE_VERIFIED_TTL_SECONDS = 30 * 60 // 30 minutes for multi-step signup flow

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
  ) {}

  // ── OTP ────────────────────────────────────────────────────────────────────

  async generateAndSendOtp(target: string, type: 'phone' | 'email', channel: 'sms' | 'whatsapp' = 'whatsapp'): Promise<void> {
    // Per-target rate limiting: max 5 OTP requests per 10 minutes
    const rateLimitKey = `otp_rate:${target}`
    const current = await this.redis.incr(rateLimitKey)
    if (current === 1) {
      // First request — set TTL for the window
      await this.redis.expire(rateLimitKey, OTP_SEND_WINDOW_SECONDS)
    }
    if (current > OTP_SEND_LIMIT) {
      const ttl = await this.redis.ttl(rateLimitKey)
      const minutes = Math.ceil(ttl / 60)
      throw Object.assign(new Error('OTP_RATE_LIMIT'), { retryAfterMinutes: minutes })
    }

    // Look for an existing valid OTP
    const existingOtp = await this.prisma.otpCode.findFirst({
      where: { target, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    })

    let code: string;
    if (existingOtp) {
      code = existingOtp.code;
      // Re-cache in Redis to be safe
      await this.redis.setex(`otp:${target}`, OTP_TTL_MINUTES * 60, code)
    } else {
      code = randomInt(100000, 999999).toString()
      const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES)
      await this.prisma.otpCode.create({
        data: { target, code, expiresAt },
      })
      await this.redis.setex(`otp:${target}`, OTP_TTL_MINUTES * 60, code)
    }

    if (type === 'phone') {
      if (channel === 'whatsapp') {
        await this.sendWhatsappOtp(target, code)
      } else {
        await this.sendSmsOtp(target, code)
      }
    } else {
      await this.sendEmailOtp(target, code)
    }
  }

  /**
   * Check OTP validity WITHOUT consuming it (no Redis del, no used=true).
   * Use this during multi-step flows where the OTP is verified at the end.
   */
  async checkOtp(target: string, code: string): Promise<boolean> {
    // Fast path: Redis (still present = not yet consumed)
    const cached = await this.redis.get(`otp:${target}`)
    if (cached === code) return true

    // Fallback: DB
    const otp = await this.prisma.otpCode.findFirst({
      where: { target, code, used: false },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) return false
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return false
    if (isAfter(new Date(), otp.expiresAt)) return false
    return true
  }

  async verifyOtp(target: string, code: string): Promise<boolean> {
    // Fast path: check Redis first
    const cached = await this.redis.get(`otp:${target}`)
    if (cached === code) {
      await this.redis.del(`otp:${target}`)
      await this.prisma.otpCode.updateMany({
        where: { target, code, used: false },
        data: { used: true },
      })
      return true
    }

    // Fallback: check DB
    const otp = await this.prisma.otpCode.findFirst({
      where: { target, code, used: false },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) return false
    if (otp.attempts >= OTP_MAX_ATTEMPTS) return false
    if (isAfter(new Date(), otp.expiresAt)) return false

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    })

    return true
  }

  async verifyFirebaseToken(idToken: string, targetPhone: string): Promise<boolean> {
    if (!admin.apps.length) {
      console.warn('Firebase Admin not initialized. Cannot verify token.');
      return false;
    }
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken)
      if (decodedToken.phone_number === targetPhone || decodedToken.email === targetPhone) {
        return true
      }
      console.warn(`Token mismatch. Expected ${targetPhone}, got phone: ${decodedToken.phone_number}, email: ${decodedToken.email}`);
      return false
    } catch (error) {
      console.error('Firebase ID Token validation error:', error)
      return false
    }
  }

  /**
   * Verify a Google Firebase ID token and return the decoded payload.
   * Does NOT require a phone/email match — just validates the token signature.
   */
  async verifyAndDecodeGoogleToken(idToken: string): Promise<{ decoded?: admin.auth.DecodedIdToken, error?: string }> {
    if (!admin.apps.length) {
      console.warn('[Firebase Admin] Not initialized — cannot verify Google token.')
      return { error: 'Firebase Admin not initialized. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.' }
    }
    try {
      const decoded = await admin.auth().verifyIdToken(idToken)
      return { decoded }
    } catch (error: any) {
      console.error('[Firebase] Google token verification failed:', error)
      return { error: error.message || 'Verification failed' }
    }
  }

  /**
   * Google Sign-In: find existing account or create a new one.
   * Returns { user, isNewUser }.
   */
  async googleRegisterOrLogin(decoded: admin.auth.DecodedIdToken): Promise<{ user: any; isNewUser: boolean }> {
    const email = decoded.email
    if (!email) throw new Error('GOOGLE_NO_EMAIL')

    const existing = await this.prisma.user.findFirst({
      where: { email },
      include: { profile: true },
    })

    if (existing) {
      return { user: existing, isNewUser: false }
    }

    // Auto-create account from Google profile
    const displayName = decoded.name || decoded.email?.split('@')[0] || 'Utilisateur'
    const avatarUrl = decoded.picture || undefined

    // Generate a safe unique username
    const baseUsername = email
      .split('@')[0]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20)
    const username = `${baseUsername}_${Math.floor(Math.random() * 9999)}`

    const user = await this.prisma.user.create({
      data: {
        email,
        provider: 'GOOGLE',
        isVerified: true,
        profile: {
          create: {
            username,
            displayName,
            avatarUrl,
          },
        },
        wallet: { create: {} },
      },
      include: { profile: true },
    })

    return { user, isNewUser: true }
  }

  // ── Pre-verified Session ────────────────────────────────────────────────────
  // Used to allow multi-step signup flows where the OTP might expire before step 11

  /**
   * Store a pre-verified marker in Redis (30 min) after OTP is validated at step 2.
   * This prevents "OTP expired" errors when the user takes >10 min to fill their profile.
   */
  async storeVerifiedSession(target: string): Promise<void> {
    await this.redis.setex(`preverified:${target}`, PRE_VERIFIED_TTL_SECONDS, '1')
  }

  /**
   * Check if a pre-verified session exists for this target.
   * Returns true if the user successfully verified their OTP earlier in the flow.
   */
  async checkVerifiedSession(target: string): Promise<boolean> {
    const value = await this.redis.get(`preverified:${target}`)
    return value === '1'
  }

  /**
   * Consume (delete) the pre-verified session after successful registration.
   */
  async consumeVerifiedSession(target: string): Promise<void> {
    await this.redis.del(`preverified:${target}`)
  }

  // ── Register ───────────────────────────────────────────────────────────────

  async register(input: RegisterInput) {
    const isPhone = input.target.startsWith('+')

    const existing = await this.prisma.user.findFirst({
      where: isPhone ? { phone: input.target } : { email: input.target },
    })
    if (existing) throw new Error('USER_ALREADY_EXISTS')

    const usernameExists = await this.prisma.profile.findUnique({
      where: { username: input.username },
    })
    if (usernameExists) throw new Error('USERNAME_TAKEN')

    // Hash password if provided
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 12)
      : undefined

    const user = await this.prisma.user.create({
      data: {
        ...(isPhone ? { phone: input.target } : { email: input.target }),
        provider: isPhone ? 'PHONE' : 'EMAIL',
        isVerified: true,
        passwordHash,
        profile: {
          create: {
            username: input.username,
            displayName: input.displayName,
            birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
            gender: input.gender,
          },
        },
        wallet: { create: {} },
      },
      include: { profile: true },
    })

    return user
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async findUserByTarget(target: string) {
    const isPhone = target.startsWith('+')
    return this.prisma.user.findFirst({
      where: isPhone ? { phone: target } : { email: target },
      include: { profile: true },
    })
  }

  // ── Tokens ─────────────────────────────────────────────────────────────────

  async createRefreshToken(userId: string, meta?: { userAgent?: string; ipAddress?: string }) {
    const token = uuidv4()
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt, ...meta },
    })

    // Store in Redis for fast validation
    await this.redis.setex(
      `refresh:${token}`,
      REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      userId,
    )

    return token
  }

  async validateRefreshToken(token: string) {
    // Fast path: Redis
    const userId = await this.redis.get(`refresh:${token}`)
    if (userId) return userId

    // Fallback: DB
    const record = await this.prisma.refreshToken.findUnique({
      where: { token },
    })

    if (!record || record.revokedAt || isAfter(new Date(), record.expiresAt)) {
      return null
    }

    return record.userId
  }

  async revokeRefreshToken(token: string) {
    await this.redis.del(`refresh:${token}`)
    await this.prisma.refreshToken.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAllUserTokens(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
    })
    const pipeline = this.redis.pipeline()
    tokens.forEach((t) => pipeline.del(`refresh:${t.token}`))
    await pipeline.exec()

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  // ── SMS / Email ────────────────────────────────────────────────────────────

  private async sendSmsOtp(phone: string, code: string) {
    // Africa's Talking support removed. SMS via phone auth should be handled client-side with Firebase.
    process.stdout.write('\n')
    process.stdout.write('╔══════════════════════════════════════╗\n')
    process.stdout.write("║      📱 SMS OTP — DEV MODE ONLY       ║\n")
    process.stdout.write('╠══════════════════════════════════════╣\n')
    process.stdout.write(`║  Numéro : ${phone.padEnd(27)}║\n`)
    process.stdout.write(`║  Code   : ${code.padEnd(27)}║\n`)
    process.stdout.write('╚══════════════════════════════════════╝\n')
    process.stdout.write('\n')
  }

  private async sendWhatsappOtp(phone: string, code: string) {
    if (!process.env.WHATSAPP_PHONE_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
      // DEV MODE: guaranteed stdout output
      process.stdout.write('\n')
      process.stdout.write('╔══════════════════════════════════════╗\n')
      process.stdout.write("║   💬 WHATSAPP OTP (META) — DEV MODE  ║\n")
      process.stdout.write('╠══════════════════════════════════════╣\n')
      process.stdout.write(`║  Numéro : ${phone.padEnd(27)}║\n`)
      process.stdout.write(`║  Code   : ${code.padEnd(27)}║\n`)
      process.stdout.write('╚══════════════════════════════════════╝\n')
      process.stdout.write('\n')
      return
    }

    const cleanPhone = phone.startsWith('+') ? phone.slice(1) : phone
    // 5-second timeout — if Meta API doesn't respond, we log and move on.
    // The OTP is already saved in DB/Redis so the user can still enter it.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'template',
            template: {
              name: process.env.WHATSAPP_TEMPLATE_NAME || 'auth_otp',
              language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'fr' },
              components: [
                {
                  type: 'body',
                  parameters: [{ type: 'text', text: code }],
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [{ type: 'text', text: code }],
                },
              ],
            },
          }),
        },
      )
      clearTimeout(timeoutId)

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        console.error('[Meta WhatsApp Error]', { status: response.status, data: errData })
        return
      }

      const result = (await response.json()) as any
      console.log('[Meta WhatsApp] OTP envoyé à', cleanPhone, '| message_id:', result.messages?.[0]?.id)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error?.name === 'AbortError') {
        console.error('[Meta WhatsApp] Timeout — API did not respond within 5s. OTP is in DB.')
      } else {
        console.error('[Meta WhatsApp Error]', { raw: error?.message || error })
      }
      // Don't throw — the OTP is saved in DB, user can still validate it manually
    }
  }

  private async sendEmailOtp(email: string, code: string) {
    if (!process.env.RESEND_API_KEY) {
      // DEV MODE: guaranteed stdout output
      process.stdout.write('\n')
      process.stdout.write('╔══════════════════════════════════════╗\n')
      process.stdout.write("║      📧 OTP LET'S OUT — DEV MODE     ║\n")
      process.stdout.write('╠══════════════════════════════════════╣\n')
      process.stdout.write(`║  Email  : ${email.padEnd(27)}║\n`)
      process.stdout.write(`║  Code   : ${code.padEnd(27)}║\n`)
      process.stdout.write('╚══════════════════════════════════════╝\n')
      process.stdout.write('\n')
      return
    }
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: "Let's Out <noreply@letsout.app>",
      to: email,
      subject: `Votre code de connexion : ${code}`,
      html: `<p>Votre code de vérification <strong>Let's Out</strong> : <strong style="font-size:24px">${code}</strong></p><p>Valable ${OTP_TTL_MINUTES} minutes.</p>`,
    })
  }
}
