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
  await app.register(import('@fastify/compress'), { 
    global: true,
    // On exclut les images en ne compressant que les requêtes JSON, texte, CSS et JS
    customTypes: /text\/html|text\/css|application\/json|application\/javascript|text\/plain/
  })
  await app.register(import('./plugins/websocket'))
  await app.register(import('./plugins/cron'))
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
  await app.register(import('./modules/payments/event-payout.routes'), { prefix: '/api/v1/events' })
  await app.register(import('./modules/chat/chat.routes'), { prefix: '/api/v1/chat' })
  await app.register(import('./modules/chat/upload.routes'), { prefix: '/api/v1/chat' })
  await app.register(import('./modules/notifications/notifications.routes'), { prefix: '/api/v1/notifications' })
  await app.register(import('./modules/payments/payments.routes'), { prefix: '/api/v1/payments' })
  await app.register(import('./modules/payments/wallet.routes'), { prefix: '/api/v1/wallet' })
  await app.register(import('./modules/admin/admin.routes'), { prefix: '/api/v1/admin' })
  await app.register(import('./modules/videos/videos.routes'), { prefix: '/api/v1/videos' })

  // ── PUBLIC: Feature flags (lecture seule, pas d'auth requise) ─────
  app.get('/api/v1/feature-flags', async (_req, reply) => {
    const flags = await app.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
    return reply.send({ data: flags })
  })

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

  // ── PUBLIC: Check token count + send test push by userId ────────
  app.get('/debug-token/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const tokens = await app.prisma.deviceToken.findMany({ where: { userId } })

    // Send a real test push if tokens exist
    let pushSent = false
    let pushError = null
    if (tokens.length > 0) {
      try {
        const { sendPushToUser } = await import('./services/push.service')
        await sendPushToUser(app.prisma as any, userId, {
          title: "🔔 Test Let's Out",
          body: "Les notifications fonctionnent ! Cliquez pour ouvrir l'app.",
          data: { type: 'TEST' }
        })
        pushSent = true
      } catch (e: any) {
        pushError = e.message || String(e)
      }
    }

    // Refresh tokens from DB after push (in case it was deleted)
    const tokensAfter = await app.prisma.deviceToken.findMany({ where: { userId } })

    return reply.send({
      userId,
      tokensCount: tokensAfter.length,
      tokens: tokensAfter.map(t => ({ platform: t.platform, preview: t.token.slice(0, 25) + '...' })),
      pushSent,
      pushError,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL
    })
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

  // ── Schema Patches (idempotent — safe to run on every startup) ─────────────
  // Each patch below fixes a migration that may not have been applied via
  // prisma migrate deploy. Using IF NOT EXISTS / DO NOTHING makes them safe
  // to run multiple times without side effects.
  const schemaPatches: Array<{ name: string; sqls: string[] }> = [
    {
      name: 'KycDocumentType enum + profiles.kycDocumentType column',
      sqls: [
        `
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KycDocumentType') THEN
            CREATE TYPE "KycDocumentType" AS ENUM (
              'CIP', 'CARTE_BIOMETRIQUE', 'CARTE_IDENTITE_NATIONALE', 'PASSEPORT', 'PERMIS_CONDUIRE'
            );
          END IF;
        END $$;
        `,
        `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "kycDocumentType" "KycDocumentType";`
      ],
    },
    {
      name: 'event_payout_requests.idempotencyKey column',
      sqls: [
        `ALTER TABLE "event_payout_requests" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "event_payout_requests_eventId_idempotencyKey_key"
          ON "event_payout_requests"("eventId", "idempotencyKey");`
      ],
    },
  ]

  for (const patch of schemaPatches) {
    try {
      for (const sql of patch.sqls) {
        await app.prisma.$executeRawUnsafe(sql)
      }
      app.log.info(`✅ Schema patch applied: ${patch.name}`)
    } catch (err) {
      // Log but do NOT crash — patch may already be applied or table may not exist yet
      app.log.warn({ err }, `⚠️ Schema patch warning (non-fatal): ${patch.name}`)
    }
  }

  // ── Schema Health Check (fail-fast if DB is out of sync) ───────────────────
  // Checks that critical columns/tables exist before accepting traffic.
  // If any column is missing, the server exits immediately so Render shows a
  // clear crash instead of a misleading "wrong password" error for users.
  //
  // MAINTENANCE: When you add a new migration, add a corresponding entry here.
  // One entry per migration, covering the most representative column/table it adds.
  try {
    // Column-level checks: { table, column, migration } — column must exist on table
    const columnChecks: Array<{ table: string; column: string; migration: string }> = [
      // 20260613000001_add_admin_email_passwordhash
      { table: 'admins', column: 'passwordHash', migration: 'add_admin_email_passwordhash' },
      // 20260714130000_add_last_delivered_at
      { table: 'conversation_members', column: 'lastDeliveredAt', migration: 'add_last_delivered_at' },
      // 20260724120000_add_payout_idempotency_key
      { table: 'event_payout_requests', column: 'idempotencyKey', migration: 'add_payout_idempotency_key' },
      // 20260909000000_add_kyc_document_type
      { table: 'profiles', column: 'kycDocumentType', migration: 'add_kyc_document_type' },
    ]

    // Table-level checks: { table, migration } — table must exist
    const tableChecks: Array<{ table: string; migration: string }> = [
      // 20260720_add_feature_flags
      { table: 'feature_flags', migration: 'add_feature_flags' },
      // 20260901000000_add_reactions_comments
      { table: 'event_reactions', migration: 'add_reactions_comments' },
      { table: 'event_comments', migration: 'add_reactions_comments' },
    ]

    let schemaOk = true

    for (const { table, column, migration } of columnChecks) {
      const result = await app.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2
         ) AS "exists"`,
        table,
        column,
      )
      if (!result[0]?.exists) {
        app.log.error(
          `🚨 SCHEMA HEALTH CHECK FAILED [migration: ${migration}]: ` +
          `column "${column}" missing on table "${table}". ` +
          `Run: prisma migrate deploy`
        )
        schemaOk = false
      }
    }

    for (const { table, migration } of tableChecks) {
      const result = await app.prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_name = $1
         ) AS "exists"`,
        table,
      )
      if (!result[0]?.exists) {
        app.log.error(
          `🚨 SCHEMA HEALTH CHECK FAILED [migration: ${migration}]: ` +
          `table "${table}" does not exist. ` +
          `Run: prisma migrate deploy`
        )
        schemaOk = false
      }
    }

    if (!schemaOk) {
      app.log.error(
        '🚨 One or more schema checks failed. ' +
        'Shutting down to prevent misleading errors in production.'
      )
      process.exit(1)
    }

    app.log.info('✅ Schema health check passed — all critical columns and tables present')
  } catch (err) {
    app.log.warn({ err }, '⚠️ Schema health check error (non-fatal — skipping)')
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
