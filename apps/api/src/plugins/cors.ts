import fp from 'fastify-plugin'
import cors from '@fastify/cors'

// Parse allowed origins from CORS_ORIGIN env var (comma-separated)
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ORIGIN || ''
  return envOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

function getCorsOriginValidator(allowedOrigins: string[]) {
  return (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    // Allow requests with no origin (server-to-server, curl, Capacitor mobile)
    if (!origin) {
      cb(null, true)
      return
    }

    // Allow explicit origins from env var (e.g. Vercel production URL)
    if (allowedOrigins.some((o) => origin === o || origin.endsWith(o.replace(/^https?:\/\//, '')))) {
      cb(null, true)
      return
    }

    // Allow localhost and 127.0.0.1 for local development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      cb(null, true)
      return
    }

    // Allow private IP addresses (for Capacitor mobile on local network)
    try {
      const url = new URL(origin)
      const host = url.hostname

      const isPrivateIP =
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^127\./.test(host)

      cb(null, isPrivateIP)
    } catch {
      cb(null, false)
    }
  }
}

export default fp(async (app) => {
  const allowedOrigins = getAllowedOrigins()
  app.log.info(`[CORS] Allowed origins: ${allowedOrigins.join(', ') || '(none from env)'}`)

  await app.register(cors, {
    origin: getCorsOriginValidator(allowedOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
})

