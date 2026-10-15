import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi, Page } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { Loader2, Plus } from 'lucide-react'

type TabType = 'decouvrir' | 'invitations' | 'suivies'

export function PagesHub() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('decouvrir')

  const { data: myPages, isLoading: loadingMyPages } = useQuery({
    queryKey: ['pages', 'me'],
    queryFn: () => pagesApi.getMyPages(),
  })

  return (
    <div className="flex flex-col w-full min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      {/* TopBar */}
      <TopBar title="Pages" onBack={() => navigate(-1)} />

      {/* Tabs Header + Créer Button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('decouvrir')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === 'decouvrir'
                ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Découvrir
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === 'invitations'
                ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Invitations
          </button>
          <button
            onClick={() => setActiveTab('suivies')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeTab === 'suivies'
                ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            Suivies
          </button>
        </div>

        {/* Orange Créer Button */}
        <button
          onClick={() => navigate('/pages/create')}
          className="bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-all shrink-0 ml-2"
        >
          Créer
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {activeTab === 'decouvrir' && (
          <div className="flex flex-col gap-6">
            {/* Vos pages */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Vos pages</h2>
              {loadingMyPages ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" />
                </div>
              ) : myPages && myPages.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {myPages.map((p: Page) => (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/pages/${p.id}`)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer active:scale-[0.99] transition-all border border-gray-100 dark:border-gray-800"
                    >
                      <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center font-bold text-gray-700 dark:text-gray-300">
                        {p.avatarUrl ? (
                          <SafeImage src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          p.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{p.category || 'Page'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center">
                  <p className="text-xs text-gray-500 mb-2">Vous n'avez pas encore créé de page</p>
                  <button
                    onClick={() => navigate('/pages/create')}
                    className="inline-flex items-center gap-1 text-xs text-[#FF7A00] font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Créer une page
                  </button>
                </div>
              )}
            </div>

            {/* Pages suggérées */}
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Pages suggérées</h2>
              <div className="flex flex-col gap-3">
                {[
                  { name: "Let's Out", subtitle: "John, Lisa et 8 autres amis suivent cette page" },
                  { name: "Eventify", subtitle: "Suivi par 1200 personnes" },
                  { name: "Unchill", subtitle: "John, Lisa et 8 autres amis suivent cette page" },
                ].map((sug, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-start gap-3 bg-[#FAFAFA] dark:bg-[#141414]"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {sug.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{sug.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{sug.subtitle}</p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <button className="flex-1 bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white text-xs font-semibold py-1.5 rounded-full transition-all">
                          Suivre
                        </button>
                        <button className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium py-1.5 rounded-full active:scale-95 transition-all">
                          Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Invitations</h2>
            <div className="p-8 text-center text-gray-500 text-xs">
              Aucune invitation en attente pour le moment.
            </div>
          </div>
        )}

        {activeTab === 'suivies' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Pages suivies</h2>
            <div className="p-8 text-center text-gray-500 text-xs">
              Vous ne suivez aucune page pour le moment.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
