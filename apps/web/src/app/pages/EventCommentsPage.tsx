import { useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { ArrowLeft, Send, Loader2, MoreHorizontal, Heart, ChevronDown, MessageCircle } from 'lucide-react'
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

export function EventCommentsPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)

  const organizerId: string | undefined = (location.state as any)?.organizerId
  const eventTitle: string | undefined = (location.state as any)?.eventTitle
  const stateCoverUrl: string | undefined = (location.state as any)?.coverUrl

  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  // Likes sur les commentaires (état local uniquement — pas encore persisté en API)
  const [likedComments, setLikedComments] = useState<Record<string, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['events', eventId, 'comments'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Comment[] }>(`/events/${eventId}/comments`)
      return res.data.data
    },
    enabled: !!eventId,
  })

  // Fetch event data for the cover image
  const { data: eventData } = useQuery({
    queryKey: ['events', eventId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: any }>(`/events/${eventId}`)
      return res.data.data
    },
    enabled: !!eventId,
  })

  const coverUrl = stateCoverUrl ?? eventData?.coverUrl ?? eventData?.mediaUrls?.[0] ?? null
  const resolvedTitle = eventData?.title ?? eventTitle

  const postMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiClient.post<{ data: Comment }>(`/events/${eventId}/comments`, { content: text })
      return res.data
    },
    onSuccess: () => {
      setContent('')
      setReplyTo(null)
      qc.invalidateQueries({ queryKey: ['events', eventId, 'comments'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete(`/events/${eventId}/comments/${commentId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', eventId, 'comments'] }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    const text = replyTo ? `@${replyTo.name} ${content}` : content
    postMutation.mutate(text)
  }

  const handleReply = (comment: Comment) => {
    setReplyTo({ id: comment.id, name: comment.user.profile?.displayName ?? 'Utilisateur' })
    setContent('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const toggleLike = (commentId: string) => {
    setLikedComments(prev => ({
      ...prev,
      [commentId]: prev[commentId] === 1 ? 0 : 1,
    }))
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-[#111]" id="event-comments-page">

      {/* ── Hero image header ── */}
      <div className="relative flex-shrink-0">
        {/* Cover image */}
        <div
          className="w-full bg-gray-200 dark:bg-gray-800"
          style={{ height: coverUrl ? 180 : 0 }}
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt={resolvedTitle}
              className="w-full h-full object-cover"
            />
          )}
          {/* Gradient overlay for readability */}
          {coverUrl && (
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />
          )}
        </div>

        {/* Back button + title — always on top of image or plain bg */}
        <div
          className={`absolute top-0 left-0 right-0 flex items-center gap-3 px-4 pb-3 pt-safe-6 ${
            !coverUrl ? 'relative bg-white dark:bg-[#111] border-b border-gray-100 dark:border-white/5' : ''
          }`}
        >
          <button
            onClick={() => navigate(-1)}
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              coverUrl
                ? 'bg-black/30 backdrop-blur-sm'
                : 'bg-gray-100 dark:bg-white/10'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 ${coverUrl ? 'text-white' : 'text-gray-700 dark:text-white'}`} />
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-medium uppercase tracking-wide ${
              coverUrl ? 'text-white/70' : 'text-gray-400'
            }`}>Commentaires</p>
            {resolvedTitle && (
              <h1 className={`font-bold text-[15px] leading-tight truncate ${
                coverUrl ? 'text-white' : 'text-gray-900 dark:text-white'
              }`}>
                {resolvedTitle}
              </h1>
            )}
          </div>
          <button className={`flex items-center gap-1 text-[12px] font-medium flex-shrink-0 ${
            coverUrl ? 'text-white/80' : 'text-gray-500'
          }`}>
            Les plus récents <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom strip with comment count — only shown when no cover */}
        {!coverUrl && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-white/5 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#FF7A00]" />
            <span className="text-[14px] font-semibold text-gray-900 dark:text-white">
              {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* When cover image is present, show count below */}
        {coverUrl && (
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/5 flex items-center gap-2 bg-white dark:bg-[#111]">
            <MessageCircle className="w-4 h-4 text-[#FF7A00]" />
            <span className="text-[14px] font-semibold text-gray-900 dark:text-white">
              {comments.length} commentaire{comments.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* ── Comment list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <p className="text-[15px] font-medium text-gray-500 dark:text-gray-400">Aucun commentaire</p>
            <p className="text-[13px] text-gray-400 mt-1">Soyez le premier à commenter !</p>
          </div>
        ) : (
          comments.map(comment => {
            const isOrganizer = comment.userId === organizerId
            const isMe = currentUser?.id === comment.userId
            const liked = (likedComments[comment.id] ?? 0) > 0

            return (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div 
                  onClick={() => navigate(`/profile/${comment.userId}`)}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0 overflow-hidden border border-gray-200 dark:border-white/10 cursor-pointer"
                >
                  {comment.user.profile?.avatarUrl ? (
                    <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-[#FF7A00] bg-orange-50 dark:bg-orange-900/20">
                      {comment.user.profile?.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                      <span className="font-bold text-[14.5px] text-gray-900 dark:text-white">
                        {comment.user.profile?.displayName ?? 'Utilisateur'}
                      </span>
                      {isOrganizer && (
                        <span className="bg-[#FFF1E5] dark:bg-orange-900/30 text-[#FF7A00] text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                          Organisateur
                        </span>
                      )}
                      <span className="text-[12px] text-gray-400">
                        • {getRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <button
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2 flex-shrink-0"
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

                  {/* Actions */}
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => toggleLike(comment.id)}
                      className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
                    >
                      <Heart className={`w-[15px] h-[15px] transition-all ${liked ? 'fill-red-500 scale-110' : ''}`} />
                      <span className="text-[13px] font-medium">
                        {likedComments[comment.id] ?? 0}
                      </span>
                    </button>
                    <button
                      onClick={() => handleReply(comment)}
                      className="text-[13px] font-bold text-gray-500 hover:text-[#FF7A00] dark:hover:text-[#FF7A00] transition-colors"
                    >
                      Répondre
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Input ── */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#111] pb-safe">
        {/* Banner "En réponse à…" */}
        {replyTo && (
          <div className="flex items-center justify-between px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/30">
            <span className="text-[12px] text-[#FF7A00] font-medium">
              En réponse à <strong>{replyTo.name}</strong>
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="text-[11px] text-gray-400 hover:text-gray-600 font-medium"
            >
              Annuler
            </button>
          </div>
        )}

        {currentUser ? (
          <form onSubmit={handleSubmit} className="flex items-end gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-[#2A2A2A] flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-white/10 mb-0.5">
              {currentUser?.profile?.avatarUrl ? (
                <img src={currentUser.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-[#FF7A00]">
                  {currentUser?.profile?.displayName?.[0]?.toUpperCase() ?? 'M'}
                </span>
              )}
            </div>

            <div className="flex-1 bg-[#F5F5F5] dark:bg-[#222] rounded-3xl px-4 py-2.5 flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={replyTo ? `Répondre à ${replyTo.name}...` : 'Ajouter un commentaire...'}
                className="w-full bg-transparent text-[14px] focus:outline-none text-gray-900 dark:text-white placeholder-gray-500"
              />
            </div>

            <button
              type="submit"
              disabled={!content.trim() || postMutation.isPending}
              className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 transition-transform active:scale-95 shadow-md mb-0.5"
            >
              {postMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4 ml-0.5" strokeWidth={2.5} />
              }
            </button>
          </form>
        ) : (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 bg-[#F5F5F5] dark:bg-[#222] rounded-3xl px-4 py-2.5 text-center">
              <span className="text-[13px] text-gray-500 dark:text-gray-400">Connectez-vous pour commenter</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
