import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'
import { hapticFeedback } from '@/lib/haptics'

/**
 * Raccourci flottant vers OUT RADAR (page d'accueil), au-dessus de la barre de navigation,
 * en bas à droite — même emplacement que le bouton « carte » d'Explorer.
 */
export function RadarFab() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div
      className="fixed right-5 z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
    >
      <button
        type="button"
        onClick={() => { hapticFeedback.impact(); navigate('/radar') }}
        aria-label={t('home.openRadar')}
        className="group relative flex items-center gap-2 h-12 pl-3 pr-4 rounded-full bg-white dark:bg-[#1A1A1A] border border-[#FF7A00]/25 shadow-[0_6px_20px_rgba(255,122,0,0.25)] active:scale-95 transition-transform"
      >
        <span className="relative flex w-8 h-8 items-center justify-center rounded-full bg-[#FF7A00]" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-[#FF7A00] opacity-40 motion-safe:animate-ping" />
          <Radio className="relative w-4 h-4 text-white" strokeWidth={2.25} />
        </span>
        <span className="text-[12px] font-extrabold tracking-wide text-[#FF7A00]">OUT RADAR</span>
      </button>
    </div>
  )
}
