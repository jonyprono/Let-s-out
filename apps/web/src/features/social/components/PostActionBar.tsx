import { useTranslation } from 'react-i18next'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import { intlLocale } from '@/lib/locale'

/** Compteur compact : 950 · 1,2 k · 3,4 M (selon la langue) */
export function compactCount(n: number): string {
  return new Intl.NumberFormat(intlLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

interface Props {
  liked: boolean
  likesCount: number
  onLike: () => void
  commentsCount: number
  onComment?: () => void
  onShare: () => void
  /** `bordered` : séparateurs verticaux (cartes du fil) ; `plain` : espacement seul */
  variant?: 'bordered' | 'plain'
  className?: string
}

/**
 * Barre d'actions épurée (style X / Twitter) : icônes + compteurs, sans libellés.
 * Les libellés restent disponibles pour les lecteurs d'écran (aria-label).
 */
export function PostActionBar({ liked, likesCount, onLike, commentsCount, onComment, onShare, variant = 'bordered', className = '' }: Props) {
  const { t } = useTranslation()
  const sep = variant === 'bordered' ? 'border-l border-gray-100 dark:border-gray-800' : ''
  const btn = 'flex items-center justify-center gap-1.5 py-1.5 transition-colors hover:text-gray-900 dark:hover:text-white active:scale-95'

  return (
    <div className={`grid grid-cols-3 text-gray-500 dark:text-gray-400 ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onLike() }}
        aria-pressed={liked}
        aria-label={`${liked ? t('social.unlike') : t('social.like')} (${likesCount})`}
        className={`${btn} ${liked ? 'text-red-500 hover:text-red-500 dark:hover:text-red-500' : ''}`}
      >
        <Heart className={`w-[18px] h-[18px] shrink-0 transition-transform ${liked ? 'fill-red-500 text-red-500 scale-110' : ''}`} aria-hidden="true" />
        {likesCount > 0 && <span className="text-[13px] font-medium tabular-nums">{compactCount(likesCount)}</span>}
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onComment?.() }}
        disabled={!onComment}
        aria-label={t('social.commentsAria', { count: commentsCount })}
        className={`${btn} ${sep} disabled:hover:text-inherit`}
      >
        <MessageCircle className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
        {commentsCount > 0 && <span className="text-[13px] font-medium tabular-nums">{compactCount(commentsCount)}</span>}
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onShare() }}
        aria-label={t('social.share')}
        className={`${btn} ${sep}`}
      >
        <Share2 className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
      </button>
    </div>
  )
}
