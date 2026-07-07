import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import dotenv from 'dotenv'

dotenv.config()

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
}).withTypeProvider<TypeBoxTypeProvider>()

async function bootstrap() {
  // ── Plugins ────────────────────────────────────────────────────
  await app.register(import('./plugins/cors'))
  await app.register(import('./plugins/helmet'))
  await app.register(import('./plugins/redis'))
  await app.register(import('./plugins/rate-limit'))
  await app.register(import('./plugins/cookie'))
  await app.register(import('./plugins/jwt'))
  await app.register(import('./plugins/prisma'))
  await app.register(import('./plugins/websocket'))
  await app.register(import('@fastify/multipart'), { limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB limit
  
  // Serve static files (uploads)
  const path = await import('path');
  await app.register(import('@fastify/static'), {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  })

  // ── Routes ─────────────────────────────────────────────────────
  await app.register(import('./modules/auth/auth.routes'), { prefix: '/api/v1/auth' })
  await app.register(import('./modules/users/users.routes'), { prefix: '/api/v1/users' })
  await app.register(import('./modules/events/events.routes'), { prefix: '/api/v1/events' })
  await app.register(import('./modules/chat/chat.routes'), { prefix: '/api/v1/chat' })
  await app.register(import('./modules/chat/upload.routes'), { prefix: '/api/v1/chat' })
  await app.register(import('./modules/notifications/notifications.routes'), { prefix: '/api/v1/notifications' })
  await app.register(import('./modules/payments/payments.routes'), { prefix: '/api/v1/payments' })
  await app.register(import('./modules/admin/admin.routes'), { prefix: '/api/v1/admin' })

  // ── Health ─────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ── PUBLIC: Firebase diagnostic (no auth) ──────────────────────
  app.get('/ping-firebase', async (_req, reply) => {
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT
    const hasProjectId = !!process.env.FIREBASE_PROJECT_ID
    const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL
    const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY
    const configured = hasServiceAccount || (hasProjectId && hasClientEmail && hasPrivateKey)

    let firebaseOk = false
    let firebaseError = ''
    try {
      const { sendPushToUser } = await import('./services/push.service')
      await sendPushToUser(app.prisma as any, '__ping__', { title: 'ping', body: 'ping' })
      firebaseOk = true
    } catch (e: any) {
      firebaseError = e.message
    }

    return reply.send({ configured, vars: { hasServiceAccount, hasProjectId, hasClientEmail, hasPrivateKey }, firebaseOk, firebaseError: firebaseError || undefined })
  })

  // ── Database Migration (applied directly to avoid relying on Render's start command) ──
  try {
    // Ensure admins table exists and has all required columns
    await app.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" TEXT NOT NULL,
        "phone" TEXT,
        "email" TEXT,
        "passwordHash" TEXT,
        "name" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
      )
    `)
    await app.prisma.$executeRawUnsafe(`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "email" TEXT`)
    await app.prisma.$executeRawUnsafe(`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT`)
    await app.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email")`)
    await app.prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "admins_phone_key" ON "admins"("phone")`)
    app.log.info('✅ Admin table migration applied')
  } catch (err) {
    app.log.warn({ err }, '⚠️ Admin table migration warning (non-fatal)')
  }

  // ── Seed Admin ─────────────────────────────────────────────────
  try {
    const adminPhone = '+2290156363337'
    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash('Azerty01', 10)
    const existingAdmin = await app.prisma.admin.findUnique({ where: { phone: adminPhone } })
    if (!existingAdmin) {
      await app.prisma.admin.create({
        data: {
          phone: adminPhone,
          name: 'Admin Principal',
          passwordHash
        }
      })
      app.log.info('✅ Default admin account created')
    } else if (!existingAdmin.passwordHash) {
      // Admin already exists but was created before passwordHash column — update it
      await app.prisma.admin.update({
        where: { phone: adminPhone },
        data: { passwordHash, name: existingAdmin.name || 'Admin Principal' }
      })
      app.log.info('✅ Default admin password hash updated')
    }
  } catch (err) {
    app.log.warn('⚠️ Could not seed default admin.')
  }

  // ── Start ──────────────────────────────────────────────────────
  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`🚀 API running at http://localhost:${port}`)
}

bootstrap().catch((err) => {
  console.error('CRITICAL STARTUP ERROR:', err)
  // Flush stdout/stderr before exiting
  setTimeout(() => {
    process.exit(1)
  }, 1000)
})
