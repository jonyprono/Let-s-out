import { apiClient } from '@/lib/api-client'

export type KycStatus = 'pending' | 'verified' | 'rejected'

export interface KycListItem {
  userId: string
  displayName: string
  username: string
  avatarUrl: string | null
  phone: string | null
  email: string | null
  kycStatus: KycStatus
  kycSubmittedAt: string | null
  kycReviewedAt: string | null
  kycRejectedReason: string | null
  hasDocuments: boolean
}

export interface KycStats {
  pending: number
  approved: number
  rejected: number
  total: number
  recent: KycListItem[]
}

export interface KycDetail extends KycListItem {
  documents: {
    idFront: string | null
    idBack: string | null
    selfie: string | null
    selfieWithId: string | null
  }
  user: {
    id: string
    phone: string | null
    email: string | null
    isVerified: boolean
    createdAt: string
    role: string
  }
}

export interface KycListParams {
  status?: KycStatus
  search?: string
  page?: number
  limit?: number
  sort?: 'newest' | 'oldest'
}

export const kycAdminApi = {
  stats: () => apiClient.get<KycStats>('/admin/kyc/stats').then(r => r.data),

  list: (params: KycListParams) =>
    apiClient.get<{ data: KycListItem[]; total: number; page: number; pages: number }>('/admin/kyc', { params }).then(r => r.data),

  detail: (userId: string) =>
    apiClient.get<KycDetail>(`/admin/kyc/${userId}`).then(r => r.data),

  approve: (userId: string) =>
    apiClient.post(`/admin/kyc/${userId}/approve`).then(r => r.data),

  reject: (userId: string, reason: string) =>
    apiClient.post(`/admin/kyc/${userId}/reject`, { reason }).then(r => r.data),
}
