import fp from 'fastify-plugin'
import Redis from 'ioredis'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) throw new Error('Redis not initialized')
  return redisInstance
}

export default fp(async (app) => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  const isUpstash = redisUrl.includes('upstash.io')
  
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    family: 0,
    ...(isUpstash ? { tls: { rejectUnauthorized: false } } : {})
  })

  await redis.connect()

  redisInstance = redis
  app.decorate('redis', redis)

  app.addHook('onClose', async () => {
    await redis.quit()
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}
