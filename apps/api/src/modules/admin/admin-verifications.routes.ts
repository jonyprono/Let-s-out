/**
 * Back-office : examen des dossiers
 *  - ONG partenaires (cagnottes solidaires)  → /admin/charities
 *  - certification des pages                 → /admin/pages/verifications
 * Enregistré dans admin.routes.ts (authentification + rôle admin déjà exigés par ses hooks).
 * Les pièces ne sont exposées qu'ici, sous forme de liens signés expirants.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createAndSendNotification } from '../notifications/notifications.routes'
import { signedDocumentUrls } from '../../services/private-documents.service'
import { badgeForEntityType } from '../../services/page-verification-policy'

const ORG_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const
const ReasonSchema = z.object({ reason: z.string().trim().min(3).max(500) })

const PageReviewSchema = z.discriminatedUnion('action', [
  // Couleur du badge déduite du type de structure (bleu : entreprises, lieux, personnalités ; or : ONG, institutions)
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(3).max(500) }),
])

const APPLICANT_SELECT = {
  id: true,
  email: true,
  phone: true,
  profile: { select: { displayName: true, username: true, avatarUrl: true, kycStatus: true } },
} as const

export default async function adminVerificationsRoutes(app: FastifyInstance) {
  // ══ ONG partenaires ═════════════════════════════════════════════════════
  app.get('/charities', async (req, reply) => {
    const q = z.object({ status: z.enum(ORG_STATUSES).optional() }).parse(req.query)
    const orgs = await app.prisma.partnerOrg.findMany({
      where: q.status ? { kycStatus: q.status } : {},
      select: {
        id: true, name: true, logoUrl: true, contactEmail: true, contactPhone: true,
        kycStatus: true, isEligibleForFundraisers: true, createdAt: true, reviewedAt: true,
        applicant: { select: APPLICANT_SELECT },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return reply.send({ data: orgs })
  })

  app.get('/charities/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const org = await app.prisma.partnerOrg.findUnique({
      where: { id },
      include: { applicant: { select: APPLICANT_SELECT }, _count: { select: { events: true } } },
    })
    if (!org) return reply.code(404).send({ error: 'ONG introuvable' })
    const { documentsUrls, ...rest } = org
    return reply.send({ ...rest, documents: signedDocumentUrls(documentsUrls) })
  })

  app.post('/charities/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string }
    const org = await app.prisma.partnerOrg.findUnique({ where: { id }, select: { id: true, name: true, applicantId: true } })
    if (!org) return reply.code(404).send({ error: 'ONG introuvable' })
    await app.prisma.partnerOrg.update({
      where: { id },
      data: { kycStatus: 'VERIFIED', isEligibleForFundraisers: true, rejectionReason: null, reviewedAt: new Date() },
    })
    await createAndSendNotification(app, {
      userId: org.applicantId,
      type: 'SYSTEM',
      title: '🎗️ ONG agréée',
      body: `« ${org.name} » est désormais une ONG partenaire agréée sur Let's Out. Elle peut superviser des cagnottes solidaires.`,
      data: { kind: 'CHARITY_APPROVED', charityId: org.id },
    })
    return reply.send({ success: true, kycStatus: 'VERIFIED' })
  })

  app.post('/charities/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = ReasonSchema.parse(req.body)
    const org = await app.prisma.partnerOrg.findUnique({ where: { id }, select: { id: true, name: true, applicantId: true } })
    if (!org) return reply.code(404).send({ error: 'ONG introuvable' })
    // Un rejet (y compris d'une ONG déjà agréée) retire immédiatement l'éligibilité aux nouvelles cagnottes
    await app.prisma.partnerOrg.update({
      where: { id },
      data: { kycStatus: 'REJECTED', isEligibleForFundraisers: false, rejectionReason: body.reason, reviewedAt: new Date() },
    })
    await createAndSendNotification(app, {
      userId: org.applicantId,
      type: 'SYSTEM',
      title: '❌ Demande d\'agrément refusée',
      body: `La demande d'agrément de « ${org.name} » a été refusée. Motif : ${body.reason}`,
      data: { kind: 'CHARITY_REJECTED', charityId: org.id, reason: body.reason },
    })
    return reply.send({ success: true, kycStatus: 'REJECTED' })
  })

  // ══ Certification des pages ═════════════════════════════════════════════
  app.get('/pages/verifications', async (req, reply) => {
    const q = z.object({ status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional() }).parse(req.query)
    const rows = await app.prisma.pageVerificationRequest.findMany({
      where: q.status ? { status: q.status } : {},
      select: {
        id: true, entityType: true, status: true, badge: true, createdAt: true, reviewedAt: true,
        page: { select: { id: true, name: true, avatarUrl: true, category: true, verificationStatus: true } },
        submittedBy: { select: APPLICANT_SELECT },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return reply.send({ data: rows })
  })

  app.get('/pages/verifications/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const row = await app.prisma.pageVerificationRequest.findUnique({
      where: { id },
      include: {
        page: {
          select: {
            id: true, name: true, description: true, avatarUrl: true, coverUrl: true, category: true,
            verificationStatus: true, verificationBadge: true, createdAt: true,
            _count: { select: { followers: true, posts: true } },
          },
        },
        submittedBy: { select: APPLICANT_SELECT },
      },
    })
    if (!row) return reply.code(404).send({ error: 'Dossier introuvable' })
    const { documents, ...rest } = row
    return reply.send({ ...rest, documents: signedDocumentUrls(documents) })
  })

  app.patch('/pages/verifications/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = PageReviewSchema.parse(req.body)
    const row = await app.prisma.pageVerificationRequest.findUnique({
      where: { id },
      select: { id: true, status: true, pageId: true, submittedById: true, entityType: true, page: { select: { name: true } } },
    })
    if (!row) return reply.code(404).send({ error: 'Dossier introuvable' })
    if (row.status !== 'PENDING') return reply.code(409).send({ error: 'Ce dossier a déjà été examiné.', code: 'ALREADY_REVIEWED' })
    const badge = badgeForEntityType(row.entityType)

    const now = new Date()
    if (body.action === 'approve') {
      await app.prisma.$transaction([
        app.prisma.pageVerificationRequest.update({
          where: { id }, data: { status: 'VERIFIED', badge, rejectionReason: null, reviewedAt: now },
        }),
        app.prisma.page.update({
          where: { id: row.pageId }, data: { verificationStatus: 'VERIFIED', verificationBadge: badge, verifiedAt: now },
        }),
      ])
      await createAndSendNotification(app, {
        userId: row.submittedById,
        type: 'SYSTEM',
        title: '✅ Page certifiée',
        body: `Votre page « ${row.page.name} » est désormais certifiée. Le badge officiel s'affiche à côté de son nom.`,
        data: { kind: 'PAGE_VERIFIED', pageId: row.pageId },
      })
      return reply.send({ success: true, status: 'VERIFIED', badge })
    }

    await app.prisma.$transaction([
      app.prisma.pageVerificationRequest.update({
        where: { id }, data: { status: 'REJECTED', rejectionReason: body.reason, reviewedAt: now },
      }),
      app.prisma.page.update({
        where: { id: row.pageId }, data: { verificationStatus: 'REJECTED', verificationBadge: null, verifiedAt: null },
      }),
    ])
    await createAndSendNotification(app, {
      userId: row.submittedById,
      type: 'SYSTEM',
      title: '❌ Certification refusée',
      body: `La demande de certification de « ${row.page.name} » a été refusée. Motif : ${body.reason}`,
      data: { kind: 'PAGE_VERIFICATION_REJECTED', pageId: row.pageId, reason: body.reason },
    })
    return reply.send({ success: true, status: 'REJECTED' })
  })
}
