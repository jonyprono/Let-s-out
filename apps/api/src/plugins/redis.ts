import fp from 'fastify-plugin'
import Redis from 'ioredis'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) throw new Error('Redis not initialized')
  return redisInstance
}

export default fp(async (app) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
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
