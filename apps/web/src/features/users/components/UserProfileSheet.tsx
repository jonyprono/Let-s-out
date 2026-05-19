import { X, MessageCircle, UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { usersApi } from '@/features/users/api'
import { useAuthStore } from '@/stores/auth.store'
import { chatApi } from '@/features/chat/api'
import { useNavigate } from 'react-router'
import { SafeImage } from '@/components/shared/SafeImage'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PublicProfile {
  id: string
  userId: string
  username: string
  displayName: string
  bio?: string
  avatarUrl?: string | null
  city?: string
  country?: string
  interests: string[]
  followersCount: number
  eventsCount: number
  createdAt: string
  user?: { id: string; createdAt: string; lastSeenAt?: string }
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friend'
}

interface UserProfileSheetProps {
  /** Pass userId (from DB) OR username */
  userId?: string
  username?: string
  /** Pre-filled data to show immediately while loading */
  preview?: { displayName?: string; avatarUrl?: string | null }
  onClose: () => void
}

export function UserProfileSheet({ userId, username, preview, onClose }: UserProfileSheetProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)

  const isMe = userId ? userId === me?.id : username === me?.profile?.username

  // Fetch profile — by userId or username
  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ['user-profile', userId ?? username],
    queryFn: async () => {
      if (userId) {
        const { data } = await apiClient.get(`/users/by-id/${userId}`)
        return data
      }
      const { data } = await apiClient.get(`/users/${username}`)
      return data
    },
    enabled: !!(userId || username),
  })


  // Fetch activity (used to show member since date)
  const resolvedUserId = profile?.userId || userId
  useQuery({
    queryKey: ['users', 'activity', resolvedUserId],
    queryFn: () => usersApi.getActivity(resolvedUserId!),
    enabled: !!resolvedUserId,
  })

  const sendFriendMutation = useMutation({
    mutationFn: () => apiClient.post(`/users/${profile?.userId || userId}/friend-request`, {}),
    onSuccess: () => {
      toast.success('Demande d\'ami envoyée !')
      qc.invalidateQueries({ queryKey: ['user-profile', userId ?? username] })
      qc.invalidateQueries({ queryKey: ['users', 'friends'] })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error
      if (msg === 'Request already exists') {
        toast.info('Demande déjà envoyée')
        qc.invalidateQueries({ queryKey: ['user-profile', userId ?? username] })
      } else {
        toast.error(msg || 'Erreur')
      }
    },
  })

  const handleMessage = async () => {
    if (!profile) return
    try {
      const targetId = profile.userId || profile.user?.id
      if (!targetId) return
      const conv = await chatApi.createDM(targetId)
      onClose()
      navigate(`/chat/${conv.id}`)
    } catch (e: any) {
      toast.error('Impossible d\'ouvrir la conversation')
    }
  }

  const displayName = profile?.displayName ?? preview?.displayName ?? '...'
  const avatarUrl = profile?.avatarUrl ?? preview?.avatarUrl ?? null
  const memberSince = profile?.user?.createdAt || profile?.createdAt
    ? format(new Date((profile?.user?.createdAt || profile?.createdAt)!), 'MMMM yyyy', { locale: fr })
    : null
  const friendStatus = profile?.friendshipStatus || 'none'

  return (
    /* Overlay */
    <div
      className="absolute inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-md bg-white rounded-t-3xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4">
          <h2 className="text-[17px] font-bold text-gray-900">Participant</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto pb-24" style={{ maxHeight: 'calc(85vh - 60px)', scrollbarWidth: 'none' }}>
          {/* Profile Content */}
          <div className="px-5">
            <div className="flex flex-col items-start mb-4">
              <div className="w-[56px] h-[56px] rounded-full bg-gray-100 overflow-hidden mb-3">
                <SafeImage
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  }
                />
              </div>
              <h2 className="text-[17px] font-bold text-gray-900 truncate mb-1">{displayName}</h2>
              {memberSince && (
                <p className="text-[12px] text-gray-400 mb-1">Membre depuis {memberSince}</p>
              )}
              {profile?.bio ? (
                <p className="text-[14px] text-gray-500 leading-relaxed text-left">{profile.bio}</p>
              ) : (
                <p className="text-[14px] text-gray-400 italic text-left">Aucune biographie renseignée.</p>
              )}
            </div>

            {/* Loading skeleton */}
            {isLoading && !profile && (
              <div className="space-y-3 animate-pulse max-w-[200px] mt-6">
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
              </div>
            )}
          </div>

          {/* Actions — not shown for self */}
          {!isMe && (
            <div className="px-5 pb-4 mt-2 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleMessage}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-gray-200 bg-white text-gray-800 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
                >
                  <MessageCircle className="w-4 h-4 text-gray-700" />
                  Message
                </button>

                <button
                  onClick={() => {
                    onClose()
                    navigate(`/profile/${profile?.username || profile?.userId || userId}`)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full border border-gray-200 bg-white text-gray-800 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
                >
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  Voir profil
                </button>
              </div>

              {/* Friend request button */}
              {friendStatus === 'none' && (
                <button
                  onClick={() => sendFriendMutation.mutate()}
                  disabled={sendFriendMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-[#FF9F1C] text-white font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
                >
                  {sendFriendMutation.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <UserPlus className="w-4 h-4" />}
                  Ajouter en ami
                </button>
              )}
              {friendStatus === 'pending_sent' && (
                <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 font-bold text-[14px]">
                  <UserCheck className="w-4 h-4" />
                  Demande envoyée
                </div>
              )}
              {friendStatus === 'friend' && (
                <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border border-green-200 bg-green-50 text-green-600 font-bold text-[14px]">
                  <UserCheck className="w-4 h-4" />
                  Amis
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
