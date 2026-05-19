import fp from 'fastify-plugin'
import cors from '@fastify/cors'

// Allow CORS from localhost, 127.0.0.1, and local IP addresses
function getCorsOriginValidator() {
  return (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    // Allow localhost and 127.0.0.1
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      cb(null, true)
      return
    }

    // Allow private IP addresses (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    try {
      const url = new URL(origin)
      const host = url.hostname
      
      const isPrivateIP =
        /^10\./.test(host) || // 10.0.0.0 – 10.255.255.255
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) || // 172.16.0.0 – 172.31.255.255
        /^192\.168\./.test(host) || // 192.168.0.0 – 192.168.255.255
        /^localhost$/.test(host) ||
        /^127\./.test(host)
      
      cb(null, isPrivateIP)
    } catch {
      cb(null, false)
    }
  }
}

export default fp(async (app) => {
  await app.register(cors, {
    origin: getCorsOriginValidator(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
})
