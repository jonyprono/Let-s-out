import { useTranslation } from 'react-i18next'

/**
 * Badge « En cours » (événement commencé et pas encore terminé) : point rouge pulsé + libellé.
 * Le point est décoratif ; le libellé est lu par les lecteurs d'écran.
 */
export function LiveBadge({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const { t } = useTranslation()
  const dot = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-red-600 text-white font-bold uppercase tracking-wide shadow-sm ${
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[11px]'
      } ${className}`}
    >
      <span className={`relative flex ${dot}`} aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 motion-safe:animate-ping" />
        <span className={`relative inline-flex rounded-full bg-white ${dot}`} />
      </span>
      <span>{t('eventStatus.live')}</span>
    </span>
  )
}
