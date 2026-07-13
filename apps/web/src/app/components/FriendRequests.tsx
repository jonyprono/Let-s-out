import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Check, X, Loader2, Users, Search } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { SafeImage } from '@/components/shared/SafeImage'

interface FriendRequest {
  id: string
  initiatorId: string
  receiverId: string
  status: string
  createdAt: string
  initiator: {
    id: string
    profile?: {
      username: string
      displayName: string
      avatarUrl?: string
      bio?: string
    }
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "À l'instant"
  if (min < 60) return `Il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Il y a ${h}h`
  return format(new Date(dateStr), 'd MMM', { locale: fr })
}

export function FriendRequests() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { openUserProfile } = useUserProfile()
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: FriendRequest[] }>('/users/me/friend-requests')
      return res.data.data
    },
  })

  const requests = data ?? []

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) =>
      apiClient.patch(`/users/friend-requests/${friendshipId}/accept`),
    onSuccess: () => {
      toast.success('Demande acceptée ! Vous êtes maintenant amis 🎉')
      qc.invalidateQueries({ queryKey: ['friend-requests'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['users', 'friends'] })
    },
    onError: () => toast.error("Impossible d'accepter la demande."),
    onSettled: () => setProcessingId(null),
  })

  const handleAccept = (friendshipId: string) => {
    setProcessingId(friendshipId)
    acceptMutation.mutate(friendshipId)
  }

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests
    return requests.filter(req => {
      const p = req.initiator?.profile
      const searchStr = searchQuery.toLowerCase()
      return (
        p?.displayName?.toLowerCase().includes(searchStr) ||
        p?.username?.toLowerCase().includes(searchStr)
      )
    })
  }, [requests, searchQuery])

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">

      {/* Header */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-safe-6 pb-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Demandes d'amis</h1>
          {requests.length > 0 && (
            <p className="text-xs text-gray-400">{requests.length} demande{requests.length > 1 ? 's' : ''} en attente</p>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {requests.length > 0 && (
        <div className="bg-white dark:bg-[#1A1A1A] px-5 pb-3 border-b border-gray-100 dark:border-white/10">
          <div className="flex bg-gray-100 dark:bg-[#222] rounded-full px-4 py-2.5 items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une demande..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none flex-1 text-gray-900 dark:text-white text-[15px] placeholder-gray-400"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg w-1/2" />
                </div>
                <div className="flex gap-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div
              className="w-20 h-20 rounded-2xl mb-5 flex items-center justify-center"
              style={{ background: 'rgba(151,71,255,0.08)' }}
            >
              <Users className="w-10 h-10" style={{ color: '#FF7A00' }} />
            </div>
            <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Aucune demande en attente</h3>
            <p className="text-[13px] text-gray-400 leading-relaxed max-w-xs">
              Lorsqu'un utilisateur vous envoie une demande d'ami, elle apparaîtra ici.
            </p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-[14px]">
            Aucune demande trouvée pour "{searchQuery}"
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredRequests.map(req => {
              const profile = req.initiator?.profile
              const displayName = profile?.displayName || 'Utilisateur'
              const username = profile?.username
              const avatar = profile?.avatarUrl
              const isProcessing = processingId === req.id

              return (
                <div
                  key={req.id}
                  onClick={() => openUserProfile(req.initiator.id, { displayName, avatarUrl: avatar })}
                  className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#2a2a2a] border border-gray-100 dark:border-white/10 relative">
                    <SafeImage
                      src={avatar}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      fallback={
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ background: 'linear-gradient(135deg, #FF7A00, #FF7A00)' }}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      }
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                          onClick={() => {
                            // Simply remove from local view (optimistic)
                            toast.info('Demande ignorée')
                            qc.setQueryData<FriendRequest[]>(['friend-requests'], old =>
                              old ? old.filter(r => r.id !== req.id) : []
                            )
                          }}
                          className="w-10 h-10 !p-0 rounded-full flex items-center justify-center"
                          title="Ignorer"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

