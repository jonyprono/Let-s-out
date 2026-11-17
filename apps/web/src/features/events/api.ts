import { apiClient } from '@/lib/api-client'

export interface Event {
  id: string
  creatorId: string
  title: string
  description: string
  category: string
  status: string
  coverUrl?: string
  mediaUrls: string[]
  maxAttendees?: number
  currentAttendees: number
  price: number
  currency: string
  isPrivate: boolean
  requiresApproval: boolean
  showInFeed?: boolean
  showParticipants?: boolean
  allowGuestShare?: boolean
  coHostIds?: string[]
  address?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  startAt: string
  endAt: string
  tags: string[]
  genderRestriction?: 'ANY' | 'MALE' | 'FEMALE'
  viewCount: number
  createdAt: string
  poolDescription?: string
  registrationDeadline?: string
  creator: {
    id: string
    profile?: { 
      username: string; 
      displayName: string; 
      avatarUrl?: string;
      followersCount?: number;
      eventsCount?: number;
    }
  }
  coHosts?: {
    id: string
    profile?: { 
      username: string; 
      displayName: string; 
      avatarUrl?: string;
      followersCount?: number;
      eventsCount?: number;
    }
  }[]
  joinCode?: string
  poolTarget?: number
  poolMode?: 'libre' | 'minimum' | 'fixe'
  poolMinAmount?: number
  payoutRequest?: {
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    approvals: string[]
  }
  poolCollected?: number
  poolReleased?: boolean
  _count?: { bookings: number; comments?: number; reactions?: number }
  reactions?: { emoji: string }[]
  /** Résumé des réactions fourni par GET /events (évite 1 requête /reactions par carte) */
  reactionSummary?: { counts: Record<string, number>; myEmoji: string | null }
  validatorIds?: string[]
  validatorCandidates?: string[]
  validatorVoteStatus?: 'OPEN' | 'CLOSED' | 'NONE'
  validatorThreshold?: number
  expectedValidatorVotes?: number
  validatorVotes?: any[]
}

export interface EventsQuery {
  category?: string
  city?: string
  search?: string
  status?: string
  upcoming?: boolean
  limit?: number
  offset?: number
  maxPrice?: number
  date?: string
  time?: string
  ongoing?: string
  recentlyEnded?: boolean | string
}

export interface CreateEventPayload {
  title: string
  description: string
  category: string
  maxAttendees?: number
  price?: number
  currency?: string
  isPrivate?: boolean
  requiresApproval?: boolean
  showInFeed?: boolean
  showParticipants?: boolean
  allowGuestShare?: boolean
  address?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  startAt: string
  endAt: string
  tags?: string[]
  genderRestriction?: 'ANY' | 'MALE' | 'FEMALE'
  coverUrl?: string
  mediaUrls?: string[]
}

export interface MyTicket {
  bookingRef: string
  qrPayload: string
  checkedInAt: string | null
}

export interface CheckInSuccess {
  result: 'VALID'
  checkedInAt: string
  participant: { name: string; avatarUrl: string | null }
  /** Catégorie du billet (billetterie multi-tarifs) — absent pour les anciens billets */
  tierName?: string | null
}

/** Corps des refus de validation (codes stables, à traduire côté app) */
export interface CheckInError {
  error: string
  code: 'CHECKIN_FORBIDDEN' | 'TICKET_INVALID_FORMAT' | 'TICKET_NOT_FOUND' | 'TICKET_WRONG_EVENT' | 'TICKET_NOT_CONFIRMED' | 'TICKET_ALREADY_USED' | 'EVENT_NOT_FOUND'
  firstCheckedInAt?: string | null
  checkedInBy?: string | null
  participant?: { name: string; avatarUrl: string | null }
  tierName?: string | null
}

export const eventsApi = {
  list: (params?: EventsQuery) =>
    apiClient.get<{ data: Event[]; total: number }>('/events', { params }),

  getRecommended: () =>
    apiClient.get<{ data: Event[]; total: number }>('/events/recommended'),

  getById: (id: string) =>
    apiClient.get<Event>(`/events/${id}`),

  create: (payload: CreateEventPayload) =>
    apiClient.post<Event>('/events', payload),

  update: (id: string, payload: Partial<CreateEventPayload>) =>
    apiClient.patch<Event>(`/events/${id}`, payload),

  cancel: (id: string) =>
    apiClient.delete(`/events/${id}`),

  join: (id: string) =>
    apiClient.post(`/events/${id}/join`),

  leave: (id: string) =>
    apiClient.delete(`/events/${id}/join`),

  getAttendees: (id: string, params?: { limit?: number; offset?: number }) =>
    apiClient.get(`/events/${id}/attendees`, { params }),

  getMyBooking: (id: string) =>
    apiClient.get<{ id: string; status: string; totalPaid: number; createdAt: string; ticketsCount?: number }>(`/events/${id}/my-booking`),

  /** Billet du participant connecté (réservation CONFIRMED) — QR = jeton secret, pas l'id de réservation */
  getMyTicket: (id: string) =>
    apiClient.get<MyTicket>(`/events/${id}/my-ticket`).then((r) => r.data),

  /** Validation à l'entrée (créateur / co-organisateurs). 200 = valide ; 409 = déjà validé / non confirmé */
  checkInTicket: (id: string, qr: string) =>
    apiClient.post<CheckInSuccess>(`/events/${id}/tickets/check-in`, { qr }).then((r) => r.data),

  /** Invite friends to an event */
  inviteFriends: (id: string, userIds: string[]) =>
    apiClient.post(`/events/${id}/invite`, { userIds }),

  /** Get pending bookings for an event (organizer only) */
  getPendingBookings: (id: string) =>
    apiClient.get<{ data: any[] }>(`/events/${id}/pending-requests`),

  /** Approve a pending booking */
  approveBooking: async (eventId: string, bookingId: string) => {
    return apiClient.patch(`/events/${eventId}/bookings/${bookingId}/approve`)
  },
  rejectBooking: async (eventId: string, bookingId: string) => {
    return apiClient.patch(`/events/${eventId}/bookings/${bookingId}/reject`)
  },

  requestRefund: (id: string, reason: string) =>
    apiClient.post(`/events/${id}/pool/refund-request`, { reason }),
  
  // Reviews
  getPendingEvaluations: async () => {
    return apiClient.get<{ data: any[]; total: number }>('/events/pending-evaluations')
  },
  submitReview: async (eventId: string, payload: { rating: number, punctualityRating?: number, attitudeRating?: number, reliabilityRating?: number, comment?: string }) => {
    return apiClient.post(`/events/${eventId}/reviews`, payload)
  },
  getReviews: async (eventId: string) => {
    return apiClient.get(`/events/${eventId}/reviews`)
  },
  
  // Pool Release
  releasePool: async (eventId: string) => {
    return apiClient.post(`/events/${eventId}/payout/request`)
  },
  approvePayout: async (eventId: string) => {
    return apiClient.post(`/events/${eventId}/payout/approve`)
  },

  getPayoutStatus: (eventId: string) => apiClient.get(`/events/${eventId}/payout/status`),
  
  report: (eventId: string, data: { reason: string; description?: string }) => apiClient.post(`/events/${eventId}/report`, data),

  // Upload cover
  uploadCover: async (file: File) => {
    const formData = new FormData()
    formData.append('cover', file)
    return apiClient.post<{ success: boolean; url: string }>('/events/upload-cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
}
