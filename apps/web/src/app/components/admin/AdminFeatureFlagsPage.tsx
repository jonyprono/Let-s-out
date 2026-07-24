import { useState } from 'react'
import { useAdminFeatureFlags, FLAG_KEYS } from '@/features/admin/useFeatureFlags'
import { toast } from 'sonner'

const DEFAULT_FLAGS = [
  {
    key: FLAG_KEYS.PROFILE_PRO_BANNER,
    label: 'Bandeau Pass Let\'s Out PRO',
    description: 'Affiche la bannière publicitaire "Pass Let\'s Out PRO" sur la page Profil utilisateur.',
    icon: '⭐',
    section: 'Profil',
  },
  {
    key: FLAG_KEYS.SETTINGS_PRO_BANNER,
    label: 'Bandeau PRO (Paramètres)',
    description: 'Affiche la bannière publicitaire "Pass Let\'s Out PRO" dans les paramètres de l\'application.',
    icon: '⚙️',
    section: 'Paramètres',
  },
  {
    key: FLAG_KEYS.EVENT_TRANSPORT_CARD,
    label: 'Carte "S\'y rendre"',
    description: 'Affiche la section navigation GPS sur la page Détails Événement.',
    icon: '🗺️',
    section: 'Événement',
  },
  {
    key: FLAG_KEYS.ENABLE_NON_VOTER_PENALTIES,
    label: 'Pénalités pour abstentionnistes',
    description: 'Active les pénalités globales si un participant ne valide ni ne délègue à la fin du délai (sa part est débloquée automatiquement).',
    icon: '⚖️',
    section: 'Cagnotte',
  },
  {
    key: FLAG_KEYS.NEW_EVENT_BROADCAST,
    label: 'Diffusion des nouveaux événements',
    description: "Envoie automatiquement une notification push à TOUS les utilisateurs quand un nouvel événement public est créé. Utile au lancement — à désactiver quand la base d'utilisateurs grandit.",
    icon: '📣',
    section: 'Événement',
  },
]

export default function AdminFeatureFlagsPage() {
  const { flags, isLoading, toggle, isToggling } = useAdminFeatureFlags()
  const [toggling, setToggling] = useState<string | null>(null)

  const getFlag = (key: string) => flags.find(f => f.key === key)

  const handleToggle = async (key: string, currentValue: boolean) => {
    setToggling(key)
    try {
      toggle(key, !currentValue)
      toast.success(`Section "${DEFAULT_FLAGS.find(f => f.key === key)?.label}" ${!currentValue ? 'activée' : 'désactivée'}`)
    } catch {
      toast.error('Impossible de mettre à jour le flag')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Feature Flags</h1>
        <p className="text-white/50 text-sm">
          Activez ou désactivez des sections de l'application sans redéploiement. Les changements sont effectifs en moins de 10 minutes.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {DEFAULT_FLAGS.map((def) => {
            const flag = getFlag(def.key)
            const isActive = flag?.isActive ?? false
            const isCurrentlyToggling = toggling === def.key || isToggling

            return (
              <div
                key={def.key}
                className={`relative flex items-center justify-between p-5 rounded-2xl border transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : 'bg-white/[0.04] border-white/[0.08]'
                }`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                    isActive ? 'bg-orange-500/20' : 'bg-white/[0.06]'
                  }`}>
                    {def.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-[15px]">{def.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                        isActive
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <p className="text-white/50 text-[13px] mt-0.5 leading-snug">{def.description}</p>
                    <span className="text-white/30 text-[11px] mt-1 inline-block">
                      Section : {def.section} · Clé : <code className="font-mono">{def.key}</code>
                    </span>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => handleToggle(def.key, isActive)}
                  disabled={isCurrentlyToggling}
                  className={`relative ml-4 shrink-0 w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                    isActive ? 'bg-orange-500' : 'bg-white/20'
                  } ${isCurrentlyToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  aria-checked={isActive}
                  role="switch"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                      isActive ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-white/40 text-xs leading-relaxed">
          💡 <strong className="text-white/60">Cache :</strong> Les flags sont mis en cache 10 minutes côté client. 
          Une modification sera visible pour tous les utilisateurs au prochain rechargement ou après 10 minutes.
        </p>
      </div>
    </div>
  )
}
