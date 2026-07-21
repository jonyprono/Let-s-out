import { ChevronLeft, BellOff, AlertTriangle, Ban, UserPlus, Check, Clock, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from 'react-router'
import { SafeImage } from '@/components/shared/SafeImage'
import { toast } from 'sonner'
import { useState } from 'react'
import { usersApi } from '../api'
import { chatApi } from '@/features/chat/api'
import { ReportModal } from '@/components/shared/ReportModal'

interface PublicProfile {
  id: string
  userId: string
  username: string
  displayName: string
  avatarUrl?: string | null
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friend' | 'blocked'
  user?: { id: string }
}

interface UserProfileSheetProps {
  userId?: string
  username?: string
  preview?: { displayName?: string; avatarUrl?: string | null }
  commonGroup?: { title: string, coverUrl?: string | null }
  onClose: () => void
}

export function UserProfileSheet({ userId, username, preview, commonGroup, onClose }: UserProfileSheetProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)

  const isMe = userId ? userId === me?.id : username === me?.profile?.username

  const { data: profile } = useQuery<PublicProfile>({
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

  const targetUserId = profile?.userId || userId

  const muteMut = useMutation({
    mutationFn: async () => {
      const dm = await chatApi.createDM(targetUserId!)
      await chatApi.muteConversation(dm.id, new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString())
    },
    onSuccess: () => toast.success('Utilisateur mis en sourdine'),
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur')
  })

  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  const reportMut = useMutation({
    mutationFn: async (reason: string) => {
      if (!targetUserId) throw new Error('No user id')
      await usersApi.reportUser(targetUserId, reason)
    },
    onSuccess: () => {
      toast.success('Utilisateur signalé')
      setIsReportModalOpen(false)
    },
    onError: () => toast.error('Erreur lors du signalement')
  })

  const blockMut = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error('No user id')
      await usersApi.blockUser(targetUserId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-profile'] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversation'] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      toast.success('Utilisateur bloqué')
      onClose()
    },
    onError: () => toast.error('Erreur lors du blocage')
  })

  const unblockMut = useMutation({
    mutationFn: async () => {
      if (!targetUserId) throw new Error('No user id')
      await usersApi.unblockUser(targetUserId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-profile'] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversation'] })
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      toast.success('Utilisateur débloqué')
    },
    onError: () => toast.error('Erreur lors du déblocage')
  })

  const sendFriendMutation = useMutation({
    mutationFn: () => apiClient.post(`/users/${targetUserId}/friend-request`, {}),
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

  const displayName = profile?.displayName ?? preview?.displayName ?? '...'
  const avatarUrl = profile?.avatarUrl ?? preview?.avatarUrl ?? null
  const friendStatus = profile?.friendshipStatus || 'none'
  const resolvedUserId = profile?.userId || userId

  const userSvg = (
    <svg width="64" height="64" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_user_info_p)">
        <g clipPath="url(#clip1_user_info_p)">
          <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
          <circle cx="24" cy="16" r="8" fill="#BDBDBD"/>
          <circle cx="24" cy="49" r="22" fill="#BDBDBD"/>
        </g>
      </g>
      <defs>
        <clipPath id="clip0_user_info_p"><rect width="48" height="48" fill="white"/></clipPath>
        <clipPath id="clip1_user_info_p"><rect width="48" height="48" rx="24" fill="white"/></clipPath>
      </defs>
    </svg>
  )

  const groupSvg = (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
      <path d="M27 20C27 21.6568 25.6569 23 24 23C22.3431 23 21 21.6568 21 20C21 18.3432 22.3431 17 24 17C25.6569 17 27 18.3432 27 20Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 16C29.6569 16 31 17.3432 31 19C31 20.2231 30.2681 21.2752 29.2183 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M25.7143 26H22.2857C19.9188 26 18 27.9188 18 30.2857C18 31.2325 18.7675 32 19.7143 32H28.2857C29.2325 32 30 31.2325 30 30.2857C30 27.9188 28.0812 26 25.7143 26Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M29.7143 25C32.0812 25 34 26.9188 34 29.2857C34 30.2325 33.2325 31 32.2857 31" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 16C18.3432 16 17 17.3432 17 19C17 20.2231 17.7319 21.2752 18.7817 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.7143 31C14.7675 31 14 30.2325 14 29.2857C14 26.9188 15.9188 25 18.2857 25" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  return (
    <div className="fixed inset-0 z-[60] bg-white dark:bg-[#1A1A1A] flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
      <div className="flex items-center px-4 py-2 pt-safe-6 sticky top-0 bg-white dark:bg-[#1A1A1A] z-10">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:bg-[#2a2a2a]">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
      </div>

      <div className="flex flex-col items-center px-4 pb-10 gap-6 max-w-md mx-auto w-full">
        {/* Profile Info */}
        <div className="flex flex-col items-center gap-4 w-full mt-4">
          <div className="w-[80px] h-[80px] rounded-full overflow-hidden bg-[#F5F5F5] flex-shrink-0">
            <SafeImage
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              fallback={userSvg}
            />
          </div>
          <div className="flex flex-row items-center gap-2">
            <h2 className="font-poppins font-semibold text-[18px] leading-[22px] text-[#1B1818]">
              {displayName}
            </h2>
            {!isMe && (
              friendStatus === 'friend' ? (
                <div className="flex items-center justify-center p-1">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
              ) : friendStatus === 'pending_sent' ? (
                <div className="flex items-center justify-center p-1">
                  <Clock className="w-5 h-5 text-orange-400" />
                </div>
              ) : (
                <button 
                  onClick={() => sendFriendMutation.mutate()}
                  disabled={sendFriendMutation.isPending}
                  className="flex items-center justify-center p-1 rounded-full hover:bg-gray-100 dark:bg-[#2a2a2a] text-orange-500 active:scale-95 transition-all"
                >
                  <UserPlus className="w-5 h-5" />
                </button>
              )
            )}
          </div>
          <button 
            onClick={() => {
              if (resolvedUserId) {
                onClose()
                navigate(`/profile/${resolvedUserId}`, { 
                  state: { profile: profile || { displayName, avatarUrl, userId: resolvedUserId } } 
                })
              }
            }}
            className="flex flex-row justify-center items-center px-4 py-2 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] rounded-[8px] active:scale-95 transition-transform mt-1"
          >
            <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252]">
              Voir le profil
            </span>
          </button>
        </div>

        {/* Groupes communs */}
        {commonGroup && (
          <div className="flex flex-col items-start gap-2 w-full mt-2">
            <h3 className="font-poppins font-medium text-[12px] leading-[20px] text-[#737373] w-full text-left">
              Groupes communs
            </h3>
            <div className="flex flex-col items-start gap-1 w-full">
              <div className="flex flex-row items-center justify-start py-2 gap-3 w-full rounded-[8px]">
                <div className="w-[32px] h-[32px] rounded-full overflow-hidden bg-[#F5F5F5] flex-shrink-0">
                  <SafeImage
                    src={commonGroup.coverUrl ?? null}
                    alt={commonGroup.title}
                    className="w-full h-full object-cover"
                    fallback={groupSvg}
                  />
                </div>
                <span className="font-['Inter_Display'] font-medium text-[14px] leading-[20px] text-[#525252] text-left">
                  {commonGroup.title}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isMe && (
          <div className="flex flex-col items-start gap-2 w-full mt-4">
            <h3 className="font-poppins font-medium text-[12px] leading-[20px] text-[#737373] w-full text-left">
              Actions
            </h3>
            <div className="flex flex-col items-start gap-1 w-full">
              <button 
                onClick={() => muteMut.mutate()}
                disabled={muteMut.isPending}
                className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 dark:bg-[#2a2a2a] transition-colors"
              >
                <div className="flex items-center justify-center">
                  {muteMut.isPending ? <Loader2 className="w-[18px] h-[18px] animate-spin text-[#737373]" /> : <BellOff className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />}
                </div>
                <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Mettre en sourdine</span>
              </button>
              
              <button 
                onClick={() => setIsReportModalOpen(true)}
                className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 dark:bg-[#2a2a2a] transition-colors"
              >
                <div className="flex items-center justify-center">
                  <AlertTriangle className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
                </div>
                <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Signaler</span>
              </button>

              {friendStatus === 'blocked' ? (
                <button 
                  onClick={() => unblockMut.mutate()}
                  disabled={unblockMut.isPending}
                  className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 dark:bg-[#2a2a2a] transition-colors"
                >
                  <div className="flex items-center justify-center">
                    {unblockMut.isPending ? <Loader2 className="w-[18px] h-[18px] animate-spin text-green-500" /> : <Ban className="w-[18px] h-[18px] text-green-500" strokeWidth={1.5} />}
                  </div>
                  <span className="font-poppins font-medium text-[14px] leading-[20px] text-green-600 text-left">Débloquer</span>
                </button>
              ) : (
                <button 
                  onClick={() => blockMut.mutate()}
                  disabled={blockMut.isPending}
                  className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 dark:bg-[#2a2a2a] transition-colors"
                >
                  <div className="flex items-center justify-center">
                    {blockMut.isPending ? <Loader2 className="w-[18px] h-[18px] animate-spin text-red-500" /> : <Ban className="w-[18px] h-[18px] text-red-500" strokeWidth={1.5} />}
                  </div>
                  <span className="font-poppins font-medium text-[14px] leading-[20px] text-red-500 text-left">Bloquer</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <ReportModal
        open={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onConfirm={(reason) => reportMut.mutate(reason)}
        isPending={reportMut.isPending}
      />
    </div>
  )
}
