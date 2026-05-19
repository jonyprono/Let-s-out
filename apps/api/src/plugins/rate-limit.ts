import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import { getRedis } from './redis'

export default fp(async (app) => {
  await app.register(rateLimit, {
    max: 300,           // 300 requests per minute globally (increased to avoid false positives)
    timeWindow: '1 minute',
    // Use Redis for distributed rate limiting in prod
    redis: process.env.NODE_ENV === 'production' ? getRedis() : undefined,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Trop de tentatives. Réessayez dans ${context.after}.`,
    }),
    skipOnError: true,  // Don't apply rate limit when Redis is unavailable
  })
})
