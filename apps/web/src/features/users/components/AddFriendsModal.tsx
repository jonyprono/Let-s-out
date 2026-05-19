import { useState } from 'react'
import { Search, X, Loader2, UserPlus, Check } from 'lucide-react'
import { useSearchUsers, useSendFriendRequest } from '@/features/users/api'
import { toast } from 'sonner'

interface AddFriendsModalProps {
  onClose: () => void
}

export function AddFriendsModal({ onClose }: AddFriendsModalProps) {
  const [search, setSearch] = useState('')
  const { data: users, isLoading } = useSearchUsers(search)
  const { mutate: sendRequest, isPending: isSending } = useSendFriendRequest()

  // Track sent requests locally for immediate UI feedback
  const [sentRequests, setSentRequests] = useState<string[]>([])

  const handleSendRequest = (userId: string) => {
    sendRequest(userId, {
      onSuccess: () => {
        setSentRequests(prev => [...prev, userId])
        toast.success("Demande d'ami envoyée !")
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || "Impossible d'envoyer la demande")
      }
    })
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-900" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900">Ajouter des amis</h2>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>

      {/* Search Bar */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="bg-gray-100 rounded-xl flex items-center gap-2 px-3 py-2.5">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par pseudo ou nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder-gray-500"
          />
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {search.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-[15px] text-gray-500 font-medium">Recherchez vos amis</p>
            <p className="text-[13px] text-gray-400 mt-1">Saisissez au moins 2 caractères.</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
        ) : users?.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-[14px]">
            Aucun utilisateur trouvé.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {users?.map(user => {
              const isSent = sentRequests.includes(user.userId)
              
              return (
                <div key={user.userId} className="w-full flex items-center gap-3">
                  <img 
                    src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.displayName}&background=f3f4f6&color=374151`} 
                    alt={user.displayName} 
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[15px] font-bold text-gray-900 truncate">{user.displayName}</h4>
                    <p className="text-[13px] text-gray-500 truncate">@{user.username}</p>
                  </div>
                  
                  <button 
                    onClick={() => handleSendRequest(user.userId)}
                    disabled={isSent || isSending}
                    className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-bold flex items-center gap-1.5 transition-colors ${
                      isSent 
                        ? 'bg-gray-100 text-gray-500' 
                        : 'bg-[#FF9F1C] text-white hover:bg-[#F09214]'
                    }`}
                  >
                    {isSent ? (
                      <>
                        <Check className="w-4 h-4" />
                        Envoyée
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Ajouter
                      </>
                    )}
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

