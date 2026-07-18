import { apiClient } from '@/lib/api-client'

export interface AuditLog {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  targetType: string | null
  targetId: string | null
  eventId: string | null
  oldValue: any
  newValue: any
  amount: number | null
  ipAddress: string | null
  userAgent: string | null
  comment: string | null
  createdAt: string
}

export interface PayoutRequest {
  id: string
  eventId: string
  requestedBy: string
  amount: number
  status: string
  approvals: string[]
  rejections: string[]
  snapshotVoterIds: string[]
  voteDurationHours: number
  threshold: number
  expiresAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  event?: {
    title: string
    poolCollected: number
    poolWithdrawn: number
  }
}

export const auditAdminApi = {
  getLogs: async (params: { page: number; limit: number; action?: string; eventId?: string }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('page', params.page.toString())
    searchParams.set('limit', params.limit.toString())
    if (params.action) searchParams.set('action', params.action)
    if (params.eventId) searchParams.set('eventId', params.eventId)
    
    const { data } = await apiClient.get<{ data: AuditLog[]; total: number; page: number; pages: number }>(`/admin/audit/logs?${searchParams.toString()}`)
    return data
  },

  getPayouts: async (params: { page: number; limit: number; status?: string }) => {
    const searchParams = new URLSearchParams()
    searchParams.set('page', params.page.toString())
    searchParams.set('limit', params.limit.toString())
    if (params.status) searchParams.set('status', params.status)
    
    const { data } = await apiClient.get<{ data: PayoutRequest[]; total: number; page: number; pages: number }>(`/admin/payouts?${searchParams.toString()}`)
    return data
  },

  forceApprovePayout: async (id: string) => {
    const { data } = await apiClient.post(`/admin/payouts/${id}/force-approve`)
    return data
  },

  rejectPayout: async (id: string, reason: string) => {
    const { data } = await apiClient.post(`/admin/payouts/${id}/reject`, { reason })
    return data
  },

  getExportUrl: () => {
    return `${apiClient.defaults.baseURL}/admin/audit/export`
  }
}
