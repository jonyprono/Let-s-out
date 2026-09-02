import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Send, Loader2, MessageCircle, X } from 'lucide-react'
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
      style={{ background: 'rgba(0,0,0,0.35)' }}
    >
      {/* Sheet — stops at 65% height, leaving top 35% visible */}
      <div
        className="w-full flex flex-col rounded-t-3xl overflow-hidden"
        style={{
          height: '65vh',
          background: 'var(--color-background-primary, #fff)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          animation: 'slideUp 0.28s cubic-bezier(.32,1.06,.55,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#FF7A00]" />
            <span className="font-bold text-[15px] text-gray-900 dark:text-white">
              Commentaires <span className="font-normal text-gray-400 text-[13px]">({comments.length})</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        {/* ── Comment list ── */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-[13px]">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Aucun commentaire pour l'instant. Soyez le premier !
            </div>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                  {comment.user.profile?.avatarUrl ? (
                    <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#FF7A00] bg-orange-50">
                      {comment.user.profile?.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="inline-block bg-gray-100 dark:bg-white/5 rounded-2xl rounded-tl-sm px-3 py-2 max-w-full">
                    <span className="font-semibold text-[12px] text-gray-900 dark:text-white block leading-none mb-1">
                      {comment.user.profile?.displayName ?? 'Utilisateur'}
                    </span>
                    <p className="text-[13.5px] text-gray-800 dark:text-gray-200 leading-snug break-words">
                      {comment.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 px-1">
                    <span className="text-[11px] text-gray-400">
                      {new Date(comment.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    {(currentUser?.id === comment.userId || currentUser?.id === organizerId) ? (
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        className="text-[11px] text-red-400 font-medium"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <button className="text-[11px] text-gray-400 font-medium">
                        Signaler
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
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
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-[#2A2A2A] flex-shrink-0 flex items-center justify-center overflow-hidden">
                {currentUser?.profile?.avatarUrl ? (
                  <img src={currentUser.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-[#FF7A00]">
                    {currentUser?.profile?.displayName?.[0]?.toUpperCase() ?? 'M'}
                  </span>
                )}
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-[#2A2A2A] rounded-full px-4 py-2.5 flex items-center">
                <input
                  type="text"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="w-full bg-transparent text-[14px] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>
              <button
                type="submit"
                disabled={!content.trim() || postMutation.isPending}
                className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-white flex-shrink-0 disabled:opacity-50 transition-opacity"
              >
                {postMutation.isPending
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <Send className="w-5 h-5 ml-0.5" />
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
              <div className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-white flex-shrink-0 opacity-90">
                <Send className="w-5 h-5 ml-0.5" />
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
