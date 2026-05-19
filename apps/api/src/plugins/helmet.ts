import fp from 'fastify-plugin'
import helmet from '@fastify/helmet'

export default fp(async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: false, // handled by CDN/Cloudflare in prod
    crossOriginResourcePolicy: false, // Allow images to be loaded by frontend
  })
})
