import { useState } from 'react'
import { Search, X, Check, Loader2, Users } from 'lucide-react'
import { useFriends } from '@/features/users/api'
import { chatApi } from '@/features/chat/api'
import { useNavigate } from 'react-router'

interface NewConversationModalProps {
  onClose: () => void
}

export function NewConversationModal({ onClose }: NewConversationModalProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const { data: friends, isLoading } = useFriends()

  const filteredFriends = friends?.filter(f => 
    f.displayName.toLowerCase().includes(search.toLowerCase()) || 
    f.username.toLowerCase().includes(search.toLowerCase())
  ) || []

  const toggleFriend = (userId: string) => {
    setSelectedFriends(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleCreate = async () => {
    if (selectedFriends.length === 0) return
    setIsCreating(true)
    try {
      if (selectedFriends.length === 1) {
        // Direct Message
        const conv = await chatApi.createDM(selectedFriends[0])
        navigate(`/chat/${conv.id}`)
      } else {
        // Group Message
        if (!groupName.trim()) {
          alert('Veuillez entrer un nom de groupe')
          setIsCreating(false)
          return
        }
        const conv = await chatApi.createGroup(groupName, selectedFriends)
        navigate(`/chat/${conv.id}`)
      }
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
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
                {friend.avatarUrl ? (
                  <img src={friend.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-action-primary flex items-center justify-center text-[10px] text-white font-bold">
                    {friend.displayName[0]}
                  </div>
                )}
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
                  <img 
                    src={friend.avatarUrl || `https://ui-avatars.com/api/?name=${friend.displayName}&background=f3f4f6&color=374151`} 
                    alt={friend.displayName} 
                    className="w-12 h-12 rounded-full object-cover"
                  />
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
    </div>
  )
}
