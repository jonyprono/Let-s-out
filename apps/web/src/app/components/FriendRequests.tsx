import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Check, X, Loader2, Users } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'

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
    },
    onError: () => toast.error("Impossible d'accepter la demande."),
    onSettled: () => setProcessingId(null),
  })

  const handleAccept = (friendshipId: string) => {
    setProcessingId(friendshipId)
    acceptMutation.mutate(friendshipId)
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">

      {/* Header */}
      <div className="bg-white px-5 pt-safe-6 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Demandes d'amis</h1>
          {requests.length > 0 && (
            <p className="text-xs text-gray-400">{requests.length} demande{requests.length > 1 ? 's' : ''} en attente</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
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
            <h3 className="text-[17px] font-bold text-gray-900 mb-2">Aucune demande en attente</h3>
            <p className="text-[13px] text-gray-400 leading-relaxed max-w-xs">
              Lorsqu'un utilisateur vous envoie une demande d'ami, elle apparaîtra ici.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {requests.map(req => {
              const profile = req.initiator?.profile
              const displayName = profile?.displayName || 'Utilisateur'
              const username = profile?.username
              const avatar = profile?.avatarUrl
              const isProcessing = processingId === req.id

              return (
                <div
                  key={req.id}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                >
                  {/* Clickable Area for Profile */}
                  <div 
                    className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => openUserProfile(req.initiatorId, { displayName, avatarUrl: avatar })}
                  >
                    {/* Avatar */}
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xl"
                      style={{ background: 'linear-gradient(135deg, #FF7A00, #FF7A00)' }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] text-gray-900 truncate">{displayName}</p>
                    {username && (
                      <p className="text-[12px] text-gray-400 truncate">@{username}</p>
                    )}
                    {profile?.bio && (
                      <p className="text-[12px] text-gray-500 truncate mt-0.5">{profile.bio}</p>
                    )}
                    <p className="text-[11px] text-gray-300 mt-1">{timeAgo(req.createdAt)}</p>
                  </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-action-primary" />
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(req.id)}
                          className="w-10 h-10 !p-0 rounded-full flex items-center justify-center"
                          title="Accepter"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
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

