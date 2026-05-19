import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import type { FastifyRequest, FastifyReply } from 'fastify'

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-change-in-prod',
    sign: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  })

  // Decorator for protected routes
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })
})

// Augment FastifyInstance type
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
