import { useQuery, useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface Friend {
  userId: string
  friendshipId: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface UserSearchItem {
  id: string
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export const usersApi = {
  searchUsers: async (q: string): Promise<UserSearchItem[]> => {
    const { data } = await apiClient.get('/users/search', { params: { q } })
    return data.data
  },

  getFriends: async (userId?: string): Promise<Friend[]> => {
    const url = userId ? `/users/${userId}/friends` : '/users/me/friends'
    const { data } = await apiClient.get(url)
    return data.data
  },

  sendFriendRequest: async (userId: string) => {
    const { data } = await apiClient.post(`/users/${userId}/friend-request`)
    return data
  },

  acceptFriendRequest: async (friendshipId: string) => {
    const { data } = await apiClient.patch(`/users/friend-requests/${friendshipId}/accept`)
    return data
  },

  updateProfile: async (payload: Partial<{ displayName: string, bio: string, city: string, country: string, interests: string[], avatarUrl: string }>) => {
    const { data } = await apiClient.patch('/users/me/profile', payload)
    return data
  },

  followUser: async (userId: string) => {
    const { data } = await apiClient.post(`/users/${userId}/follow`)
    return data
  },

  unfollowUser: async (userId: string) => {
    const { data } = await apiClient.delete(`/users/${userId}/follow`)
    return data
  },

  blockUser: async (userId: string) => {
    const { data } = await apiClient.post(`/users/${userId}/block`)
    return data
  },

  unblockUser: async (userId: string) => {
    const { data } = await apiClient.post(`/users/${userId}/unblock`)
    return data
  },

  reportUser: async (userId: string, reason: string) => {
    const { data } = await apiClient.post(`/users/${userId}/report`, { reason })
    return data
  },

  getActivity: async (userId: string) => {
    const { data } = await apiClient.get(`/users/${userId}/activity`)
    return data
  },

  getById: async (userId: string) => {
    const { data } = await apiClient.get(`/users/by-id/${userId}`)
    return data
  },
  getFollowers: async (userId: string) => {
    const { data } = await apiClient.get(`/users/${userId}/followers`)
    return data.data
  },

  getFollowing: async (userId: string) => {
    const { data } = await apiClient.get(`/users/${userId}/following`)
    const items = Array.isArray(data?.data) ? data.data : []

    // Fallback: If backend hasn't been redeployed yet and only returns users,
    // fetch followed pages via /pages to ensure they are visible immediately
    const hasPages = items.some((i: any) => i.isPage || i.type === 'page')
    if (!hasPages) {
      try {
        const pagesRes = await apiClient.get('/pages?limit=100')
        const followedPages = (pagesRes.data?.data || [])
          .filter((p: any) => p.isFollowing)
          .map((p: any) => ({
            userId: p.id,
            username: p.name,
            displayName: p.name,
            avatarUrl: p.avatarUrl,
            category: p.category,
            type: 'page' as const,
            isPage: true,
          }))
        if (followedPages.length > 0) {
          return [...items, ...followedPages]
        }
      } catch {
        // Fallback failed silently, return original items
      }
    }

    return items
  }
}

export function useFriends() {
  return useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
  })
}

export function useSearchUsers(q: string) {
  return useQuery({
    queryKey: ['users', 'search', q],
    queryFn: () => usersApi.searchUsers(q),
    enabled: q.length > 1,
  })
}

export function useSendFriendRequest() {
  return useMutation({
    mutationFn: usersApi.sendFriendRequest,
    onSuccess: () => {
      // Invalidate queries or optimistic update
    }
  })
}
