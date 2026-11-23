import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'
import { hapticFeedback } from '@/lib/haptics'

/**
 * Raccourci flottant vers OUT RADAR (page d'accueil), au-dessus de la barre de navigation,
 * en bas à droite. Rehaussé de la zone sûre système (barre de gestes Android / indicateur iOS)
 * pour rester bien dégagé au-dessus de la barre d'onglets. Bouton fixe, sans animation.
 */
export function RadarFab() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div
      className="fixed right-5 z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 115px)' }}
    >
      <button
        type="button"
        onClick={() => { hapticFeedback.impact(); navigate('/radar') }}
        aria-label={t('home.openRadar')}
        className="w-11 h-11 rounded-[14px] bg-[#FF7A00] shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      >
        <Radio className="w-5 h-5 text-white" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
