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

import { getFirebaseApp } from '../../services/push.service'

// Initialize Firebase Admin (handles both SERVICE_ACCOUNT and individual vars)
getFirebaseApp()

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

  // Normalise phone/email so that keys are always consistent (strips leading/trailing whitespace)
  private normaliseTarget(target: string): string {
    return target.trim()
  }

  async generateAndSendOtp(target: string, type: 'phone' | 'email', channel: 'sms' | 'whatsapp' = 'whatsapp'): Promise<void> {
    const cleanTarget = this.normaliseTarget(target)

    // Per-target rate limiting: max 5 OTP requests per 10 minutes
    const rateLimitKey = `otp_rate:${cleanTarget}`
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

    // Look for an existing valid OTP (search with normalised target)
    const existingOtp = await this.prisma.otpCode.findFirst({
      where: { target: cleanTarget, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    })

    let code: string;
    if (existingOtp) {
      code = existingOtp.code;
      // Re-cache in Redis to be safe
      await this.redis.setex(`otp:${cleanTarget}`, OTP_TTL_MINUTES * 60, code)
      console.log(`[OTP] Resending existing code to ${cleanTarget} via ${channel}`)
    } else {
      code = randomInt(100000, 999999).toString()
      const expiresAt = addMinutes(new Date(), OTP_TTL_MINUTES)
      await this.prisma.otpCode.create({
        data: { target: cleanTarget, code, expiresAt },
      })
      await this.redis.setex(`otp:${cleanTarget}`, OTP_TTL_MINUTES * 60, code)
      console.log(`[OTP] Generated new code for ${cleanTarget} via ${channel}`)
    }

    if (type === 'phone') {
      if (channel === 'whatsapp') {
        await this.sendWhatsappOtp(cleanTarget, code)
      } else {
        await this.sendSmsOtp(cleanTarget, code)
      }
    } else {
      await this.sendEmailOtp(cleanTarget, code)
    }
  }

  /**
   * Check OTP validity WITHOUT consuming it (no Redis del, no used=true).
   * Use this during multi-step flows where the OTP is verified at the end.
   */
  async checkOtp(target: string, code: string): Promise<boolean> {
    const cleanTarget = this.normaliseTarget(target)
    const cleanCode = code.trim()

    // Fast path: Redis (still present = not yet consumed)
    const cached = await this.redis.get(`otp:${cleanTarget}`)
    if (cached === cleanCode) return true

    // Fallback: DB
    const otp = await this.prisma.otpCode.findFirst({
      where: { target: cleanTarget, code: cleanCode, used: false },
      orderBy: { createdAt: 'desc' },
    })
    if (!otp) {
      console.warn(`[OTP] checkOtp failed — no matching code in DB for target=${cleanTarget}`)
      return false
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      console.warn(`[OTP] checkOtp failed — max attempts reached for target=${cleanTarget}`)
      return false
    }
    if (isAfter(new Date(), otp.expiresAt)) {
      console.warn(`[OTP] checkOtp failed — code expired for target=${cleanTarget}, expiredAt=${otp.expiresAt}`)
      return false
    }
    return true
  }

  async verifyOtp(target: string, code: string): Promise<boolean> {
    const cleanTarget = this.normaliseTarget(target)
    const cleanCode = code.trim()

    // Fast path: check Redis first
    const cached = await this.redis.get(`otp:${cleanTarget}`)
    if (cached === cleanCode) {
      await this.redis.del(`otp:${cleanTarget}`)
      await this.prisma.otpCode.updateMany({
        where: { target: cleanTarget, code: cleanCode, used: false },
        data: { used: true },
      })
      console.log(`[OTP] verifyOtp success (Redis) for target=${cleanTarget}`)
      return true
    }

    // Fallback: check DB
    const otp = await this.prisma.otpCode.findFirst({
      where: { target: cleanTarget, used: false },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) {
      console.warn(`[OTP] verifyOtp failed — no active OTP in DB for target=${cleanTarget}`)
      return false
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      console.warn(`[OTP] verifyOtp failed — max attempts for target=${cleanTarget}`)
      return false
    }
    if (isAfter(new Date(), otp.expiresAt)) {
      console.warn(`[OTP] verifyOtp failed — expired for target=${cleanTarget}, expiredAt=${otp.expiresAt}`)
      return false
    }

    if (otp.code !== cleanCode) {
      // Wrong code — increment attempts counter
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      })
      console.warn(`[OTP] verifyOtp failed — wrong code for target=${cleanTarget}, attempts=${otp.attempts + 1}`)
      return false
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    })
    console.log(`[OTP] verifyOtp success (DB) for target=${cleanTarget}`)
    return true
  }

  async verifyFirebaseToken(idToken: string, targetPhone: string): Promise<boolean> {
    if (!admin.apps.length) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Firebase Admin not initialized. Bypassing token signature validation for DEV MODE.');
        try {
          const parts = idToken.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))
            if (payload.phone_number === targetPhone || payload.email === targetPhone) {
              return true
            }
          }
        } catch (e) {
          console.error('Failed to decode JWT locally:', e)
        }
      } else {
        console.warn('Firebase Admin not initialized. Cannot verify token.');
      }
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

    // Asynchronously send welcome email for new Google signups
    this.sendWelcomeEmail(email, displayName).catch((err) => {
      console.error('[Welcome Email Error] Google Signup:', err)
    })

    // Check and assign Early Adopter badge
    this.checkAndAssignEarlyAdopterBadge(user.id).catch((err) => {
      console.error('[Badge Error] Early Adopter badge assignment failed:', err)
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

    // Consume pre-verified session since account is now created
    await this.consumeVerifiedSession(input.target)

    // Asynchronously send welcome email if registered via Email
    if (!isPhone) {
      this.sendWelcomeEmail(input.target, input.displayName).catch((err) => {
        console.error('[Welcome Email Error] Email Signup:', err)
      })
    }

    // Check and assign Early Adopter badge
    this.checkAndAssignEarlyAdopterBadge(user.id).catch((err) => {
      console.error('[Badge Error] Early Adopter badge assignment failed:', err)
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
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout (was 5s — too short for some regions)
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

  public async sendWelcomeEmail(email: string, displayName: string) {
    if (!process.env.RESEND_API_KEY) {
      // DEV MODE fallback
      console.log(`\n📧 [DEV] WELCOME EMAIL simulated to ${email} (Name: ${displayName})\n`);
      return;
    }
    
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="https://letsout.app/logoci.png" alt="Let's Out Logo" style="height: 60px; width: auto;" />
        </div>
        
        <h2 style="font-size: 24px; color: #111111; margin-bottom: 20px;">Bonjour ${displayName},</h2>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Bienvenue dans la communauté Let's Out ! Nous sommes ravis de vous compter parmi nous. 🧡
        </p>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
          Let's Out, c'est l'application qui vous permet de créer, partager et vivre des moments inoubliables avec vos amis ou avec de nouvelles personnes.
        </p>
        
        <h3 style="font-size: 18px; color: #111111; margin-bottom: 15px;">Que pouvez-vous faire dès maintenant ?</h3>
        
        <ul style="list-style: none; padding-left: 0; margin-bottom: 30px;">
          <li style="margin-bottom: 12px; font-size: 16px;">
            🌍 <strong>Explorer les événements</strong> : Découvrez ce qui se passe autour de vous et rejoignez des sorties qui vous correspondent.
          </li>
          <li style="margin-bottom: 12px; font-size: 16px;">
            🗓️ <strong>Créer vos propres événements</strong> : Un anniversaire, un voyage, une soirée ? Organisez tout en quelques clics.
          </li>
          <li style="margin-bottom: 12px; font-size: 16px;">
            💰 <strong>Gérer des cagnottes</strong> : Fini les galères de remboursement, collectez les participations directement sur l'app.
          </li>
        </ul>
        
        <p style="font-size: 16px; margin-bottom: 30px;">
          Pour profiter pleinement de l'expérience, n'hésitez pas à compléter votre profil en ajoutant une photo !
        </p>
        
        <div style="text-align: center; margin-bottom: 40px;">
          <a href="https://letsout.app" style="display: inline-block; background-color: #FF7A00; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 15px 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(255, 122, 0, 0.3);">
            👉 Découvrir les événements
          </a>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Si vous avez la moindre question, répondez simplement à cet email, notre équipe est là pour vous aider.
        </p>
        
        <p style="font-size: 16px; margin-bottom: 10px;">
          À très vite,<br />
          <strong>L'équipe Let's Out</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;" />
        
        <div style="text-align: center; font-size: 12px; color: #888888;">
          <p>
            Vous recevez cet email car vous vous êtes inscrit(e) sur Let's Out.<br />
            <a href="https://letsout.app" style="color: #FF7A00; text-decoration: none;">letsout.app</a>
          </p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: "Let's Out <bonjour@letsout.app>",
      to: email,
      subject: "Bienvenue sur Let's Out ! 🎉",
      html: htmlContent,
    });
  }
  // ── Helpers ────────────────────────────────────────────────────────────────

  private async checkAndAssignEarlyAdopterBadge(userId: string): Promise<void> {
    try {
      const userCount = await this.prisma.user.count();
      if (userCount <= 500) {
        let badge = await this.prisma.badge.findFirst({
          where: { name: 'Early Adopter' }
        });
        
        if (!badge) {
          badge = await this.prisma.badge.create({
            data: {
              name: 'Early Adopter',
              description: 'A rejoint Lets Out parmi les 500 premiers utilisateurs !',
              icon: '🚀',
              category: 'rare',
              xpReward: 500,
              conditionsLogic: { type: 'early_adopter', limit: 500 },
              isActive: true
            }
          });
        }
        
        // Check if user already has it (just in case)
        const existing = await this.prisma.userBadge.findUnique({
          where: { userId_badgeId: { userId, badgeId: badge.id } }
        });

        if (!existing) {
          await this.prisma.userBadge.create({
            data: { userId, badgeId: badge.id }
          });
          console.log(`[Badge] Assigned 'Early Adopter' to user ${userId} (User #${userCount})`);
        }
      }
    } catch (error) {
      console.error('[Badge Error] Failed to assign Early Adopter badge:', error);
    }
  }
}
