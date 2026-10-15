import fp from 'fastify-plugin'
import Redis from 'ioredis'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) throw new Error('Redis not initialized')
  return redisInstance
}

export default fp(async (app) => {
  const redisUrl =
    process.env.REDIS_URL ||
    process.env.REDISPRIVATEURL ||
    process.env.REDIS_PUBLIC_URL ||
    (process.env.REDISHOST
      ? `redis://${process.env.REDISUSER || 'default'}:${process.env.REDISPASSWORD || ''}@${process.env.REDISHOST}:${process.env.REDISPORT || 6379}`
      : undefined) ||
    'redis://localhost:6379'
  const isUpstash = redisUrl.includes('upstash.io')
  
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    family: 0,
    connectTimeout: 5000,
    enableOfflineQueue: false,
    ...(isUpstash ? { tls: { rejectUnauthorized: false } } : {})
  })

  try {
    await redis.connect()
    app.log.info('✅ Connected to Redis')
  } catch (err: any) {
    app.log.error(`⚠️ Redis connection failed (${redisUrl}): ${err?.message || err}. Continuing startup...`)
  }

  redisInstance = redis
  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    try {
      await redis.quit()
    } catch (_) {}
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}
