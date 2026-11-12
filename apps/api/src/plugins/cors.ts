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

// Official production web hosts — exact hostname match only, never a substring/suffix check.
const OFFICIAL_HOSTS = new Set(['letsout.app', 'www.letsout.app'])

// Vercel deployments for the official "lets-out-web" project only (production alias +
// preview hashes, e.g. lets-out-web.vercel.app, lets-out-web-git-main-team.vercel.app).
// Railway/Render are NOT included here: Railway only hosts the API, never a browser origin.
const VERCEL_PREVIEW_PATTERN = /^https:\/\/lets-out-web[a-z0-9-]*\.vercel\.app$/

function getCorsOriginValidator(allowedOrigins: string[]) {
  const exactAllowed = new Set(allowedOrigins)

  return (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    // Allow requests with no origin (server-to-server, curl, Capacitor mobile)
    if (!origin) {
      cb(null, true)
      return
    }

    // Explicit origins from CORS_ORIGIN env var — exact match only
    if (exactAllowed.has(origin)) {
      cb(null, true)
      return
    }

    // Official "lets-out-web" Vercel deployments only
    if (VERCEL_PREVIEW_PATTERN.test(origin)) {
      cb(null, true)
      return
    }

    try {
      const url = new URL(origin)
      const host = url.hostname

      // Official production domains — exact hostname match
      if (OFFICIAL_HOSTS.has(host)) {
        cb(null, true)
        return
      }

      // Local development
      if (host === 'localhost' || host === '127.0.0.1') {
        cb(null, true)
        return
      }

      // Private IP addresses (for Capacitor mobile on local network)
      const isPrivateIP =
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) ||
        /^192\.168\./.test(host)

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

