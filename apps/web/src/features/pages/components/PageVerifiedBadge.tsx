import { useTranslation } from 'react-i18next'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

export type PageVerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
export type PageVerificationBadge = 'BLUE' | 'GOLD'

/** Couleurs du badge officiel d'une page certifiée. */
const BADGE_COLORS: Record<PageVerificationBadge, string> = {
  BLUE: '#1D9BF0',
  GOLD: '#E8A800',
}

interface PageVerifiedBadgeProps {
  page?: { verificationStatus?: PageVerificationStatus | null; verificationBadge?: PageVerificationBadge | null } | null
  size?: number
  className?: string
}

/** Badge coché officiel affiché à côté du nom d'une page certifiée (rien sinon). */
export function PageVerifiedBadge({ page, size = 16, className }: PageVerifiedBadgeProps) {
  const { t } = useTranslation()
  if (page?.verificationStatus !== 'VERIFIED') return null
  const badge = page.verificationBadge ?? 'BLUE'
  return (
    <VerifiedBadge
      size={size}
      className={className}
      color={BADGE_COLORS[badge]}
      title={badge === 'GOLD' ? t('pageVerification.badgeGold') : t('pageVerification.badgeBlue')}
    />
  )
}
