import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Loader2, MoreHorizontal, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { pagesApi, PagePostComment } from '../api'
import { useConfirm } from '@/components/shared/ConfirmContext'
import { toast } from 'sonner'

interface PagePostCommentsModalProps {
  pageId: string
  postId: string
  pageName?: string
  pageCreatorId?: string
  open: boolean
  onClose: () => void
  onCommentAdded?: () => void
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

export function PagePostCommentsModal({
  pageId,
  postId,
  pageName,
  pageCreatorId,
  open,
  onClose,
  onCommentAdded,
}: PagePostCommentsModalProps) {
  const [content, setContent] = useState('')
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const confirm = useConfirm()

  const { data: comments = [], isLoading } = useQuery<PagePostComment[]>({
    queryKey: ['pages', pageId, 'posts', postId, 'comments'],
    queryFn: () => pagesApi.getComments(pageId, postId),
    enabled: open && Boolean(pageId && postId),
  })

  const postMutation = useMutation({
    mutationFn: (text: string) => pagesApi.addComment(pageId, postId, text),
    onSuccess: () => {
      setContent('')
      qc.invalidateQueries({ queryKey: ['pages', pageId, 'posts', postId, 'comments'] })
      qc.invalidateQueries({ queryKey: ['feed', 'pages'] })
      qc.invalidateQueries({ queryKey: ['pages', pageId, 'posts'] })
      onCommentAdded?.()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => pagesApi.deleteComment(pageId, postId, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages', pageId, 'posts', postId, 'comments'] })
      qc.invalidateQueries({ queryKey: ['feed', 'pages'] })
      qc.invalidateQueries({ queryKey: ['pages', pageId, 'posts'] })
    },
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end"
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
    >
      {/* Sheet — 90% height */}
      <div
        className="w-full flex flex-col rounded-t-3xl overflow-hidden relative"
        style={{
          height: '85vh',
          maxHeight: '90dvh',
          background: 'var(--color-background-primary, #fff)',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
          animation: 'slideUp 0.3s cubic-bezier(.32,1.06,.55,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-2 pb-4 flex-shrink-0 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">
              Commentaires ({comments.length})
            </h2>
            {pageName && (
              <p className="text-xs text-gray-400 mt-0.5">
                Publication de {pageName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Comment list ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" />
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">
              Aucun commentaire pour l'instant. Soyez le premier !
            </div>
          ) : (
            comments.map((comment) => {
              const isCreator = comment.userId === pageCreatorId
              const isMe = currentUser?.id === comment.userId
              const avatar = comment.user?.profile?.avatarUrl
              const name = comment.user?.profile?.displayName || (comment.user as any)?.username || 'Utilisateur'

              return (
                <div key={comment.id} className="flex gap-3 relative group">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-gray-700">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#FF7A00] bg-orange-50 dark:bg-orange-950/30">
                        {name[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-bold text-[14px] text-gray-900 dark:text-white">
                          {name}
                        </span>

                        {isCreator && (
                          <span className="bg-[#FFF1E5] dark:bg-[#FF7A00]/20 text-[#FF7A00] text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                            Auteur
                          </span>
                        )}

                        <span className="text-[12px] text-gray-400">
                          • {getRelativeTime(comment.createdAt)}
                        </span>
                      </div>

                      {(isMe || currentUser?.id === pageCreatorId) && (
                        <button
                          className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                          title="Supprimer le commentaire"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Supprimer ce commentaire ?',
                              description: 'Cette action est irréversible.',
                              confirmText: 'Supprimer',
                              variant: 'danger',
                            })
                            if (ok) {
                              deleteMutation.mutate(comment.id)
                              toast.success('Commentaire supprimé')
                            } else {
                              toast.info('Suppression annulée')
                            }
                          }}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <p className="text-[14px] text-gray-800 dark:text-gray-200 mt-1 mb-2 leading-relaxed break-words">
                      {comment.text}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Input ── */}
        <div
          className="flex-shrink-0 px-4 pt-3 pb-3 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#111]"
          style={{ paddingBottom: 'max(0.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
        >
          {currentUser ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!content.trim() || postMutation.isPending) return
                postMutation.mutate(content.trim())
              }}
              className="flex items-end gap-2.5"
            >
              <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-[#2A2A2A] flex-shrink-0 flex items-center justify-center overflow-hidden mb-0.5 border border-gray-200 dark:border-gray-700">
                {currentUser?.profile?.avatarUrl ? (
                  <img src={currentUser.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-[#FF7A00]">
                    {currentUser?.profile?.displayName?.[0]?.toUpperCase() ?? 'M'}
                  </span>
                )}
              </div>

              <div className="flex-1 bg-[#F5F5F5] dark:bg-[#222] rounded-3xl px-4 py-2 flex items-center gap-2">
                <input
                  type="text"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Écrire un commentaire..."
                  className="w-full bg-transparent text-[14px] focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
                />
              </div>

              <button
                type="submit"
                disabled={!content.trim() || postMutation.isPending}
                className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-transform active:scale-95 shadow-sm mb-0.5"
              >
                {postMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 ml-0.5" strokeWidth={2.5} />
                )}
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#2A2A2A] flex-shrink-0 flex items-center justify-center text-[#FF7A00]">
                <span className="font-bold text-xs">?</span>
              </div>
              <div className="flex-1 bg-gray-100 dark:bg-[#2A2A2A] rounded-full px-4 py-2 flex items-center justify-center">
                <span className="text-xs text-gray-500 dark:text-gray-400">Connectez-vous pour commenter</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
