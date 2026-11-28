import { apiClient } from '@/lib/api-client'

export type OrgStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type PageReviewStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'
export type PageBadge = 'BLUE' | 'GOLD'

export interface AdminApplicant {
  id: string
  email: string | null
  phone: string | null
  profile: { displayName: string; username: string; avatarUrl: string | null; kycStatus: string | null } | null
}

export interface AdminCharityItem {
  id: string
  name: string
  logoUrl: string | null
  contactEmail: string
  contactPhone: string
  kycStatus: OrgStatus
  isEligibleForFundraisers: boolean
  createdAt: string
  reviewedAt: string | null
  applicant: AdminApplicant
  _count: { events: number }
}

export interface AdminCharityDetail extends AdminCharityItem {
  description: string | null
  address: string | null
  ifu: string | null
  rccmOrReceiptNumber: string
  rejectionReason: string | null
  /** Liens signés expirants (10 min) */
  documents: Record<string, string | null>
}

export interface AdminPageVerificationItem {
  id: string
  entityType: string
  status: PageReviewStatus
  badge: PageBadge | null
  createdAt: string
  reviewedAt: string | null
  page: { id: string; name: string; avatarUrl: string | null; category: string; verificationStatus: string }
  submittedBy: AdminApplicant
}

export interface AdminPageVerificationDetail extends AdminPageVerificationItem {
  rejectionReason: string | null
  page: AdminPageVerificationItem['page'] & {
    description: string | null
    coverUrl: string | null
    createdAt: string
    _count: { followers: number; posts: number }
  }
  documents: Record<string, string | null>
}

export const verificationsAdminApi = {
  charities: (status?: OrgStatus) =>
    apiClient.get<{ data: AdminCharityItem[] }>('/admin/charities', { params: { status } }).then((r) => r.data.data),
  charity: (id: string) =>
    apiClient.get<AdminCharityDetail>(`/admin/charities/${id}`).then((r) => r.data),
  approveCharity: (id: string) =>
    apiClient.post(`/admin/charities/${id}/approve`).then((r) => r.data),
  rejectCharity: (id: string, reason: string) =>
    apiClient.post(`/admin/charities/${id}/reject`, { reason }).then((r) => r.data),

  pageRequests: (status?: PageReviewStatus) =>
    apiClient.get<{ data: AdminPageVerificationItem[] }>('/admin/pages/verifications', { params: { status } }).then((r) => r.data.data),
  pageRequest: (id: string) =>
    apiClient.get<AdminPageVerificationDetail>(`/admin/pages/verifications/${id}`).then((r) => r.data),
  reviewPage: (id: string, body: { action: 'approve' } | { action: 'reject'; reason: string }) =>
    apiClient.patch(`/admin/pages/verifications/${id}`, body).then((r) => r.data),
}
