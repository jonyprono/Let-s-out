import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface ConversationMember {
  userId: string
  isAdmin: boolean
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

  sendMessage: async (conversationId: string, content: string, type: string = 'TEXT'): Promise<Message> => {
    const { data } = await apiClient.post(`/chat/conversations/${conversationId}/messages`, { content, type })
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

  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.post(`/chat/conversations/${conversationId}/read`)
  },
}

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatApi.getConversations,
  })
}

export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: ['chat', 'conversation', conversationId],
    queryFn: () => chatApi.getConversation(conversationId),
    enabled: !!conversationId,
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
  return useMutation({
    mutationFn: ({ content, type }: { content: string; type?: string }) =>
      chatApi.sendMessage(conversationId, content, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}
