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

export interface PollVote {
  id: string
  optionId: string
  userId: string
  createdAt: string
  user?: {
    id: string
    profile?: {
      displayName: string
      avatarUrl?: string | null
    } | null
  }
}

export interface PollOption {
  id: string
  pollId: string
  text: string
  order: number
  votes: PollVote[]
}

export interface Poll {
  id: string
  messageId: string
  question: string
  allowMultiple: boolean
  expiresAt: string | null
  isClosed: boolean
  createdAt: string
  updatedAt: string
  options: PollOption[]
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
  poll?: Poll | null
  sender?: {
    id?: string
    profile?: {
      username: string
      displayName: string
      avatarUrl: string | null
    }
  }
  replyToId?: string | null
  replyTo?: {
    id: string
    content: string | null
    type: string
    sender?: {
      profile?: {
        displayName: string
        avatarUrl: string | null
      }
    }
  } | null
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

  /** Discussions OUT RADAR uniquement (exclues de la liste par défaut). */
  getRadarConversations: async (): Promise<Conversation[]> => {
    const { data } = await apiClient.get('/chat/conversations', { params: { onlyRadar: 'true' } })
    return data.data
  },

  getConversation: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get(`/chat/conversations/${id}`)
    return data
  },

  getMessages: async (conversationId: string, limit = 30): Promise<Message[]> => {
    const { data } = await apiClient.get(`/chat/conversations/${conversationId}/messages`, {
      params: { limit },
    })
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

  createPoll: async (
    conversationId: string,
    payload: {
      question: string
      options: string[]
      allowMultiple?: boolean
      durationDays?: number | null
    }
  ): Promise<Message> => {
    const { data } = await apiClient.post(`/chat/conversations/${conversationId}/polls`, payload)
    return data.data
  },

  votePoll: async (pollId: string, optionId: string): Promise<Poll> => {
    const { data } = await apiClient.post(`/chat/polls/${pollId}/vote`, { optionId })
    return data.data
  },
}

export function useConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations'],
    queryFn: chatApi.getConversations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/** Clé sous ['chat', 'conversations'] : invalidée avec la liste principale. */
export function useRadarConversations() {
  return useQuery({
    queryKey: ['chat', 'conversations', 'radar'],
    queryFn: chatApi.getRadarConversations,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Met à jour l'aperçu (dernier message), la date et le compteur non lus d'une conversation
 * dans les listes en cache, sans attendre le refetch serveur.
 * - Message de l'utilisateur courant → unread = 0 (il vient d'écrire, donc d'avoir lu).
 * - Message reçu → unread + 1, sauf si la discussion est ouverte à l'écran.
 */
export function applyMessageToConversationLists(
  qc: ReturnType<typeof useQueryClient>,
  msg: Message,
  currentUserId: string | undefined,
) {
  const isOwnMessage = msg.senderId === currentUserId
  const isOpen = typeof window !== 'undefined' && window.location.pathname === `/chat/${msg.conversationId}`
  qc.setQueriesData<Conversation[]>({ queryKey: ['chat', 'conversations'] }, (old) => {
    if (!Array.isArray(old)) return old
    return old.map((c: any) => {
      if (c.id !== msg.conversationId) return c
      if (c.messages?.[0]?.id === msg.id) return c // déjà appliqué
      return {
        ...c,
        messages: [msg, ...(c.messages ?? [])].slice(0, 1),
        lastMessageAt: msg.createdAt,
        unread: isOwnMessage || isOpen ? 0 : (c.unread ?? 0) + 1,
      }
    })
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

function sortMessagesNewestFirst(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export function useConversationMessages(conversationId: string) {
  return useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatApi.getMessages(conversationId).then(sortMessagesNewestFirst),
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

  // Track the last optimistic ID so we can swap it on success
  let optimisticId = ''

  return useMutation({
    mutationFn: (payload: { content: string; type?: string; mediaUrl?: string; replyToId?: string; caption?: string; _replyTo?: Message | null }) => {
      const { _replyTo: _ignored, ...rest } = payload as any
      return chatApi.sendMessage(conversationId, rest)
    },
    onMutate: async (payload) => {
      // Cancel in-flight queries
      await qc.cancelQueries({ queryKey: ['chat', 'messages', conversationId] })
      // Snapshot previous value
      const prev = qc.getQueryData<Message[]>(['chat', 'messages', conversationId])
      // Build optimistic message
      optimisticId = `optimistic-${Date.now()}`
      const optimisticMsg: Message = {
        id: optimisticId,
        content: payload.content,
        type: (payload.type as any) || 'TEXT',
        senderId: user?.id || '',
        conversationId,
        createdAt: new Date().toISOString(),
        isDeleted: false,
        reactions: [],
        mediaUrl: payload.mediaUrl || null,
        replyToId: payload.replyToId || null,
        replyTo: (payload as any)._replyTo || null,
        sender: {
          id: user?.id,
          profile: {
            username: user?.profile?.username || '',
            displayName: user?.profile?.displayName || '',
            avatarUrl: user?.profile?.avatarUrl || null,
          },
        },
        _optimistic: true,
      } as any
      // Prepend so the newest message is at index 0 (bottom of flex-col-reverse)
      qc.setQueryData<Message[]>(['chat', 'messages', conversationId], (old = []) => [
        optimisticMsg,
        ...old,
      ])
      // Aperçu immédiat dans la liste des conversations
      applyMessageToConversationLists(qc, optimisticMsg, user?.id)
      return { prev, optimisticId }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(['chat', 'messages', conversationId], context.prev)
      }
      // Annule l'aperçu optimiste de la liste
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
    onSuccess: (serverMsg, _vars, context) => {
      // Swap optimistic entry with real server message — no refetch, no flash
      qc.setQueryData<Message[]>(['chat', 'messages', conversationId], (old = []) =>
        old.map((m) => {
          if ((m as any)._optimistic && m.id === (context?.optimisticId ?? optimisticId)) {
            return {
              ...serverMsg,
              _optimistic: false,
              // Preserve replyTo from optimistic if server didn't return it
              replyTo: serverMsg.replyTo ?? m.replyTo ?? null,
            }
          }
          return m
        })
      )
      // Silently refresh conversation list in background (badge, last message preview)
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })
}

