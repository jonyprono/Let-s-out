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
  coHostIds?: string[]
  address?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  startAt: string
  endAt: string
  tags: string[]
  viewCount: number
  createdAt: string
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
  poolCollected?: number
  poolReleased?: boolean
  _count?: { bookings: number }
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
  address?: string
  city?: string
  country?: string
  latitude?: number
  longitude?: number
  startAt: string
  endAt: string
  tags?: string[]
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
    apiClient.get<{ id: string; status: string; totalPaid: number; createdAt: string }>(`/events/${id}/my-booking`),

  /** Invite friends to an event */
  inviteFriends: (id: string, userIds: string[]) =>
    apiClient.post(`/events/${id}/invite`, { userIds }),

  /** Get pending bookings for an event (organizer only) */
  getPendingBookings: (id: string) =>
    apiClient.get<{ data: any[] }>(`/events/${id}/bookings/pending`),

  /** Approve a pending booking */
  approveBooking: async (eventId: string, bookingId: string) => {
    return apiClient.patch(`/events/${eventId}/bookings/${bookingId}/approve`)
  },
  rejectBooking: async (eventId: string, bookingId: string) => {
    return apiClient.patch(`/events/${eventId}/bookings/${bookingId}/reject`)
  },
  
  // Reviews
  addReview: async (eventId: string, rating: number, comment?: string) => {
    return apiClient.post(`/events/${eventId}/reviews`, { rating, comment })
  },
  getReviews: async (eventId: string) => {
    return apiClient.get(`/events/${eventId}/reviews`)
  },
  
  // Pool Release
  releasePool: async (eventId: string) => {
    return apiClient.post(`/events/${eventId}/pool/release`)
  }
}
