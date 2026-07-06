import { useState, useMemo } from 'react'
import { X, Search, Send } from 'lucide-react'
import { useConversations, chatApi } from '@/features/chat/api'
import { SafeImage } from '@/components/shared/SafeImage'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'

interface ForwardMessageModalProps {
  onClose: () => void
  messageContent: string | null
  messageType: string
}

export function ForwardMessageModal({ onClose, messageContent, messageType }: ForwardMessageModalProps) {
  const { data: conversations } = useConversations()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConvs, setSelectedConvs] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const user = useAuthStore((s) => s.user)

  const filtered = useMemo(() => {
    if (!conversations) return []
    let list = conversations.map((conv: any) => {
      let name = conv.name || 'Conversation'
      let avatarUrl = conv.avatarUrl || null
      if (!conv.isGroup) {
        const otherMember = conv.members?.find((m: any) => m.userId !== user?.id)?.user
        if (otherMember?.profile) {
          name = otherMember.profile.displayName || name
          avatarUrl = otherMember.profile.avatarUrl || avatarUrl
        }
      }
      return { id: conv.id, name, avatarUrl, isGroup: conv.isGroup }
    })

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q))
    }
    return list
  }, [conversations, searchQuery, user?.id])

  const toggleSelect = (id: string) => {
    setSelectedConvs(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleForward = async () => {
    if (!messageContent || selectedConvs.length === 0) return
    setIsSending(true)
    try {
      await Promise.all(selectedConvs.map(convId => 
        chatApi.sendMessage(convId, messageContent, messageType)
      ))
      toast.success('Message transféré')
      onClose()
    } catch (e) {
      toast.error('Erreur lors du transfert')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
          <h2 className="text-[18px] font-bold text-gray-900 font-poppins">Transférer à...</h2>
          <button onClick={onClose} className="p-2 -mr-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-50 bg-white">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une discussion..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 text-gray-900 placeholder:text-gray-500 rounded-full py-3 pl-11 pr-4 font-inter text-[15px] outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] transition-shadow"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <Search className="w-10 h-10 opacity-20" />
              <p className="font-poppins text-[14px]">Aucun résultat</p>
            </div>
          ) : (
            filtered.map(conv => (
              <button
                key={conv.id}
                onClick={() => toggleSelect(conv.id)}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[44px] h-[44px] rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                    <SafeImage src={conv.avatarUrl} alt={conv.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="font-poppins font-medium text-[15px] text-gray-900 truncate max-w-[200px] text-left">
                    {conv.name}
                  </span>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedConvs.includes(conv.id) ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)]' : 'border-gray-300'}`}>
                  {selectedConvs.includes(conv.id) && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {selectedConvs.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white animate-in slide-in-from-bottom-4">
            <button
              onClick={handleForward}
              disabled={isSending}
              className="w-full bg-[var(--color-action-primary)] text-white py-4 rounded-full font-poppins font-semibold text-[16px] shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSending ? (
                <span className="animate-pulse">Transfert...</span>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Transférer ({selectedConvs.length})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
