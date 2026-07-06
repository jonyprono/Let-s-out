import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body: string
  isRead: boolean
  data: any
  createdAt: string
  updatedAt: string
}

export interface NotificationsResponse {
  data: Notification[]
  unreadCount: number
}

export const notificationsApi = {
  getNotifications: async (limit = 30, offset = 0, unreadOnly = false): Promise<NotificationsResponse> => {
    const { data } = await apiClient.get('/notifications', { params: { limit, offset, unreadOnly } })
    return data
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.patch(`/notifications/${id}/read`)
    return data
  },

  markAllAsRead: async () => {
    const { data } = await apiClient.patch('/notifications/read-all')
    return data
  },
}

export function useNotifications(limit = 30, unreadOnly = false) {
  return useQuery({
    queryKey: ['notifications', { limit, unreadOnly }],
    queryFn: () => notificationsApi.getNotifications(limit, 0, unreadOnly),
  })
}

export function useMarkNotificationAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllNotificationsAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onMutate: () => {
      qc.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          unreadCount: 0,
          data: old.data ? old.data.map((n: any) => ({ ...n, isRead: true })) : []
        };
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
