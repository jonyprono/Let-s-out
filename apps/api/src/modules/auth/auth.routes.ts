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

  // Admin login (bypasses standard flow)
  app.post('/admin-login', {
    handler: ctrl.adminLogin.bind(ctrl),
  })
}
