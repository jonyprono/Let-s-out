import { useState } from 'react'
import { Search, X, Check, Loader2, Users } from 'lucide-react'
import { useFriends } from '@/features/users/api'
import { useMutation } from '@tanstack/react-query'
import { chatApi } from '@/features/chat/api'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useConversations } from '@/features/chat/api'
import { SafeImage } from '@/components/shared/SafeImage'
import { Button } from '@/components/ui/button'

interface NewConversationModalProps {
  onClose: () => void
}

export function NewConversationModal({ onClose }: NewConversationModalProps) {
  const [search, setSearch] = useState('')
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const navigate = useNavigate()

  const { data: friends, isLoading } = useFriends()

  const { mutateAsync: createDM, isPending: isCreatingDM } = useMutation({
    mutationFn: chatApi.createDM
  })

  const { mutateAsync: createGroup, isPending: isCreatingGroup } = useMutation({
    mutationFn: ({ name, memberIds }: { name: string, memberIds: string[] }) => chatApi.createGroup(name, memberIds)
  })

  const userSvg = (
    <svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
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

  const handleStart = async () => {
    try {
      if (selectedFriends.length === 1) {
        const conv = await createDM(selectedFriends[0])
        onClose()
        navigate(`/chat/${conv.id}`)
      } else {
        if (!groupName.trim()) {
          toast.error("Veuillez entrer un nom de groupe")
          return
        }
        const conv = await createGroup({ name: groupName.trim(), memberIds: selectedFriends } as any)
        onClose()
        navigate(`/chat/${conv.id}`)
      }
    } catch (err) {
      toast.error("Erreur lors de la création de la discussion")
    }
  }

  const { data: conversations } = useConversations()

  const existingDmUserIds = new Set(
    (conversations || [])
      .filter((c: any) => !c.isGroup)
      .flatMap((c: any) => c.members?.map((m: any) => m.userId))
  )

  const filteredFriends = friends?.filter(f => {
    if (existingDmUserIds.has(f.userId)) return false;
    return f.displayName.toLowerCase().includes(search.toLowerCase()) || 
           f.username.toLowerCase().includes(search.toLowerCase())
  }) || []

  const toggleFriend = (userId: string) => {
    setSelectedFriends(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }



  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 pt-safe-4 pb-3 flex items-center justify-between border-b border-gray-100">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-900" />
        </button>
        <h2 className="text-[17px] font-bold text-gray-900">Nouvelle discussion</h2>
        <div className="w-9" />
      </div>

      {/* Group Name (if multiple selected) */}
      {selectedFriends.length > 1 && (
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Nom du groupe..."
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            className="flex-1 text-[15px] outline-none placeholder-gray-400 font-medium"
          />
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 py-3">
        <div className="bg-gray-100 rounded-xl flex items-center gap-2 px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un ami..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder-gray-500"
          />
        </div>
      </div>

      {/* Selected Chips */}
      {selectedFriends.length > 0 && (
        <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {selectedFriends.map(id => {
            const friend = friends?.find(f => f.userId === id)
            if (!friend) return null
            return (
              <div key={id} className="flex items-center gap-1.5 bg-action-primary/10 pl-1.5 pr-2.5 py-1.5 rounded-full flex-shrink-0 border border-action-primary/20">
                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-white">
                  <SafeImage
                    src={friend.avatarUrl}
                    alt={friend.displayName}
                    className="w-full h-full object-cover"
                    fallback={userSvg}
                  />
                </div>
                <span className="text-[13px] font-medium text-action-primary">{friend.displayName.split(' ')[0]}</span>
                <button onClick={() => toggleFriend(id)} className="ml-0.5"><X className="w-3.5 h-3.5 text-action-primary" /></button>
              </div>
            )
          })}
        </div>
      )}

      {/* Friends List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-3">Vos amis</h3>
        
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-gray-400 animate-spin" /></div>
        ) : filteredFriends.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-[14px]">
            {search ? 'Aucun ami trouvé' : "Vous n'avez pas encore ajouté d'amis."}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFriends.map(friend => {
              const isSelected = selectedFriends.includes(friend.userId)
              return (
                <button 
                  key={friend.userId} 
                  onClick={() => toggleFriend(friend.userId)}
                  className="w-full flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <SafeImage
                      src={friend.avatarUrl}
                      alt={friend.displayName}
                      className="w-full h-full object-cover"
                      fallback={userSvg}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[15px] font-bold text-gray-900 truncate">{friend.displayName}</h4>
                    <p className="text-[13px] text-gray-500 truncate">@{friend.username}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-action-primary border-action-primary' : 'border-gray-300'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {/* Floating Action Button */}
      {selectedFriends.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <Button
            onClick={handleStart}
            disabled={isCreatingDM || isCreatingGroup}
            className="w-full text-[16px] font-bold py-[14px]"
          >
            {(isCreatingDM || isCreatingGroup) ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Démarrer la discussion'}
          </Button>
        </div>
      )}
    </div>
  )
}
