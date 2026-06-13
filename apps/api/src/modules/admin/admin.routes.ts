import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAndSendNotification } from '../notifications/notifications.routes'

const KYC_STATUSES = ['pending', 'verified', 'rejected'] as const

function mapKycRow(profile: any) {
  const u = profile.user
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    phone: u?.phone ?? null,
    email: u?.email ?? null,
    kycStatus: profile.kycStatus ?? 'pending',
    kycSubmittedAt: profile.kycSubmittedAt,
    kycReviewedAt: profile.kycReviewedAt,
    kycRejectedReason: profile.kycRejectedReason,
    hasDocuments: !!(profile.kycIdFront || profile.kycSelfie),
  }
}

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)
  app.addHook('preHandler', app.requireAdmin)

  // ── Stats dashboard ─────────────────────────────────────────────
  app.get('/kyc/stats', async (_req, reply) => {
    const [pending, approved, rejected, recent] = await Promise.all([
      app.prisma.profile.count({ where: { kycStatus: 'pending' } }),
      app.prisma.profile.count({ where: { kycStatus: 'verified' } }),
      app.prisma.profile.count({ where: { kycStatus: 'rejected' } }),
      app.prisma.profile.findMany({
        where: { kycSubmittedAt: { not: null } },
        orderBy: { kycSubmittedAt: 'desc' },
        take: 8,
        include: { user: { select: { phone: true, email: true } } },
      }),
    ])

    return reply.send({
      pending,
      approved,
      rejected,
      total: pending + approved + rejected,
      recent: recent.map(mapKycRow),
    })
  })

  // ── Liste KYC ─────────────────────────────────────────────────────
  app.get('/kyc', async (req, reply) => {
    const query = z.object({
      status: z.enum(KYC_STATUSES).optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      sort: z.enum(['newest', 'oldest']).default('newest'),
    }).parse(req.query)

    const where: any = {
      kycSubmittedAt: { not: null },
    }
    if (query.status) where.kycStatus = query.status
    if (query.search?.trim()) {
      const q = query.search.trim()
      where.OR = [
        { displayName: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { user: { phone: { contains: q } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ]
    }

    const [total, rows] = await Promise.all([
      app.prisma.profile.count({ where }),
      app.prisma.profile.findMany({
        where,
        orderBy: { kycSubmittedAt: query.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          user: { select: { id: true, phone: true, email: true, isVerified: true, createdAt: true } },
        },
      }),
    ])

    return reply.send({
      data: rows.map(mapKycRow),
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit) || 1,
    })
  })

  // ── Détail dossier ────────────────────────────────────────────────
  app.get('/kyc/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }

    const profile = await app.prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            email: true,
            isVerified: true,
            createdAt: true,
            role: true,
          },
        },
      },
    })

    if (!profile) return reply.code(404).send({ error: 'Profil introuvable' })

    return reply.send({
      ...mapKycRow(profile),
      documents: {
        idFront: profile.kycIdFront,
        idBack: profile.kycIdBack,
        selfie: profile.kycSelfie,
        selfieWithId: profile.kycSelfieWithId,
      },
      user: profile.user,
    })
  })

  // ── Approuver ─────────────────────────────────────────────────────
  app.post('/kyc/:userId/approve', async (req, reply) => {
    const { userId } = req.params as { userId: string }

    const profile = await app.prisma.profile.update({
      where: { userId },
      data: {
        kycStatus: 'verified',
        kycReviewedAt: new Date(),
        kycRejectedReason: null,
      },
    })

    await app.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    })

    await createAndSendNotification(app, {
      userId,
      type: 'SYSTEM',
      title: 'Profil vérifié',
      body: 'Félicitations ! Votre identité a été validée. Votre badge vérifié est actif.',
      data: { kycStatus: 'verified' },
    })

    return reply.send({ success: true, kycStatus: profile.kycStatus })
  })

  // ── Rejeter ───────────────────────────────────────────────────────
  app.post('/kyc/:userId/reject', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const body = z.object({ reason: z.string().min(3).max(500) }).parse(req.body)

    const profile = await app.prisma.profile.update({
      where: { userId },
      data: {
        kycStatus: 'rejected',
        kycRejectedReason: body.reason,
        kycReviewedAt: new Date(),
      },
    })

    await app.prisma.user.update({
      where: { id: userId },
      data: { isVerified: false },
    })

    await createAndSendNotification(app, {
      userId,
      type: 'SYSTEM',
      title: 'Vérification refusée',
      body: body.reason,
      data: { kycStatus: 'rejected', reason: body.reason },
    })

    return reply.send({ success: true, kycStatus: profile.kycStatus })
  })

  // ── Gestion des Administrateurs ───────────────────────────────────
  app.get('/admins', async (req, reply) => {
    const admins = await app.prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(admins)
  })

  app.post('/admins', async (req, reply) => {
    const body = z.object({ phone: z.string().min(5), name: z.string().optional() }).parse(req.body)

    const existing = await app.prisma.admin.findUnique({ where: { phone: body.phone } })
    if (existing) {
      return reply.code(400).send({ error: 'Cet administrateur existe déjà.' })
    }

    const admin = await app.prisma.admin.create({
      data: {
        phone: body.phone,
        name: body.name,
      },
    })
    return reply.send(admin)
  })

  app.delete('/admins/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    
    // Prevent deleting oneself
    if ((req.user as any).sub === id) {
      return reply.code(400).send({ error: 'Vous ne pouvez pas vous supprimer vous-même.' })
    }

    await app.prisma.admin.delete({ where: { id } })
    return reply.send({ success: true })
  })
}
