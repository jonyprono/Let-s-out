import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Users, MessageCircle, Search, UserPlus, UserMinus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, useSearchUsers } from '@/features/users/api'
import { SafeImage } from '@/components/shared/SafeImage'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { toast } from 'sonner'
import { useDebounce } from 'use-debounce'
import { useAuthStore } from '@/stores/auth.store'
import { apiClient } from '@/lib/api-client'

type TabType = 'friends' | 'global' | 'followers' | 'following'

export function FriendsList() {
  const navigate = useNavigate()
  const { openUserProfile } = useUserProfile()
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const myUserId = currentUser?.id || ''

  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery] = useDebounce(searchQuery, 300)
  const [activeTab, setActiveTab] = useState<TabType>('friends')

  const { data: friends, isLoading: isLoadingFriends } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: usersApi.getFriends,
  })

  const { data: followers, isLoading: isLoadingFollowers } = useQuery({
    queryKey: ['users', 'followers', myUserId],
    queryFn: () => usersApi.getFollowers(myUserId),
    enabled: activeTab === 'followers' && !!myUserId
  })

  const { data: following, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ['users', 'following', myUserId],
    queryFn: () => usersApi.getFollowing(myUserId),
    enabled: activeTab === 'following' && !!myUserId
  })

  const { data: globalUsers, isLoading: isSearching } = useSearchUsers(
    activeTab === 'global' ? debouncedQuery : ''
  )

  const createDmMut = useMutation({
    mutationFn: (targetUserId: string) => apiClient.post('/chat/conversations/dm', { userId: targetUserId }).then(res => res.data),
    onSuccess: (res) => {
      navigate(`/messages/${res.data.id}`)
    },
    onError: () => toast.error('Impossible de démarrer la conversation')
  })

  const friendRequestMut = useMutation({
    mutationFn: (userId: string) => usersApi.sendFriendRequest(userId),
    onSuccess: () => {
      toast.success('Demande d\'ami envoyée !')
      qc.invalidateQueries({ queryKey: ['users', 'search'] })
      qc.invalidateQueries({ queryKey: ['public-profile'] })
    },
    onError: () => toast.error('Impossible d\'envoyer la demande')
  })

  const followMut = useMutation({
    mutationFn: (userId: string) => usersApi.followUser(userId),
    onSuccess: () => {
      toast.success('Abonnement réussi !')
      qc.invalidateQueries({ queryKey: ['users', 'followers'] })
      qc.invalidateQueries({ queryKey: ['users', 'following'] })
      qc.invalidateQueries({ queryKey: ['users', 'search'] })
    },
    onError: () => toast.error('Erreur lors de l\'abonnement')
  })

  const unfollowMut = useMutation({
    mutationFn: (userId: string) => usersApi.unfollowUser(userId),
    onSuccess: () => {
      toast.success('Désabonnement réussi !')
      qc.invalidateQueries({ queryKey: ['users', 'followers'] })
      qc.invalidateQueries({ queryKey: ['users', 'following'] })
      qc.invalidateQueries({ queryKey: ['users', 'search'] })
    },
    onError: () => toast.error('Erreur lors du désabonnement')
  })

  const filterList = (list: any[]) => {
    if (!list) return []
    return list.filter(item => 
      item.displayName?.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
      item.username?.toLowerCase().includes(debouncedQuery.toLowerCase())
    )
  }

  const filteredFriends = filterList(friends || [])
  const filteredFollowers = filterList(followers || [])
  const filteredFollowing = filterList(following || [])

  const isLoading = 
    (activeTab === 'friends' && isLoadingFriends) ||
    (activeTab === 'followers' && isLoadingFollowers) ||
    (activeTab === 'following' && isLoadingFollowing) ||
    (activeTab === 'global' && isSearching)

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-safe-6 pb-4 border-b border-gray-100 dark:border-white/10 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Réseau</h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pb-3 border-b border-gray-100 dark:border-white/10">
        <div className="flex bg-gray-100 dark:bg-[#222] rounded-full px-4 py-2.5 items-center gap-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'global' ? "Rechercher de nouveaux utilisateurs..." : "Rechercher..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none flex-1 text-gray-900 dark:text-white text-[15px] placeholder-gray-400"
          />
        </div>
        
        {/* Toggle Tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'friends', label: 'Mes amis' },
            { id: 'followers', label: 'Abonnés' },
            { id: 'following', label: 'Abonnements' },
            { id: 'global', label: 'Découvrir' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-[#FF7A00] text-white' : 'bg-gray-100 dark:bg-[#222] text-gray-500'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-[#2a2a2a] rounded-lg w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'global' ? (
          /* Global Search Results */
          <div className="p-4 space-y-3">
            {debouncedQuery.trim() === '' ? (
              <div className="text-center py-20 text-gray-400 text-[14px]">
                Tapez un nom ou un pseudo pour rechercher des utilisateurs
              </div>
            ) : !globalUsers || globalUsers.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-[14px]">
                Aucun utilisateur trouvé pour "{debouncedQuery}"
              </div>
            ) : (
              globalUsers.map(user => {
                const displayName = user.displayName || 'Utilisateur'
                const avatar = user.avatarUrl
                
                return (
                  <div
                    key={user.userId}
                    onClick={() => openUserProfile(user.userId, { displayName, avatarUrl: avatar })}
                    className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#2a2a2a]">
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
                      <p className="font-bold text-[15px] text-gray-900 dark:text-white truncate">{displayName}</p>
                      {user.username && (
                        <p className="text-[13px] text-gray-400 truncate">@{user.username}</p>
                      )}
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        friendRequestMut.mutate(user.userId)
                      }}
                      disabled={friendRequestMut.isPending}
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[#FFF9EC] dark:bg-[#FF7A00]/10 text-[#FF7A00] hover:bg-[#FF7A00] hover:text-white"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          /* List Results (Friends, Followers, Following) */
          <div className="p-4 space-y-3">
            {(activeTab === 'friends' && filteredFriends.length === 0) ||
             (activeTab === 'followers' && filteredFollowers.length === 0) ||
             (activeTab === 'following' && filteredFollowing.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div
                  className="w-20 h-20 rounded-2xl mb-5 flex items-center justify-center"
                  style={{ background: 'rgba(151,71,255,0.08)' }}
                >
                  <Users className="w-10 h-10" style={{ color: '#FF7A00' }} />
                </div>
                <h3 className="text-[17px] font-bold text-gray-900 dark:text-white mb-2">Aucun résultat</h3>
                <p className="text-[13px] text-gray-400 leading-relaxed max-w-xs">
                  {activeTab === 'friends' && "Vous n'avez pas encore d'amis correspondant à cette recherche."}
                  {activeTab === 'followers' && "Vous n'avez pas encore d'abonnés correspondant à cette recherche."}
                  {activeTab === 'following' && "Vous n'êtes abonné à personne correspondant à cette recherche."}
                </p>
              </div>
            ) : (
              (activeTab === 'friends' ? filteredFriends : activeTab === 'followers' ? filteredFollowers : filteredFollowing).map(user => {
                const displayName = user.displayName || 'Utilisateur'
                const avatar = user.avatarUrl
                const uid = user.userId

                return (
                  <div
                    key={user.friendshipId || uid}
                    onClick={() => openUserProfile(uid, { displayName, avatarUrl: avatar })}
                    className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-[#2a2a2a]">
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
                      <p className="font-bold text-[15px] text-gray-900 dark:text-white truncate">{displayName}</p>
                      {user.username && (
                        <p className="text-[13px] text-gray-400 truncate">@{user.username}</p>
                      )}
                    </div>
                    
                    {activeTab === 'friends' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          createDmMut.mutate(user.userId)
                        }}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-gray-50 dark:bg-[#222222] text-gray-400 hover:text-[#FF7A00]"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}

                    {activeTab === 'followers' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          followMut.mutate(uid)
                        }}
                        disabled={followMut.isPending}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[#FFF9EC] dark:bg-[#FF7A00]/10 text-[#FF7A00] hover:bg-[#FF7A00] hover:text-white"
                        title="S'abonner en retour"
                      >
                        <UserPlus className="w-5 h-5" />
                      </button>
                    )}

                    {activeTab === 'following' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          unfollowMut.mutate(uid)
                        }}
                        disabled={unfollowMut.isPending}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                        title="Se désabonner"
                      >
                        <UserMinus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}

