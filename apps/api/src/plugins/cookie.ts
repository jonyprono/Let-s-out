import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'

export default fp(async (app) => {
  const secret = process.env.COOKIE_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('COOKIE_SECRET environment variable must be set in production')
    }
    app.log.warn('[cookie] COOKIE_SECRET is not set — using an insecure development-only default')
  }

  await app.register(cookie, {
    secret: secret || 'dev-only-insecure-cookie-secret',
    hook: 'onRequest',
  })
})
