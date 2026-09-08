import { apiClient } from '@/lib/api-client'

export interface EventVideo {
  id: string
  userId: string
  eventId: string
  url: string
  thumbnailUrl?: string
  title: string
  category: string
  duration: number
  isActive: boolean
  createdAt: string
  user: {
    id: string
    profile?: { displayName: string; avatarUrl?: string | null; username: string }
  }
  event: {
    id: string
    title: string
    category: string
    startAt: string
    endAt: string
    coverUrl?: string
    city?: string
  }
}

interface ListParams {
  category?: string
  userId?: string
  eventId?: string
  timeline?: 'past' | 'upcoming'
  limit?: number
  cursor?: string
}

export const videosApi = {
  list: async (params: ListParams = {}): Promise<{ data: EventVideo[]; meta: { total: number; nextCursor: string | null } }> => {
    const res = await apiClient.get('/videos', { params })
    return res.data
  },

  create: async (payload: {
    eventId: string
    url: string
    title: string
    category: string
    duration: number
  }): Promise<EventVideo> => {
    const res = await apiClient.post('/videos', payload)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/videos/${id}`)
  },
}

/** Formate une durée en secondes → "1:23" ou "1:02:34" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
