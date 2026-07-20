import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Medal01Icon, LockKeyIcon, StarIcon } from 'hugeicons-react'

export function BadgesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedBadge, setSelectedBadge] = useState<any>(null)

  // 1. Déclencher l'évaluation des badges en arrière-plan à l'ouverture de la page
  const evaluateMutation = useMutation({
    mutationFn: async () => apiClient.post('/users/me/badges/evaluate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-badges'] })
  })

  useEffect(() => {
    evaluateMutation.mutate()
  }, [])

  // 2. Récupérer les badges (acquis et non acquis)
  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['my-badges'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/badges')
      return res.data.data
    }
  })

  const earnedBadges = badges.filter((b: any) => b.isEarned)
  const lockedBadges = badges.filter((b: any) => !b.isEarned)

  return (
    <div className="flex flex-col w-full h-full bg-[#FAFAFA] dark:bg-[#0A0A0B] overflow-hidden">
      <TopBar 
        title="Badges & Récompenses" 
        onBack={() => navigate('/account')}
      />

      <div className="flex-1 overflow-y-auto px-4 pb-12 pt-6">
        
        {/* Header Section */}
        <div className="flex flex-col items-center justify-center mb-10 mt-2">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/20 dark:bg-orange-500/10 rounded-full blur-2xl transform scale-150"></div>
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF7A00] to-[#FFA755] rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/20 relative z-10 rotate-3">
              <Medal01Icon className="w-10 h-10 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="text-[22px] font-bold text-gray-900 dark:text-white mt-6 mb-1">Votre Collection</h2>
          <p className="text-[14px] text-gray-500 font-medium">
            {earnedBadges.length} badge{earnedBadges.length > 1 ? 's' : ''} débloqué{earnedBadges.length > 1 ? 's' : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#FF7A00] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Badges Débloqués */}
            <section>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-4 px-1 flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-[#FF7A00] fill-[#FF7A00]/20" />
                Badges Acquis
              </h3>
              
              {earnedBadges.length === 0 ? (
                <div className="bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 rounded-2xl p-6 text-center shadow-sm">
                  <p className="text-[14px] text-gray-500">Vous n'avez pas encore de badges.</p>
                  <p className="text-[13px] text-gray-400 mt-1">Participez à des événements pour en débloquer !</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {earnedBadges.map((badge: any, i: number) => (
                    <div 
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className="bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer group"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="w-14 h-14 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center text-3xl mb-3 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                        {badge.icon}
                      </div>
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight mb-1">{badge.name}</span>
                      <span className="text-[11px] text-gray-400 font-medium">Acquis le {new Date(badge.earnedAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Badges Verrouillés */}
            {lockedBadges.length > 0 && (
              <section>
                <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-4 px-1 flex items-center gap-2">
                  <LockKeyIcon className="w-5 h-5 text-gray-400" />
                  À Débloquer
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {lockedBadges.map((badge: any) => (
                    <div 
                      key={badge.id}
                      onClick={() => setSelectedBadge(badge)}
                      className="bg-gray-50 dark:bg-[#111113] border border-gray-100 dark:border-white/5 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform"
                    >
                      <div className="w-14 h-14 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center text-3xl mb-3 opacity-40 grayscale">
                        {badge.icon}
                      </div>
                      <span className="text-[14px] font-bold text-gray-500 dark:text-gray-400 leading-tight mb-1">{badge.name}</span>
                      <span className="text-[11px] text-gray-400">Cliquez pour voir</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Modal Détails du Badge */}
      {selectedBadge && (
          <>
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] animate-in fade-in"
              onClick={() => setSelectedBadge(null)}
            />
            <div 
              className="fixed top-1/2 left-4 right-4 -translate-y-1/2 bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 z-[101] flex flex-col items-center text-center shadow-2xl animate-in zoom-in-95"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4 ${selectedBadge.isEarned ? 'bg-orange-50 dark:bg-orange-500/10 shadow-inner shadow-orange-500/20' : 'bg-gray-100 dark:bg-white/5 grayscale opacity-50'}`}>
                {selectedBadge.icon}
              </div>
              <h3 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2">{selectedBadge.name}</h3>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                {selectedBadge.description}
              </p>
              
              {selectedBadge.isEarned ? (
                <div className="w-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-500 font-semibold py-3 rounded-xl text-[14px]">
                  Débloqué le {new Date(selectedBadge.earnedAt).toLocaleDateString('fr-FR')}
                </div>
              ) : (
                <div className="w-full bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium py-3 rounded-xl text-[14px] flex items-center justify-center gap-2">
                  <LockKeyIcon className="w-4 h-4" />
                  Badge verrouillé
                </div>
              )}
              
              <button 
                onClick={() => setSelectedBadge(null)}
                className="w-full bg-[#FF7A00] text-white font-bold py-3.5 rounded-xl mt-4 active:scale-[0.98] transition-transform"
              >
                Fermer
              </button>
            </div>
          </>
        )}
    </div>
  )
}
