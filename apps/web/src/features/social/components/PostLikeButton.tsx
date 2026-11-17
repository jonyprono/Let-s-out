import { useTranslation } from 'react-i18next'
import { Heart } from 'lucide-react'
import { usePostLike } from '../usePostLike'
import { compactCount } from './PostActionBar'

/**
 * Cœur + compteur d'une publication de page, autonome (utilisable dans une boucle de rendu).
 * Like enregistré, optimiste, avec retour haptique (cf. usePostLike).
 */
export function PostLikeButton({ pageId, postId, liked, likesCount, className = '', iconClassName = 'w-4 h-4', layout = 'row' }: {
  pageId: string
  postId: string
  liked?: boolean
  likesCount?: number
  className?: string
  iconClassName?: string
  /** `row` : icône + compteur côte à côte ; `stack` : compteur sous l'icône (lecteurs vidéo) */
  layout?: 'row' | 'stack'
}) {
  const { t } = useTranslation()
  const like = usePostLike({ pageId, postId, liked: Boolean(liked), likesCount: likesCount ?? 0 })
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); like.toggle() }}
      aria-pressed={like.liked}
      aria-label={`${like.liked ? t('social.unlike') : t('social.like')} (${like.likesCount})`}
      className={`flex ${layout === 'stack' ? 'flex-col' : ''} items-center justify-center gap-1 active:scale-95 transition-transform ${like.liked ? 'text-red-500' : ''} ${className}`}
    >
      <Heart className={`${iconClassName} shrink-0 transition-transform ${like.liked ? 'fill-red-500 text-red-500 scale-110' : ''}`} aria-hidden="true" />
      {(like.likesCount > 0 || layout === 'stack') && (
        <span className={`tabular-nums ${layout === 'stack' ? 'text-[11px] font-semibold text-white drop-shadow' : 'text-xs font-semibold'}`}>
          {compactCount(like.likesCount)}
        </span>
      )}
    </button>
  )
}
