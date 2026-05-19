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

  getFriends: async (): Promise<Friend[]> => {
    const { data } = await apiClient.get('/users/me/friends')
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

  getActivity: async (userId: string) => {
    const { data } = await apiClient.get(`/users/${userId}/activity`)
    return data
  }
}

export function useFriends() {
  return useQuery({
    queryKey: ['users', 'friends'],
    queryFn: usersApi.getFriends,
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
