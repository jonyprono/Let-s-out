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
  privacy: 'PUBLIC' | 'PARTICIPANTS' | 'PRIVATE'
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
  _count?: {
    reactions: number
    comments: number
  }
  reactions?: { emoji: string }[]
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
    privacy?: 'PUBLIC' | 'PARTICIPANTS' | 'PRIVATE'
  }): Promise<EventVideo> => {
    const res = await apiClient.post('/videos', payload)
    return res.data.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/videos/${id}`)
  },

  toggleReaction: async (videoId: string, emoji: string = '❤️') => {
    const res = await apiClient.post(`/videos/${videoId}/reactions`, { emoji })
    return res.data
  },

  getComments: async (videoId: string) => {
    const res = await apiClient.get(`/videos/${videoId}/comments`)
    return res.data.data
  },

  postComment: async (videoId: string, content: string) => {
    const res = await apiClient.post(`/videos/${videoId}/comments`, { content })
    return res.data.data
  },

  deleteComment: async (videoId: string, commentId: string) => {
    await apiClient.delete(`/videos/${videoId}/comments/${commentId}`)
  }
}

/** Formate une durée en secondes → "1:23" ou "1:02:34" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
