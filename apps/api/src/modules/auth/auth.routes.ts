import type { FastifyInstance } from 'fastify'
import { AuthController } from './auth.controller'

export default async function authRoutes(app: FastifyInstance) {
  const ctrl = new AuthController(app)

  // Send OTP (SMS or email)
  app.post('/send-otp', {
    config: { rateLimit: { max: 50, timeWindow: '5 minutes' } },
    handler: ctrl.sendOtp.bind(ctrl),
  })

  // Send OTP via WhatsApp only
  app.post('/send-whatsapp-otp', {
    config: { rateLimit: { max: 50, timeWindow: '5 minutes' } },
    handler: ctrl.sendWhatsappOtp.bind(ctrl),
  })

  // Check if a target (phone/email) exists
  app.post('/check-target', {
    handler: ctrl.checkTarget.bind(ctrl),
  })

  // Validate OTP without consuming it (safe to call at step 2 before registration)
  app.post('/check-otp', {
    config: { rateLimit: { max: 50, timeWindow: '5 minutes' } },
    handler: ctrl.checkOtp.bind(ctrl),
  })

  // Verify OTP and consume it (marks as used)
  app.post('/verify-otp', {
    handler: ctrl.verifyOtp.bind(ctrl),
  })

  // Register new user (after OTP verified)
  app.post('/register', {
    handler: ctrl.register.bind(ctrl),
  })

  // Login step 1: check password and send OTP
  app.post('/login/init', {
    config: { rateLimit: { max: 50, timeWindow: '5 minutes' } },
    handler: ctrl.initLogin.bind(ctrl),
  })

  // Login existing user (OTP-based)
  app.post('/login', {
    handler: ctrl.login.bind(ctrl),
  })

  // Google Sign-In (Login only)
  app.post('/google', {
    handler: ctrl.googleSignIn.bind(ctrl),
  })

  // Refresh access token
  app.post('/refresh', {
    handler: ctrl.refresh.bind(ctrl),
  })

  // Logout (revoke refresh token)
  app.post('/logout', {
    preHandler: [app.authenticate],
    handler: ctrl.logout.bind(ctrl),
  })

  // Get current user
  app.get('/me', {
    preHandler: [app.authenticate],
    handler: ctrl.me.bind(ctrl),
  })

  // Reset password
  app.post('/reset-password', {
    handler: ctrl.resetPassword.bind(ctrl),
  })

  // Admin login (Password-based)
  app.post('/admin-login', {
    handler: ctrl.adminLogin.bind(ctrl),
  })

  // Admin send OTP for password reset
  app.post('/admin-reset-password-otp', {
    config: { rateLimit: { max: 50, timeWindow: '5 minutes' } },
    handler: ctrl.adminResetPasswordOtp.bind(ctrl),
  })

  // Admin reset password
  app.post('/admin-reset-password', {
    handler: ctrl.adminResetPassword.bind(ctrl),
  })

  // Create new Admin
  app.post('/admins', {
    preHandler: [app.authenticate, app.requireAdmin],
    handler: ctrl.createAdmin.bind(ctrl),
  })

  // ── CLIENT AUTH DIAGNOSTIC LOG (no auth required) ──────────────
  // Mobile app sends auth step logs here → visible in Render dashboard logs
  app.post('/client-log', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (req, reply) => {
      const { level, flow, step, data, error, timestamp } = req.body as any
      const tag = `[MobileAuthLog][${level}][${flow}]`
      const msg = `${tag} ${step}`
      if (level === 'ERROR') {
        req.log.error({ data, error }, msg)
      } else if (level === 'WARN') {
        req.log.warn({ data }, msg)
      } else {
        req.log.info({ data }, msg)
      }
      return reply.status(200).send({ ok: true })
    },
  })
}
