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
