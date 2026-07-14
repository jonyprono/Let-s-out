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

  const handleForward = () => {
    if (!messageContent || selectedConvs.length === 0) return
    setIsSending(true)
    
    // Execute in background
    selectedConvs.forEach(convId => {
      chatApi.sendMessage(convId, messageContent, messageType).catch(console.error)
    })
    
    toast.success('Message transféré')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-white dark:bg-[#1A1A1A]">
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-white font-poppins">Transférer à...</h2>
          <button onClick={onClose} className="p-2 -mr-2 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-full transition-colors active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-50 bg-white dark:bg-[#1A1A1A]">
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher une discussion..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-white placeholder:text-gray-500 dark:text-gray-400 rounded-full py-3 pl-11 pr-4 font-inter text-[15px] outline-none focus:ring-2 focus:ring-[var(--color-action-primary)] transition-shadow"
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
                className="w-full flex items-center px-2 py-3 rounded-2xl hover:bg-gray-50 dark:bg-[#222222] active:bg-gray-100 dark:bg-[#2a2a2a] transition-colors"
              >
                {/* Avatar */}
                <div className="w-[44px] h-[44px] rounded-full overflow-hidden bg-gray-100 dark:bg-[#2a2a2a] flex-shrink-0">
                  <SafeImage 
                    src={conv.avatarUrl} 
                    alt={conv.name} 
                    className="w-full h-full object-cover" 
                    fallback={
                      conv.isGroup ? (
                        <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                          <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
                          <path d="M27 20C27 21.6568 25.6569 23 24 23C22.3431 23 21 21.6568 21 20C21 18.3432 22.3431 17 24 17C25.6569 17 27 18.3432 27 20Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M28 16C29.6569 16 31 17.3432 31 19C31 20.2231 30.2681 21.2752 29.2183 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M25.7143 26H22.2857C19.9188 26 18 27.9188 18 30.2857C18 31.2325 18.7675 32 19.7143 32H28.2857C29.2325 32 30 31.2325 30 30.2857C30 27.9188 28.0812 26 25.7143 26Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M29.7143 25C32.0812 25 34 26.9188 34 29.2857C34 30.2325 33.2325 31 32.2857 31" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M20 16C18.3432 16 17 17.3432 17 19C17 20.2231 17.7319 21.2752 18.7817 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M15.7143 31C14.7675 31 14 30.2325 14 29.2857C14 26.9188 15.9188 25 18.2857 25" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                          <g clipPath="url(#clip0_1415_2646)">
                            <g clipPath="url(#clip1_1415_2646)">
                              <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
                              <circle cx="24" cy="16" r="8" fill="#BDBDBD"/>
                              <circle cx="24" cy="49" r="22" fill="#BDBDBD"/>
                            </g>
                          </g>
                          <defs>
                            <clipPath id="clip0_1415_2646"><rect width="48" height="48" fill="white"/></clipPath>
                            <clipPath id="clip1_1415_2646"><rect width="48" height="48" rx="24" fill="white"/></clipPath>
                          </defs>
                        </svg>
                      )
                    }
                  />
                </div>
                
                {/* Name */}
                <div className="ml-3 flex-1 text-left truncate font-poppins font-medium text-[15px] text-gray-900 dark:text-white">
                  {conv.name}
                </div>

                {/* Radio button on the right */}
                <div className={`ml-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${selectedConvs.includes(conv.id) ? 'border-[#FF7A00] bg-[#FF7A00]' : 'border-gray-300'}`}>
                  {selectedConvs.includes(conv.id) && <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#1A1A1A]" />}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {selectedConvs.length > 0 && (
          <div className="p-4 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1A1A] animate-in slide-in-from-bottom-4">
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
