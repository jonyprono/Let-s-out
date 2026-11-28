/**
 * Lecture d'un formulaire multipart contenant des pièces justificatives (ONG, certification de page,
 * justificatif médical). Les pièces sont stockées en PRIVÉ (référence Cloudinary authentifiée,
 * lisible uniquement via un lien signé généré pour un admin — voir kycFileUrl).
 */
import path from 'node:path'
import type { FastifyRequest } from 'fastify'
import { uploadKycFile, uploadBufferToCloudinary, kycFileUrl } from './cloudinary.service'

/** Images et PDF uniquement (pièces scannées ou photographiées). */
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/i
const ALLOWED_PUBLIC_MIME = /^image\/(jpeg|png|webp)$/i
/** Taille maximale d'une pièce (10 Mo). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export class DocumentUploadError extends Error {
  constructor(public code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'UNKNOWN_FIELD', public field: string) {
    super(code)
  }
}

export interface ParsedDocumentsForm {
  fields: Record<string, string>
  /** fieldname → référence privée */
  documents: Record<string, string>
  /** fieldname → URL publique (ex. logo) */
  publicFiles: Record<string, string>
}

/**
 * @param documentFields noms de champs autorisés pour les pièces PRIVÉES
 * @param publicFields   noms de champs autorisés pour des images PUBLIQUES (ex. logo)
 */
export async function readDocumentsForm(
  req: FastifyRequest,
  opts: { folder: string; documentFields: readonly string[]; publicFields?: readonly string[] },
): Promise<ParsedDocumentsForm> {
  const fields: Record<string, string> = {}
  const documents: Record<string, string> = {}
  const publicFiles: Record<string, string> = {}
  const publicFields = opts.publicFields ?? []

  for await (const part of req.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = String(part.value ?? '')
      continue
    }
    if (part.type !== 'file') continue
    const isDoc = opts.documentFields.includes(part.fieldname)
    const isPublic = publicFields.includes(part.fieldname)
    if (!isDoc && !isPublic) {
      // Vider le flux pour ne pas bloquer la lecture des parties suivantes
      await part.toBuffer().catch(() => undefined)
      throw new DocumentUploadError('UNKNOWN_FIELD', part.fieldname)
    }
    const allowed = isPublic ? ALLOWED_PUBLIC_MIME : ALLOWED_MIME
    if (!allowed.test(part.mimetype)) {
      await part.toBuffer().catch(() => undefined)
      throw new DocumentUploadError('INVALID_FILE_TYPE', part.fieldname)
    }
    const buffer = await part.toBuffer()
    if (buffer.length > MAX_DOCUMENT_BYTES) throw new DocumentUploadError('FILE_TOO_LARGE', part.fieldname)

    const ext = path.extname(part.filename || '').toLowerCase() || (part.mimetype === 'application/pdf' ? '.pdf' : '.jpg')
    const filename = `${part.fieldname}${ext}`
    if (isPublic) publicFiles[part.fieldname] = await uploadBufferToCloudinary(buffer, opts.folder, filename)
    else documents[part.fieldname] = await uploadKycFile(buffer, opts.folder, filename)
  }

  return { fields, documents, publicFiles }
}

/** Liens signés (expirants) des pièces — À N'APPELER QUE dans une route réservée aux admins. */
export function signedDocumentUrls(stored: unknown): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  if (stored && typeof stored === 'object') {
    for (const [k, v] of Object.entries(stored as Record<string, unknown>)) {
      out[k] = typeof v === 'string' ? kycFileUrl(v) : null
    }
  }
  return out
}

/** Message d'erreur (fr, comme le reste des erreurs API) pour une pièce refusée. */
export function documentErrorMessage(e: DocumentUploadError): string {
  if (e.code === 'FILE_TOO_LARGE') return `Le fichier « ${e.field} » dépasse 10 Mo.`
  if (e.code === 'INVALID_FILE_TYPE') return `Le fichier « ${e.field} » doit être une image (JPG, PNG, WEBP, HEIC) ou un PDF.`
  return `Champ de fichier inattendu : « ${e.field} ».`
}
