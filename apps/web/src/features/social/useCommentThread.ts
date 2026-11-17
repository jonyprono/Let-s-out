import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hapticFeedback } from '@/lib/haptics'
import type { CommentSource, SocialComment } from './api'

/** Applique `fn` au commentaire `id` (racine ou réponse) */
function mapComment(list: SocialComment[], id: string, fn: (c: SocialComment) => SocialComment): SocialComment[] {
  return list.map((c) => {
    if (c.id === id) return fn(c)
    if (c.replies?.some((r) => r.id === id)) return { ...c, replies: c.replies.map((r) => (r.id === id ? fn(r) : r)) }
    return c
  })
}

/**
 * Données et actions d'un fil de commentaires : lecture, ajout (avec réponse), like optimiste
 * (affiché tout de suite, annulé si le serveur refuse) avec retour haptique, suppression.
 */
export function useCommentThread(source: CommentSource, enabled: boolean) {
  const qc = useQueryClient()
  const key = source.queryKey

  const query = useQuery({ queryKey: key, queryFn: source.list, enabled })

  const refreshRelated = () => {
    qc.invalidateQueries({ queryKey: key })
    for (const k of source.relatedKeys) qc.invalidateQueries({ queryKey: k })
  }

  const add = useMutation({
    mutationFn: ({ text, parentId }: { text: string; parentId: string | null }) => source.add(text, parentId),
    onSuccess: refreshRelated,
  })

  const like = useMutation({
    mutationFn: ({ comment }: { comment: SocialComment }) => source.like(comment.id, !comment.likedByMe),
    onMutate: async ({ comment }) => {
      hapticFeedback.impact() // léger, comme le cœur d'un réseau social
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<SocialComment[]>(key)
      const nextLiked = !comment.likedByMe
      qc.setQueryData<SocialComment[]>(key, (list) => mapComment(list ?? [], comment.id, (c) => ({
        ...c, likedByMe: nextLiked, likesCount: Math.max(0, c.likesCount + (nextLiked ? 1 : -1)),
      })))
      return { previous }
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) qc.setQueryData(key, ctx.previous) },
    onSuccess: (res, { comment }) => {
      // Valeur exacte du serveur (likes simultanés d'autres personnes)
      qc.setQueryData<SocialComment[]>(key, (list) => mapComment(list ?? [], comment.id, (c) => ({ ...c, likedByMe: res.liked, likesCount: res.likesCount })))
    },
  })

  const remove = useMutation({
    mutationFn: (commentId: string) => source.remove(commentId),
    onSuccess: refreshRelated,
  })

  return { comments: query.data ?? [], isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, add, like, remove }
}
