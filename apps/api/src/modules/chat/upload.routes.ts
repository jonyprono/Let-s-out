import type { FastifyInstance } from 'fastify'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { v4 as uuidv4 } from 'uuid'

export default async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post('/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' })
    }

    const ext = path.extname(data.filename)
    const filename = `${uuidv4()}${ext}`
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const saveTo = path.join(uploadsDir, filename)
    await pipeline(data.file, fs.createWriteStream(saveTo))

    // Return a relative path — the frontend (SafeImage) will prepend the correct API base URL.
    // This ensures images load from any device (mobile, web, etc.) regardless of the server's IP.
    const relativePath = `/uploads/${filename}`

    return reply.send({ url: relativePath })
  })
}
