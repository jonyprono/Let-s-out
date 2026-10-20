import { apiClient } from '@/lib/api-client'

export interface RadarVisibilityStatus {
  isVisible: boolean
  durationMinutes: number | null
  remainingSeconds: number
  expiresAt: string | null
  outingType: string | null
}

export interface RadarSearchResult {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
  isVerified: boolean
  gender: string | null
  outingType: string | null
  proximity: string
  inviteStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null
  canInvite: boolean
}

export interface RadarInviteItem {
  id: string
  senderId: string
  receiverId: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  outingType: string | null
  message: string | null
  expiresAt: string
  createdAt: string
  sender: {
    id: string
    isVerified: boolean
    profile: {
      displayName: string
      username: string
      avatarUrl: string | null
      kycStatus?: string | null
    } | null
  }
  receiver: {
    id: string
    isVerified: boolean
    profile: {
      displayName: string
      username: string
      avatarUrl: string | null
      kycStatus?: string | null
    } | null
  }
}

export const radarApi = {
  getStatus: () =>
    apiClient.get<{ data: RadarVisibilityStatus }>('/radar/status').then((res) => res.data.data),

  setVisibility: (data: {
    isVisible: boolean
    durationMinutes?: 30 | 60
    outingType?: string
    latitude?: number
    longitude?: number
  }) =>
    apiClient.post<{ data: RadarVisibilityStatus }>('/radar/visibility', data).then((res) => res.data.data),

  search: (params: {
    latitude: number
    longitude: number
    radiusKm: number
    gender?: 'ALL' | 'FEMALE' | 'MALE'
    verifiedOnly?: boolean
    outingType?: string
  }) =>
    apiClient.post<{ data: RadarSearchResult[] }>('/radar/search', params).then((res) => res.data.data),

  sendInvite: (data: { receiverId: string; outingType?: string; message?: string }) =>
    apiClient.post<{ data: RadarInviteItem }>('/radar/invites', data).then((res) => res.data.data),

  getInvites: () =>
    apiClient.get<{ data: RadarInviteItem[] }>('/radar/invites').then((res) => res.data.data),

  respondInvite: (id: string, action: 'ACCEPT' | 'DECLINE') =>
    apiClient
      .patch<{ data: RadarInviteItem & { conversationId?: string } }>(`/radar/invites/${id}/respond`, { action })
      .then((res) => res.data.data),
}
