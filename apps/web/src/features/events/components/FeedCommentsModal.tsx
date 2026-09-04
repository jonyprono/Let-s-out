import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Send, Loader2, MoreHorizontal, Heart, Image as ImageIcon, Smile, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'

interface Comment {
  id: string
  userId: string
  content: string
  createdAt: string
  user: {
    id: string
    profile?: {
      displayName: string
      avatarUrl?: string
    }
  }
}

interface FeedCommentsModalProps {
  eventId: string
  eventTitle?: string
  organizerId?: string
  open: boolean
  onClose: () => void
}

function getRelativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export function FeedCommentsModal({ eventId, organizerId, open, onClose }: FeedCommentsModalProps) {
  const [content, setContent] = useState('')
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['events', eventId, 'comments'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Comment[] }>('/events/' + eventId + '/comments')
      return res.data.data
    },
    enabled: open,
  })

  const postMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiClient.post<{ data: Comment }>('/events/' + eventId + '/comments', { content: text })
      return res.data
    },
    onSuccess: () => {
      setContent('')
      qc.invalidateQueries({ queryKey: ['events', eventId, 'comments'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete('/events/' + eventId + '/comments/' + commentId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', eventId, 'comments'] }),
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      {/* Sheet — 90% height */}
      <div
        className="w-full flex flex-col rounded-t-3xl overflow-hidden relative"
        style={{
          height: '90vh',
          background: 'var(--color-background-primary, #fff)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          animation: 'slideUp 0.3s cubic-bezier(.32,1.06,.55,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 flex-shrink-0">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">
            Commentaires ({comments.length})
          </h2>
          <button className="flex items-center gap-1 text-[13px] font-medium text-gray-500 dark:text-gray-400">
            Les plus récents <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* ── Comment list ── */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-[13px]">
              Aucun commentaire pour l'instant. Soyez le premier !
            </div>
          ) : (
            comments.map(comment => {
              const isOrganizer = comment.userId === organizerId;
              const isMe = currentUser?.id === comment.userId;
              
              return (
                <div key={comment.id} className="flex gap-3 relative group">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700">
                    {comment.user.profile?.avatarUrl ? (
                      <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#FF7A00] bg-orange-50">
                        {comment.user.profile?.displayName?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span className="font-bold text-[14.5px] text-gray-900 dark:text-white">
                          {comment.user.profile?.displayName ?? 'Utilisateur'}
                        </span>
                        
                        {isOrganizer && (
                          <span className="bg-[#FFF1E5] text-[#FF7A00] text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                            Organisateur
                          </span>
                        )}
                        
                        <span className="text-[12.5px] text-gray-400">
                          • {getRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      
                      <button 
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        onClick={() => {
                          if (isMe || currentUser?.id === organizerId) {
                            if (window.confirm('Supprimer ce commentaire ?')) {
                              deleteMutation.mutate(comment.id)
                            }
                          }
                        }}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-[14.5px] text-gray-800 dark:text-gray-200 mt-1 mb-2 leading-snug break-words">
                      {comment.content}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors">
                          <Heart className="w-[15px] h-[15px]" />
                          <span className="text-[13px] font-medium">0</span>
                        </button>
                        <button className="text-[13px] font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                          Répondre
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#111]">
          {currentUser ? (
            <form
              onSubmit={e => {
                e.preventDefault()
                if (!content.trim()) return
                postMutation.mutate(content)
              }}
              className="flex items-end gap-3"
            >
              <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-[#2A2A2A] flex-shrink-0 flex items-center justify-center overflow-hidden mb-0.5 border border-gray-200 dark:border-gray-700">
                {currentUser?.profile?.avatarUrl ? (
                  <img src={currentUser.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-[#FF7A00]">
                    {currentUser?.profile?.displayName?.[0]?.toUpperCase() ?? 'M'}
                  </span>
                )}
              </div>
              
              <div className="flex-1 bg-[#F5F5F5] dark:bg-[#222] rounded-3xl px-4 py-2 flex items-center gap-2">
                <input
                  type="text"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Écrire un commentaire..."
                  className="w-full bg-transparent text-[14px] focus:outline-none text-gray-900 dark:text-white placeholder-gray-500"
                />
                <button type="button" className="text-gray-400 hover:text-gray-600">
                  <ImageIcon className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </button>
                <button type="button" className="text-gray-400 hover:text-gray-600">
                  <Smile className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </button>
              </div>
              
              <button
                type="submit"
                disabled={!content.trim() || postMutation.isPending}
                className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50 transition-transform active:scale-95 shadow-sm mb-0.5"
              >
                {postMutation.isPending
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Send className="w-4 h-4 ml-0.5" strokeWidth={2.5} />
                }
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex-shrink-0 flex items-center justify-center text-[#FF7A00]">
                <span className="font-bold">?</span>
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-[#2A2A2A] rounded-full px-4 py-2.5 flex items-center justify-center">
                <span className="text-[13px] text-gray-500 dark:text-gray-400">Connectez-vous pour commenter</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}

