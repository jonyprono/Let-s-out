import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'

export interface ConversationMember {
  userId: string
  isAdmin: boolean
  mutedUntil?: string | null
  lastReadAt?: string | null
  lastDeliveredAt?: string | null
  user?: {
    profile?: {
      displayName: string
      avatarUrl: string | null
      username: string
    }
  }
}

export interface Conversation {
  id: string
  name: string | null
  isGroup: boolean
  avatarUrl: string | null
  lastMessageAt: string | null
  eventId: string | null
  blockStatus?: 'none' | 'i_blocked' | 'they_blocked'
  members: ConversationMember[]
  messages: Message[]
}

export interface MessageReaction {
  id: string
  messageId: string
  userId: string
  emoji: string
  user?: {
    id: string
    profile?: { displayName: string }
  }
}

export interface Message {
  id: string
  content: string | null
  mediaUrl?: string | null
  type: string
  senderId: string
  conversationId: string
  createdAt: string
  isDeleted?: boolean
  reactions?: MessageReaction[]
  sender?: {
    id?: string
    profile?: {
      username: string
      displayName: string
      avatarUrl: string | null
    }
  }
}

export const chatApi = {
  getPresence: async (id: string): Promise<{ onlineCount: number; isOtherOnline: boolean; totalMembers: number }> => {
    const { data } = await apiClient.get(`/chat/conversations/${id}/presence`)
    return data
  },
  getConversations: async (): Promise<Conversation[]> => {
    const { data } = await apiClient.get('/chat/conversations')
    return data.data
  },

  getConversation: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get(`/chat/conversations/${id}`)
    return data
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    const { data } = await apiClient.get(`/chat/conversations/${conversationId}/messages`)
    return data.data
  },

  uploadMedia: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post('/chat/upload', formData)
    return data.url
  },

  sendMessage: async (conversationId: string, payload: { content: string, type?: string, mediaUrl?: string, replyToId?: string, caption?: string }) => {
    const { data } = await apiClient.post(`/chat/conversations/${conversationId}/messages`, payload)
    return data
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await apiClient.delete(`/chat/messages/${messageId}`)
  },

  createDM: async (userId: string): Promise<Conversation> => {
    const { data } = await apiClient.post('/chat/conversations/dm', { userId })
    return data
  },

  createGroup: async (name: string, memberIds: string[]): Promise<Conversation> => {
    const { data } = await apiClient.post('/chat/conversations/group', { name, memberIds })
    return data
  },

  muteConversation: async (conversationId: string, mutedUntil: string | null): Promise<void> => {
    await apiClient.post(`/chat/conversations/${conversationId}/mute`, { mutedUntil })
  },

  getEventConversation: async (eventId: string): Promise<Conversation> => {
    const { data } = await apiClient.get(`/chat/conversations/by-event/${eventId}`)
    return data
  },

  discoverGroups: async (limit = 10, search?: string): Promise<Conversation[]> => {
    const { data } = await apiClient.get('/chat/conversations/groups/discover', { params: { limit, search } })
    return data.data
  },

  joinGroup: async (groupId: string): Promise<void> => {
    await apiClient.post(`/chat/conversations/${groupId}/join`)
  },

  leaveGroup: async (groupId: string): Promise<void> => {
    await apiClient.delete(`/chat/conversations/${groupId}/leave`)
  },

  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.post(`/chat/conversations/${conversationId}/read`)
  },
}

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatApi.getConversations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: ['chat', 'conversation', conversationId],
    queryFn: () => chatApi.getConversation(conversationId),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useConversationPresence(conversationId: string) {
  return useQuery({
    queryKey: ['chat', 'presence', conversationId],
    queryFn: () => chatApi.getPresence(conversationId),
    enabled: !!conversationId,
    refetchInterval: 15000, // Refresh presence every 15 seconds
  })
}

function sortMessagesChronological(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function useConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatApi.getMessages(conversationId).then(sortMessagesChronological),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache for faster loading
  })
}

export function useDiscoverGroups(limit = 10, search?: string) {
  return useQuery({
    queryKey: ['chat', 'groups', 'discover', limit, search],
    queryFn: () => chatApi.discoverGroups(limit, search),
  })
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: (payload: { content: string; type?: string; mediaUrl?: string; replyToId?: string; caption?: string }) =>
      chatApi.sendMessage(conversationId, payload),
    onMutate: async (payload) => {
      // Cancel in-flight queries
      await qc.cancelQueries({ queryKey: ['chat', 'messages', conversationId] })
      // Snapshot previous value
      const prev = qc.getQueryData<Message[]>(['chat', 'messages', conversationId])
      // Optimistically insert message
      const optimisticMsg: Message = {
        id: `optimistic-${Date.now()}`,
        content: payload.content,
        type: (payload.type as any) || 'TEXT',
        senderId: user?.id || '',
        conversationId,
        createdAt: new Date().toISOString(),
        isDeleted: false,
        reactions: [],
        mediaUrl: payload.mediaUrl || null,
        sender: {
          id: user?.id,
          profile: {
            username: '',
            displayName: '',
            avatarUrl: null,
          },
        },
        _optimistic: true,
      } as any
      qc.setQueryData<Message[]>(['chat', 'messages', conversationId], (old = []) => [
        ...old,
        optimisticMsg,
      ])
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['chat', 'messages', conversationId], context.prev)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}
