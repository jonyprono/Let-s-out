import { useNavigate } from 'react-router'
import { ChevronLeft, Users, MessageCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/features/users/api'
import { SafeImage } from '@/components/shared/SafeImage'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { toast } from 'sonner'

export function FriendsList() {
  const navigate = useNavigate()
  const { openUserProfile } = useUserProfile()

  const { data: friends, isLoading } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: usersApi.getFriends,
  })

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">
      {/* Header */}
      <div className="bg-white px-5 pt-safe-top pt-4 pb-4 border-b border-gray-100 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mes Amis</h1>
          {friends && friends.length > 0 && (
            <p className="text-xs text-gray-400">{friends.length} ami{friends.length > 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !friends || friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <div
              className="w-20 h-20 rounded-2xl mb-5 flex items-center justify-center"
              style={{ background: 'rgba(151,71,255,0.08)' }}
            >
              <Users className="w-10 h-10" style={{ color: '#9747FF' }} />
            </div>
            <h3 className="text-[17px] font-bold text-gray-900 mb-2">Aucun ami pour le moment</h3>
            <p className="text-[13px] text-gray-400 leading-relaxed max-w-xs">
              Participez à des événements pour rencontrer de nouvelles personnes !
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {friends.map(friend => {
              const displayName = friend.displayName || 'Utilisateur'
              const avatar = friend.avatarUrl

              return (
                <div
                  key={friend.friendshipId}
                  onClick={() => openUserProfile(friend.userId, { displayName, avatarUrl: avatar })}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100">
                    <SafeImage
                      src={avatar}
                      alt={displayName}
                      className="w-full h-full object-cover"
                      fallback={
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ background: 'linear-gradient(135deg, #9747FF, #FF9F1C)' }}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      }
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[15px] text-gray-900 truncate">{displayName}</p>
                    {friend.username && (
                      <p className="text-[13px] text-gray-400 truncate">@{friend.username}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Optional: Navigate to messages or create a chat with this user
                      toast.info("Fonctionnalité message à venir")
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-gray-50 text-gray-400 hover:text-[#9747FF]"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

