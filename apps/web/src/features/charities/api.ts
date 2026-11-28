import { apiClient } from '@/lib/api-client'

/** ONG partenaire agréée (champs publics). */
export interface PartnerOrgPublic {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
}

export type PartnerOrgStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface MyCharityApplication {
  id: string
  name: string
  logoUrl: string | null
  kycStatus: PartnerOrgStatus
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
}

/** Pièces exigées pour l'agrément (ifuDoc facultatif) — doit suivre CHARITY_REQUIRED_DOCS côté API. */
export const CHARITY_REQUIRED_DOCS = ['receipt', 'statutes', 'rib', 'representativeId'] as const
export const CHARITY_OPTIONAL_DOCS = ['ifuDoc'] as const
export type CharityDocField = typeof CHARITY_REQUIRED_DOCS[number] | typeof CHARITY_OPTIONAL_DOCS[number]

/** Formats acceptés pour une pièce (images ou PDF, 10 Mo max — contrôlé aussi côté API). */
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf'
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export const charityKeys = {
  approved: ['charities', 'approved'] as const,
  mine: ['charities', 'mine'] as const,
}

export const charitiesApi = {
  approved: () =>
    apiClient.get<{ data: PartnerOrgPublic[] }>('/charities/approved').then((r) => r.data.data),

  mine: () =>
    apiClient.get<{ data: MyCharityApplication[] }>('/charities/mine').then((r) => r.data.data),

  apply: (form: FormData) =>
    apiClient.post<{ data: { id: string; name: string; kycStatus: PartnerOrgStatus } }>('/charities/apply', form).then((r) => r.data.data),

  /** Envoi privé du justificatif médical ; renvoie la référence à joindre à la création de l'événement. */
  uploadMedicalProof: (file: File) => {
    const form = new FormData()
    form.append('proof', file)
    return apiClient.post<{ ref: string }>('/charities/medical-proof', form).then((r) => r.data.ref)
  },
}
