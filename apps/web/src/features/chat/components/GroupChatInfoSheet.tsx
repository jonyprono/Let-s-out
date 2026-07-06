import { ChevronLeft, MapPin, CalendarDays, Wallet, BellOff, AlertTriangle, LogOut, UserPlus } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router'
import { Conversation } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { computePoolStats, hasActivePool } from '@/lib/pool-contribution'
import { useAuthStore } from '@/stores/auth.store'
import { useUserProfile } from '@/features/users/UserProfileContext'

interface GroupChatInfoSheetProps {
  conversation: Conversation
  event: any // Adjust type if you have an Event interface
  onClose: () => void
  onInvite: () => void
  onContribute: () => void
}

export function GroupChatInfoSheet({ conversation, event, onClose, onInvite, onContribute }: GroupChatInfoSheetProps) {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { openUserProfile } = useUserProfile()
  
  const poolStats = event && hasActivePool(event) ? computePoolStats(event) : null

  // SVGs for fallbacks
  const groupSvg = (
    <svg width="64" height="64" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
      <path d="M27 20C27 21.6568 25.6569 23 24 23C22.3431 23 21 21.6568 21 20C21 18.3432 22.3431 17 24 17C25.6569 17 27 18.3432 27 20Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M28 16C29.6569 16 31 17.3432 31 19C31 20.2231 30.2681 21.2752 29.2183 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M25.7143 26H22.2857C19.9188 26 18 27.9188 18 30.2857C18 31.2325 18.7675 32 19.7143 32H28.2857C29.2325 32 30 31.2325 30 30.2857C30 27.9188 28.0812 26 25.7143 26Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M29.7143 25C32.0812 25 34 26.9188 34 29.2857C34 30.2325 33.2325 31 32.2857 31" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M20 16C18.3432 16 17 17.3432 17 19C17 20.2231 17.7319 21.2752 18.7817 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M15.7143 31C14.7675 31 14 30.2325 14 29.2857C14 26.9188 15.9188 25 18.2857 25" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const userSvg = (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#clip0_user_info)">
        <g clipPath="url(#clip1_user_info)">
          <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
          <circle cx="24" cy="16" r="8" fill="#BDBDBD"/>
          <circle cx="24" cy="49" r="22" fill="#BDBDBD"/>
        </g>
      </g>
      <defs>
        <clipPath id="clip0_user_info"><rect width="48" height="48" fill="white"/></clipPath>
        <clipPath id="clip1_user_info"><rect width="48" height="48" rx="24" fill="white"/></clipPath>
      </defs>
    </svg>
  )

  return (
    <div className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center px-4 py-2 pt-safe-6 sticky top-0 bg-[#FAFAFA] z-10">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-6 h-6 text-gray-400" />
        </button>
      </div>

      <div className="flex flex-col items-center px-4 pb-10 gap-6 max-w-md mx-auto w-full">
        {/* Chat info */}
        <div className="flex flex-col items-center gap-4 w-full mt-4">
          {/* Cover */}
          <div className="w-[64px] h-[64px] rounded-full overflow-hidden bg-[#F5F5F5] flex-shrink-0">
            <SafeImage
              src={event?.coverUrl || conversation?.avatarUrl}
              alt={event?.title || conversation?.name || 'Groupe'}
              className="w-full h-full object-cover"
              fallback={groupSvg}
            />
          </div>

          {/* About */}
          <div className="flex flex-col items-center gap-1 max-w-[304px] w-full text-center">
            <h2 className="font-poppins font-medium text-[16px] leading-[20px] text-[#1B1818]">
              {event?.title || conversation?.name}
            </h2>
            {event?.description && (
              <p className="font-['Inter_Display'] font-normal text-[14px] leading-[20px] text-[#737373]">
                {event.description.slice(0, 100)}{event.description.length > 100 ? '...' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Pot (Cagnotte) */}
        {poolStats && (
          <div className="flex flex-col p-4 gap-4 w-full bg-[#FAFAFA] shadow-[0px_1px_2px_rgba(0,0,0,0.06)] rounded-[10px] border border-gray-100">
            {/* Header */}
            <div className="flex flex-row justify-between items-center w-full h-[20px]">
              <span className="font-['Mochiy_Pop_One'] font-normal text-[14px] leading-[20px] text-[#FF7A00]">
                Cagnotte
              </span>
              <span className="font-poppins font-semibold text-[14px] leading-[20px] text-[#22C55E]">
                {event.poolTarget ? `${event.poolTarget.toLocaleString('fr-FR')} F CFA` : 'Sans limite'}
              </span>
            </div>
            
            <div className="w-full h-0 border-t border-dashed border-[#CED1D3]" />

            <div className="flex flex-col gap-2 w-full">
              {/* Progress indicator */}
              <div className="w-full h-[4px] bg-white rounded-full relative overflow-hidden">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-[#FF991C] rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, poolStats.progress)}%` }} 
                />
              </div>

              {/* Details */}
              <div className="flex flex-row justify-between items-center w-full h-[22px]">
                <span className="font-poppins font-semibold text-[14px] leading-[20px] text-[#FF7A00]">
                  {poolStats.collected.toLocaleString('fr-FR')} F CFA
                </span>
                {event.poolTarget && event.poolTarget > 0 && (
                  <div className="flex items-center justify-center px-[3px] py-[1px] h-[22px] bg-[#FF7A00] rounded-[4px]">
                    <span className="font-['Inter_Display'] font-medium text-[14px] leading-[20px] text-white">
                      {Math.round(poolStats.progress)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={onContribute}
              className="flex flex-row justify-center items-center p-2 gap-2 w-full h-[36px] bg-white rounded-[8px] active:scale-95 transition-transform border border-gray-100 shadow-sm"
            >
              <Wallet className="w-5 h-5 text-[#219653]" />
              <span className="font-poppins font-medium text-[12px] leading-[20px] text-[#1B1818]">
                Contribuer
              </span>
            </button>
          </div>
        )}

        {/* Event Info */}
        {event && (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex flex-row items-center gap-3 w-full min-h-[36px] py-1">
              <MapPin className="w-6 h-6 text-[#BDBDBD] flex-shrink-0" strokeWidth={1.5} />
              <div className="flex flex-col justify-center flex-1">
                <span className="font-['Inter_Display'] font-normal text-[14px] leading-[20px] text-[#1B1818]">
                  {event.address || event.city || 'Lieu non précisé'}
                </span>
              </div>
            </div>

            <div className="flex flex-row items-center gap-3 w-full min-h-[36px] py-1">
              <CalendarDays className="w-6 h-6 text-[#BDBDBD] flex-shrink-0" strokeWidth={1.5} />
              <div className="flex flex-col justify-center flex-1">
                <span className="font-['Inter_Display'] font-normal text-[14px] leading-[20px] text-[#1B1818]">
                  {format(new Date(event.startAt), 'EEE, dd MMM yyyy, HH:mm', { locale: fr })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="flex flex-col gap-1 w-full">
          <h3 className="font-poppins font-medium text-[12px] leading-[20px] text-[#737373] mb-1">
            Participants ({conversation.members.length})
          </h3>
          <div className="flex flex-col gap-1 w-full">
            {conversation.members.map((member) => {
              const isMe = member.userId === user?.id

              return (
                <div 
                  key={member.userId} 
                  onClick={() => !isMe && openUserProfile(
                    member.userId, 
                    { displayName: member.user?.profile?.displayName, avatarUrl: member.user?.profile?.avatarUrl },
                    { title: event?.title || conversation?.name || 'Groupe', coverUrl: event?.coverUrl || conversation?.avatarUrl }
                  )}
                  className={`flex flex-row items-center justify-between gap-[6px] w-full h-[40px] rounded-[8px] ${!isMe ? 'active:bg-gray-100 cursor-pointer' : ''}`}
                >
                  <div className="flex flex-row items-center gap-[6px] flex-1 overflow-hidden">
                    <div className="w-[32px] h-[32px] rounded-full overflow-hidden bg-[#F5F5F5] flex-shrink-0">
                      <SafeImage
                        src={member.user?.profile?.avatarUrl ?? null}
                        alt={member.user?.profile?.displayName ?? 'Utilisateur'}
                        className="w-full h-full object-cover"
                        fallback={userSvg}
                      />
                    </div>
                    <span className="flex-1 font-['Inter_Display'] font-normal text-[12px] leading-[16px] text-[#1B1818] truncate">
                      {member.user?.profile?.displayName} {isMe ? '(Moi)' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* A propos */}
        <div className="flex flex-col items-start gap-2 w-full mt-2">
          <h3 className="font-poppins font-medium text-[12px] leading-[20px] text-[#737373] w-full text-left">
            A propos
          </h3>
          <div className="flex flex-col items-start gap-1 w-full">
            {event && (
              <button onClick={() => navigate(`/events/${event.id}`)} className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 transition-colors">
                <div className="flex items-center justify-center">
                  <CalendarDays className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
                </div>
                <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Voir l'événement</span>
              </button>
            )}
            
            <button onClick={onInvite} className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 transition-colors">
              <div className="flex items-center justify-center">
                <UserPlus className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
              </div>
              <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Inviter des amis</span>
            </button>

            {poolStats && (
              <button onClick={onContribute} className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 transition-colors">
                <div className="flex items-center justify-center">
                  <Wallet className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
                </div>
                <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Voir la cagnotte</span>
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-start gap-2 w-full mt-2">
          <h3 className="font-poppins font-medium text-[12px] leading-[20px] text-[#737373] w-full text-left">
            Actions
          </h3>
          <div className="flex flex-col items-start gap-1 w-full">
            <button className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 transition-colors">
              <div className="flex items-center justify-center">
                <BellOff className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
              </div>
              <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Mettre en sourdine</span>
            </button>
            
            <button className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 transition-colors">
              <div className="flex items-center justify-center">
                <AlertTriangle className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
              </div>
              <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Signaler</span>
            </button>

            <button className="flex flex-row items-center !justify-start py-2 gap-3 w-full rounded-[8px] active:bg-gray-100 transition-colors">
              <div className="flex items-center justify-center">
                <LogOut className="w-[18px] h-[18px] text-[#737373]" strokeWidth={1.5} />
              </div>
              <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#525252] text-left">Quitter le groupe</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
