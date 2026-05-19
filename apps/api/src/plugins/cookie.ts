import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'

export default fp(async (app) => {
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'letsout-cookie-secret-change-in-prod',
    hook: 'onRequest',
  })
})
