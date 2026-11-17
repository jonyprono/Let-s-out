import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { apiClient } from '@/lib/api-client'
import { hapticFeedback } from '@/lib/haptics'
import { useAuthStore } from '@/stores/auth.store'
import type { LikeResult } from './api'

/**
 * « J'aime » d'une publication de page, ENREGISTRÉ en base (avant : état local perdu).
 * Optimiste (cœur rempli tout de suite + vibration légère), annulé si le serveur refuse ;
 * l'état envoyé est explicite ({ liked }) : un double appui rapide ne s'inverse pas côté serveur.
 */
export function usePostLike({ pageId, postId, liked: initialLiked, likesCount: initialCount }: {
  pageId: string; postId: string; liked: boolean; likesCount: number
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const [liked, setLiked] = useState(initialLiked)
  const [likesCount, setLikesCount] = useState(initialCount)
  const seq = useRef(0)

  // Données rafraîchies par le parent (autre écran, rechargement du fil)
  useEffect(() => { setLiked(initialLiked); setLikesCount(initialCount) }, [initialLiked, initialCount, postId])

  const toggle = async () => {
    if (!me) { toast.info(t('social.loginToLike')); return }
    hapticFeedback.impact()
    const next = !liked
    const before = { liked, likesCount }
    setLiked(next)
    setLikesCount((c) => Math.max(0, c + (next ? 1 : -1)))
    const mySeq = ++seq.current
    try {
      const { data } = await apiClient.post<LikeResult>(`/pages/${pageId}/posts/${postId}/like`, { liked: next })
      if (mySeq !== seq.current) return // un appui plus récent fait foi
      setLiked(data.liked)
      setLikesCount(data.likesCount)
      qc.invalidateQueries({ queryKey: ['feed', 'pages'] })
      qc.invalidateQueries({ queryKey: ['pages', pageId, 'posts'] })
    } catch {
      if (mySeq !== seq.current) return
      setLiked(before.liked)
      setLikesCount(before.likesCount)
      toast.error(t('social.likeError'))
    }
  }

  return { liked, likesCount, toggle }
}
