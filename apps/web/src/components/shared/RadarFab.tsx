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
      className="fixed bottom-[100px] right-5 z-40"
    >
      <button
        type="button"
        onClick={() => { hapticFeedback.impact(); navigate('/radar') }}
        aria-label={t('home.openRadar')}
        className="relative w-11 h-11 rounded-[14px] bg-[#FF7A00] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        {/* Onde discrète (désactivée si l'utilisateur réduit les animations) */}
        <span className="absolute inset-0 rounded-[14px] bg-[#FF7A00] opacity-30 motion-safe:animate-ping" aria-hidden="true" />
        <Radio className="relative w-5 h-5 text-white" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
