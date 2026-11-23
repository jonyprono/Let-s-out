import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'
import { hapticFeedback } from '@/lib/haptics'

/**
 * Raccourci flottant vers OUT RADAR (page d'accueil), au-dessus de la barre de navigation,
 * en bas à droite — positionnement identique au bouton « carte » d'Explorer. Bouton fixe, sans animation.
 */
export function RadarFab() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div className="fixed bottom-[100px] right-5 z-[1050]">
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
