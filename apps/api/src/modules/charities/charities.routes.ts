/**
 * ONG partenaires — cagnottes solidaires / santé.
 *
 * - POST /charities/apply          : demande d'agrément d'une ONG (pièces légales privées)
 * - GET  /charities/mine           : mes demandes d'agrément (statut, motif de rejet)
 * - GET  /charities/approved       : ONG agréées (sélecteur à la création d'une cagnotte solidaire)
 * - POST /charities/medical-proof  : envoi privé d'un justificatif médical (devis / attestation)
 *
 * L'examen des dossiers est dans admin-charities.routes.ts (/admin/charities).
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { isKycVerified } from '../../services/kyc.service'
import { KYC_REF_PREFIX } from '../../services/cloudinary.service'
import {
  readDocumentsForm,
  DocumentUploadError,
  documentErrorMessage,
} from '../../services/private-documents.service'

/** Pièces exigées pour l'agrément (ifuDoc facultatif : toutes les associations n'ont pas d'IFU). */
export const CHARITY_REQUIRED_DOCS = ['receipt', 'statutes', 'rib', 'representativeId'] as const
const CHARITY_DOC_FIELDS = [...CHARITY_REQUIRED_DOCS, 'ifuDoc'] as const

/** Dossier Cloudinary des justificatifs médicaux d'un utilisateur (contrôle d'appartenance). */
export const medicalProofFolder = (userId: string) => `charity-proofs/${userId}`

/** La référence appartient-elle bien à un justificatif envoyé par cet utilisateur ? */
export function isOwnMedicalProofRef(ref: string, userId: string): boolean {
  return ref.startsWith(`${KYC_REF_PREFIX}image/${medicalProofFolder(userId)}/`)
}

const ApplySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  contactEmail: z.string().trim().toLowerCase().email().max(200),
  contactPhone: z.string().trim().min(6).max(30),
  address: z.string().trim().max(300).optional(),
  ifu: z.string().trim().max(50).optional(),
  rccmOrReceiptNumber: z.string().trim().min(2).max(100),
})

/** Champs publics d'une ONG agréée (jamais les pièces ni les coordonnées privées du dossier). */
export const PUBLIC_PARTNER_ORG_SELECT = {
  id: true,
  name: true,
  description: true,
  logoUrl: true,
} as const

export default async function charitiesRoutes(app: FastifyInstance) {
  // ── Demande d'agrément ──────────────────────────────────────────────────
  app.post('/apply', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    // Un seul dossier en cours d'examen à la fois par demandeur
    const pending = await app.prisma.partnerOrg.findFirst({
      where: { applicantId: sub, kycStatus: 'PENDING' },
      select: { id: true },
    })
    if (pending) {
      return reply.code(409).send({ error: 'Une demande est déjà en cours d\'examen.', code: 'APPLICATION_PENDING' })
    }

    let form
    try {
      form = await readDocumentsForm(req, {
        folder: `charities/${sub}`,
        documentFields: CHARITY_DOC_FIELDS,
        publicFields: ['logo'],
      })
    } catch (e) {
      if (e instanceof DocumentUploadError) return reply.code(400).send({ error: documentErrorMessage(e), code: e.code })
      throw e
    }

    const parsed = ApplySchema.safeParse(form.fields)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Informations invalides', details: parsed.error.issues.map((i) => i.path.join('.')) })
    }
    const missing = CHARITY_REQUIRED_DOCS.filter((d) => !form.documents[d])
    if (missing.length > 0) {
      return reply.code(400).send({ error: 'Pièces obligatoires manquantes', code: 'MISSING_DOCUMENTS', missing })
    }

    const org = await app.prisma.partnerOrg.create({
      data: {
        ...parsed.data,
        applicantId: sub,
        logoUrl: form.publicFiles.logo ?? null,
        documentsUrls: form.documents,
      },
      select: { id: true, name: true, kycStatus: true, createdAt: true },
    })
    return reply.code(201).send({ data: org })
  })

  // ── Mes demandes ────────────────────────────────────────────────────────
  app.get('/mine', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const orgs = await app.prisma.partnerOrg.findMany({
      where: { applicantId: sub },
      select: { id: true, name: true, logoUrl: true, kycStatus: true, rejectionReason: true, createdAt: true, reviewedAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: orgs })
  })

  // ── ONG agréées (sélecteur) ─────────────────────────────────────────────
  app.get('/approved', { preHandler: [app.authenticate] }, async (_req, reply) => {
    const orgs = await app.prisma.partnerOrg.findMany({
      where: { kycStatus: 'VERIFIED', isEligibleForFundraisers: true },
      select: PUBLIC_PARTNER_ORG_SELECT,
      orderBy: { name: 'asc' },
    })
    return reply.send({ data: orgs })
  })

  // ── Justificatif médical (privé) ────────────────────────────────────────
  app.post('/medical-proof', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    if (!(await isKycVerified(app.prisma, sub))) {
      return reply.code(403).send({ error: 'Vérification requise', code: 'KYC_REQUIRED' })
    }
    let form
    try {
      form = await readDocumentsForm(req, { folder: medicalProofFolder(sub), documentFields: ['proof'] })
    } catch (e) {
      if (e instanceof DocumentUploadError) return reply.code(400).send({ error: documentErrorMessage(e), code: e.code })
      throw e
    }
    const ref = form.documents.proof
    if (!ref) return reply.code(400).send({ error: 'Aucun fichier fourni', code: 'MISSING_DOCUMENTS' })
    return reply.code(201).send({ ref })
  })
}
