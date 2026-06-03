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
      className="absolute inset-0 z-[60] flex items-end justify-center animate-in fade-in duration-200"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      {/* Sheet */}
      <div
        className="w-full max-w-md bg-white rounded-t-[32px] overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-2xl"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-6">
          <h2 className="text-[20px] font-bold text-gray-900 tracking-tight">Participant</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto pb-safe-4" style={{ maxHeight: 'calc(85vh - 80px)', scrollbarWidth: 'none', paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
          {/* Profile Content */}
          <div className="px-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-[88px] h-[88px] rounded-full bg-gray-100 overflow-hidden mb-4 shadow-sm border border-gray-50">
                <SafeImage
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center text-[32px] font-bold text-gray-400">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  }
                />
              </div>
              <h2 className="text-[22px] font-bold text-gray-900 truncate mb-1 text-center tracking-tight">{displayName}</h2>
              {memberSince && (
                <p className="text-[14px] text-gray-500 font-medium mb-3">Membre depuis {memberSince}</p>
              )}
              {profile?.bio ? (
                <p className="text-[15px] text-gray-600 leading-relaxed text-center max-w-[280px]">{profile.bio}</p>
              ) : (
                <p className="text-[14px] text-gray-400 italic text-center">Aucune biographie renseignée.</p>
              )}
            </div>

            {/* Loading skeleton */}
            {isLoading && !profile && (
              <div className="space-y-3 animate-pulse flex flex-col items-center mt-6">
                <div className="h-4 bg-gray-100 rounded w-48" />
                <div className="h-4 bg-gray-100 rounded w-32" />
              </div>
            )}
          </div>

          {/* Actions — not shown for self */}
          {!isMe && (
            <div className="px-6 pb-4 mt-2 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleMessage}
                  className="flex-1 flex items-center justify-center gap-2 py-[14px] rounded-full border border-gray-200 bg-white text-gray-800 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
                >
                  <MessageCircle className="w-4 h-4 text-gray-700" />
                  Message
                </button>

                <button
                  onClick={() => {
                    onClose()
                    navigate(`/profile/${profile?.username || profile?.userId || userId}`)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-[14px] rounded-full border border-gray-200 bg-white text-gray-800 font-bold text-[14px] active:scale-95 transition-transform shadow-sm"
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
                  className="w-full flex items-center justify-center gap-2 py-[14px] rounded-full bg-action-primary text-white font-bold text-[15px] active:scale-95 transition-transform shadow-md shadow-orange-500/20"
                >
                  {sendFriendMutation.isPending
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <UserPlus className="w-5 h-5" />}
                  Ajouter en ami
                </button>
              )}
              {friendStatus === 'pending_sent' && (
                <div className="w-full flex items-center justify-center gap-2 py-[14px] rounded-full border border-gray-200 bg-gray-50 text-gray-500 font-bold text-[15px]">
                  <UserCheck className="w-5 h-5" />
                  Demande envoyée
                </div>
              )}
              {friendStatus === 'friend' && (
                <div className="w-full flex items-center justify-center gap-2 py-[14px] rounded-full border border-green-200 bg-green-50 text-green-600 font-bold text-[15px]">
                  <UserCheck className="w-5 h-5" />
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
