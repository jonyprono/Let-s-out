import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAndSendNotification } from '../notifications/notifications.routes'
import { writeAuditLog } from '../../services/audit.service'
import { releaseFunds } from '../payments/event-payout.routes'
import { format } from 'date-fns'

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
  app.get('/admins', async (_req, reply) => {
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
  // ── Audit Logs ─────────────────────────────────────────────────────
  app.get('/audit/logs', async (req, reply) => {
    const query = z.object({
      action: z.string().optional(),
      eventId: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).parse(req.query)

    const where: any = {}
    if (query.action) where.action = query.action
    if (query.eventId) where.eventId = query.eventId

    const [total, rows] = await Promise.all([
      app.prisma.auditLog.count({ where }),
      app.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])

    return reply.send({
      data: rows,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit) || 1,
    })
  })

  // ── Export CSV des logs d'audit ─────────────────────────────────────
  app.get('/audit/export', async (_req, reply) => {
    const rows = await app.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' }
    })

    const header = ['ID', 'Date', 'Action', 'Actor ID', 'Actor Role', 'Event ID', 'Target Type', 'Target ID', 'Amount', 'IP Address', 'User Agent', 'Comment']
    const csvRows = rows.map(r => [
      r.id,
      format(r.createdAt, "yyyy-MM-dd HH:mm:ss"),
      r.action,
      r.actorId || '',
      r.actorRole || '',
      r.eventId || '',
      r.targetType || '',
      r.targetId || '',
      r.amount?.toString() || '',
      r.ipAddress || '',
      r.userAgent || '',
      r.comment || ''
    ])

    const csvContent = [header, ...csvRows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="audit_logs.csv"')
    return reply.send(csvContent)
  })

  // ── Gestion des Payouts ─────────────────────────────────────────────
  app.get('/payouts', async (req, reply) => {
    const query = z.object({
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query)

    const where: any = {}
    if (query.status) where.status = query.status

    const [total, rows] = await Promise.all([
      app.prisma.eventPayoutRequest.count({ where }),
      app.prisma.eventPayoutRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          event: { select: { title: true, poolCollected: true, poolWithdrawn: true } }
        }
      })
    ])

    return reply.send({
      data: rows,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit) || 1,
    })
  })

  app.post('/payouts/:id/force-approve', async (req, reply) => {
    const { id } = req.params as { id: string }
    
    const payoutReq = await app.prisma.eventPayoutRequest.findUnique({
      where: { id },
      include: { event: true }
    })
    if (!payoutReq) return reply.code(404).send({ error: 'Request not found' })
    if (['APPROVED', 'EXPIRED'].includes(payoutReq.status)) {
      return reply.code(400).send({ error: `Cannot approve request with status ${payoutReq.status}` })
    }

    const adminUser = req.user as { sub: string }

    await releaseFunds(app, payoutReq.eventId, payoutReq.requestedBy, payoutReq.amount, payoutReq.event.title, payoutReq.id)

    const updated = await app.prisma.eventPayoutRequest.update({
      where: { id },
      data: { status: 'APPROVED' }
    })

    await writeAuditLog(app.prisma, {
      actorId: adminUser.sub,
      actorRole: 'ADMIN',
      action: 'PAYOUT_APPROVED',
      targetType: 'payoutRequest',
      targetId: id,
      eventId: payoutReq.eventId,
      amount: payoutReq.amount,
      comment: 'Forcé par un administrateur',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    return reply.send({ data: updated, message: 'Fonds débloqués de force par l\'admin' })
  })

  app.post('/payouts/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { reason } = z.object({ reason: z.string() }).parse(req.body)

    const payoutReq = await app.prisma.eventPayoutRequest.findUnique({ where: { id } })
    if (!payoutReq) return reply.code(404).send({ error: 'Request not found' })
    if (payoutReq.status === 'APPROVED') return reply.code(400).send({ error: 'Cannot reject already approved payout' })

    const adminUser = req.user as { sub: string }

    const updated = await app.prisma.eventPayoutRequest.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason || 'Refusé par administrateur' }
    })

    await writeAuditLog(app.prisma, {
      actorId: adminUser.sub,
      actorRole: 'ADMIN',
      action: 'PAYOUT_REJECTED',
      targetType: 'payoutRequest',
      targetId: id,
      eventId: payoutReq.eventId,
      amount: payoutReq.amount,
      comment: reason || 'Refus manuel',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    return reply.send({ data: updated, message: 'Requête rejetée' })
  })

  // ── Feature Flags ─────────────────────────────────────────────────
  // GET /admin/feature-flags — liste tous les flags
  app.get('/feature-flags', async (_req, reply) => {
    const flags = await app.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    })
    return reply.send({ data: flags })
  })

  // PUT /admin/feature-flags/:key — active ou désactive un flag
  app.put('/feature-flags/:key', async (req, reply) => {
    const { key } = req.params as { key: string }
    const { isActive, description } = req.body as { isActive: boolean; description?: string }

    const flag = await app.prisma.featureFlag.upsert({
      where: { key },
      update: { isActive, ...(description !== undefined ? { description } : {}) },
      create: { key, isActive: isActive ?? false, description: description ?? '' },
    })

    return reply.send({ data: flag })
  })

  // ── Badges ────────────────────────────────────────────────────────
  // GET /admin/badges — liste tous les badges
  app.get('/badges', async (_req, reply) => {
    const badges = await app.prisma.badge.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: badges })
  })

  // POST /admin/badges — créer un badge
  app.post('/badges', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string(),
      icon: z.string(),
      category: z.string().default('standard'),
      xpReward: z.number().default(0),
      conditionsLogic: z.any(),
      isActive: z.boolean().default(true),
      endDate: z.string().nullable().optional(),
    })
    const body = schema.parse(req.body)

    const badge = await app.prisma.badge.create({
      data: {
        ...body,
        conditionsLogic: body.conditionsLogic || {},
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    })

    return reply.status(201).send({ data: badge })
  })

  // PUT /admin/badges/:id — modifier un badge
  app.put('/badges/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      category: z.string().optional(),
      xpReward: z.number().optional(),
      conditionsLogic: z.any().optional(),
      isActive: z.boolean().optional(),
      endDate: z.string().nullable().optional(),
    })
    const body = schema.parse(req.body)

    const dataToUpdate: any = { ...body }
    if (body.endDate !== undefined) {
      dataToUpdate.endDate = body.endDate ? new Date(body.endDate) : null
    }

    const badge = await app.prisma.badge.update({
      where: { id },
      data: dataToUpdate,
    })

    return reply.send({ data: badge })
  })

  // DELETE /admin/badges/:id — supprimer un badge
  app.delete('/badges/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    
    await app.prisma.badge.delete({
      where: { id },
    })

    return reply.send({ success: true })
  })
}
