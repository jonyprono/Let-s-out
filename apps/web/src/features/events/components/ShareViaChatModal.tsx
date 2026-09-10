import { useState, useMemo } from 'react'
import { X, Search, Send, MessageCircle, Users, Calendar, MapPin } from 'lucide-react'
import { useConversations, chatApi } from '@/features/chat/api'
import { useMutation } from '@tanstack/react-query'
import { SafeImage } from '@/components/shared/SafeImage'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface ShareViaChatModalProps {
  event: {
    id: string
    title: string
    coverUrl?: string | null
    startAt: string
    city?: string | null
    description?: string
    price?: number
    currency?: string
    currentAttendees?: number
    maxAttendees?: number | null
  }
  onClose: () => void
}

export function ShareViaChatModal({ event, onClose }: ShareViaChatModalProps) {
  const [search, setSearch] = useState('')
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const { user } = useAuthStore()

  const { data: conversations = [], isLoading } = useConversations()

  const { mutate: shareToChat, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedConvId) return
      // Send a rich JSON payload as SYSTEM message — the chat renderer will display it as an event card
      const cardPayload = JSON.stringify({
        _type: 'EVENT_SHARE',
        eventId: event.id,
        title: event.title,
        coverUrl: event.coverUrl,
        startAt: event.startAt,
        city: event.city,
        price: event.price,
        currency: event.currency,
        currentAttendees: event.currentAttendees,
        maxAttendees: event.maxAttendees,
      })
      await chatApi.sendMessage(selectedConvId, { content: cardPayload, type: 'SYSTEM' })
    },
    onSuccess: () => {
      toast.success('Événement partagé dans la conversation !')
      onClose()
    },
    onError: () => toast.error("Erreur lors du partage"),
  })

  // Get conversation display name and avatar from the perspective of the current user
  const getConvInfo = (conv: any) => {
    if (conv.isGroup) {
      return {
        name: conv.name || 'Groupe',
        avatarUrl: conv.avatarUrl,
        isGroup: true,
        subtitle: `${conv.members?.length || 0} membres`,
      }
    }
    // DM: get the other member
    const other = conv.members?.find((m: any) => m.userId !== user?.id)
    return {
      name: other?.user?.profile?.displayName || 'Utilisateur',
      avatarUrl: other?.user?.profile?.avatarUrl,
      isGroup: false,
      subtitle: `@${other?.user?.profile?.username || ''}`,
    }
  }

  const filtered = useMemo(() => {
    if (!conversations) return []
    return conversations.filter((conv: any) => {
      const info = getConvInfo(conv)
      return info.name.toLowerCase().includes(search.toLowerCase())
    })
  }, [conversations, search])

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-white dark:bg-[#121212]">
      {/* Header */}
      <div className="px-4 pt-safe-4 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-white/8">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Envoyer dans une discussion</h2>
        <div className="w-9" />
      </div>

      {/* Event card preview — what the receiver will see */}
      <div className="mx-4 mt-4 mb-3">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Aperçu de la carte</p>
        <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#1E1E1E]">
          {event.coverUrl && (
            <div className="relative w-full h-28">
              <img src={event.coverUrl} alt={event.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <p className="text-white font-bold text-[14px] truncate drop-shadow">{event.title}</p>
              </div>
            </div>
          )}
          <div className="p-3 flex flex-col gap-1.5">
            {!event.coverUrl && (
              <p className="text-[14px] font-bold text-gray-900 dark:text-white">{event.title}</p>
            )}
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-[#FF7A00]" />
              {format(new Date(event.startAt), "EEE d MMM · HH'h'mm", { locale: fr })}
            </div>
            {event.city && (
              <div className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#FF7A00]" />
                {event.city}
              </div>
            )}
            <div className="mt-1 py-2 rounded-xl bg-[#FF7A00]/10 text-[#FF7A00] text-[12px] font-semibold text-center">
              Voir l'événement →
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une conversation..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-[#2A2A2A] rounded-xl text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-4" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="flex flex-col gap-3 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-[#2A2A2A] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 bg-gray-200 dark:bg-[#2A2A2A] rounded" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-[#2A2A2A] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex items-center justify-center">
              <MessageCircle className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-[14px] text-gray-500 dark:text-gray-400 text-center">
              {search ? 'Aucune conversation trouvée' : 'Aucune conversation disponible'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/6">
            {filtered.map((conv: any) => {
              const info = getConvInfo(conv)
              const isSelected = selectedConvId === conv.id
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(isSelected ? null : conv.id)}
                  className="w-full flex items-center gap-3 py-3 active:bg-gray-50 dark:active:bg-white/5 transition-colors text-left"
                >
                  <div className="relative shrink-0">
                    {info.isGroup ? (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    ) : (
                      <SafeImage
                        src={info.avatarUrl}
                        alt={info.name}
                        className="w-12 h-12 rounded-full bg-gray-200 dark:bg-[#2A2A2A] object-cover"
                      />
                    )}
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#FF7A00] rounded-full flex items-center justify-center border-2 border-white dark:border-[#121212]">
                        <Send className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">{info.name}</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate">{info.subtitle}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${isSelected ? 'border-[#FF7A00] bg-[#FF7A00]' : 'border-gray-300 dark:border-gray-600'}`} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="px-4 pt-3 pb-safe-6">
        <button
          onClick={() => shareToChat()}
          disabled={!selectedConvId || isPending}
          className="w-full py-4 rounded-2xl bg-[#FF7A00] text-white font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              Envoyer dans la discussion
            </>
          )}
        </button>
      </div>
    </div>
  )
}
