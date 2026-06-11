import type { FastifyInstance } from 'fastify'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { uploadStreamToCloudinary } from '../../services/cloudinary.service'

export default async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post('/upload', async (req, reply) => {
    const data = await req.file()
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' })
    }

    const ext = path.extname(data.filename)
    const filename = `${uuidv4()}${ext}`
    
    try {
      const url = await uploadStreamToCloudinary(data.file, 'chat_uploads', filename)
      return reply.send({ url })
    } catch (err) {
      console.error('Upload error', err)
      return reply.code(500).send({ error: 'Upload failed' })
    }
  })
}
