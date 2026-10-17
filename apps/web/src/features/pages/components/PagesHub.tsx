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

  // Real pages created by user
  const { data: myPages, isLoading: loadingMyPages } = useQuery({
    queryKey: ['pages', 'me'],
    queryFn: () => pagesApi.getMyPages(),
  })

  // Local interactive states for suggestions, invitations and follows
  const [suggestedPages, setSuggestedPages] = useState([
    { id: '1', name: "Let's Out", subtitle: 'John, Léa et 8 autres amis suivent cette page' },
    { id: '2', name: 'Eventhub', subtitle: 'Suivie par 1200 personnes' },
    { id: '3', name: 'Unchill', subtitle: 'John, Léa et 8 autres amis suivent cette page' },
  ])

  const [invitations, setInvitations] = useState([
    {
      id: 'inv-1',
      inviter: 'Patrick',
      pageName: "Let's Out",
      subtitle: 'John, Léa et 8 autres amis suivent cette page',
      status: 'pending' as 'pending' | 'accepted' | 'declined',
    },
    {
      id: 'inv-2',
      inviter: 'Patrick',
      pageName: 'Unchill',
      subtitle: 'Suivie par 1200 autres personnes',
      status: 'pending' as 'pending' | 'accepted' | 'declined',
    },
    {
      id: 'inv-3',
      inviter: 'Patrick',
      pageName: 'FestiVibes',
      subtitle: 'John, Léa et 8 autres amis suivent cette page',
      status: 'pending' as 'pending' | 'accepted' | 'declined',
    },
  ])

  const [followedPages, setFollowedPages] = useState([
    { id: 'f-1', name: "Let's Out" },
    { id: 'f-2', name: 'Festihub' },
    { id: 'f-3', name: 'Holidays Vibes' },
    { id: 'f-4', name: 'Tech Events' },
    { id: 'f-5', name: 'Education for all' },
  ])

  const handleFollowSuggestion = (sug: { id: string; name: string }) => {
    setSuggestedPages((prev) => prev.filter((p) => p.id !== sug.id))
    setFollowedPages((prev) => [...prev, { id: sug.id, name: sug.name }])
  }

  const handleRemoveSuggestion = (id: string) => {
    setSuggestedPages((prev) => prev.filter((p) => p.id !== id))
  }

  const handleAcceptInvitation = (invId: string, pageName: string) => {
    setInvitations((prev) =>
      prev.map((inv) => (inv.id === invId ? { ...inv, status: 'accepted' } : inv))
    )
    if (!followedPages.some((f) => f.name === pageName)) {
      setFollowedPages((prev) => [...prev, { id: invId, name: pageName }])
    }
  }

  const handleDeclineInvitation = (invId: string) => {
    setInvitations((prev) =>
      prev.map((inv) => (inv.id === invId ? { ...inv, status: 'declined' } : inv))
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden">
      {/* TopBar avec titre et bouton Créer à droite - Safe Area Aware */}
      <TopBar
        title="Pages"
        onBack={() => navigate(-1)}
        containerClassName="pt-safe-4 pt-4 shrink-0 border-b border-gray-100 dark:border-gray-800"
        rightAction={
          <button
            onClick={() => navigate('/pages/create')}
            className="bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-all shrink-0 shadow-sm shadow-[#FF7A00]/20"
          >
            Créer
          </button>
        }
      />

      {/* Tabs Header */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto hide-scrollbar shrink-0 bg-white dark:bg-black">
        <button
          onClick={() => setActiveTab('decouvrir')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === 'decouvrir'
              ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20 font-semibold'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Découvrir
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === 'invitations'
              ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20 font-semibold'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Invitations
        </button>
        <button
          onClick={() => setActiveTab('suivies')}
          className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === 'suivies'
              ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20 font-semibold'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
          }`}
        >
          Suivies
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 px-4 py-4 overflow-y-auto max-w-lg mx-auto w-full pb-24" style={{ scrollbarWidth: 'none' }}>
        {/* ── 1. DÉCOUVRIR ── */}
        {activeTab === 'decouvrir' && (
          <div className="flex flex-col gap-6">
            {/* Vos pages */}
            <div>
              <h2 className="text-xs font-bold text-gray-900 dark:text-white mb-3">Vos pages</h2>
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
                      className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer active:scale-[0.99] transition-all border border-gray-100 dark:border-gray-800"
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
              <h2 className="text-xs font-bold text-gray-900 dark:text-white mb-3">Pages suggérées</h2>
              <div className="flex flex-col gap-3">
                {suggestedPages.map((sug) => (
                  <div
                    key={sug.id}
                    className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-start gap-3 bg-[#FAFAFA] dark:bg-[#141414]"
                  >
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {sug.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{sug.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {sug.subtitle}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleFollowSuggestion(sug)}
                          className="flex-1 bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white text-xs font-semibold py-1.5 rounded-full transition-all shadow-sm shadow-[#FF7A00]/20"
                        >
                          Suivre
                        </button>
                        <button
                          onClick={() => handleRemoveSuggestion(sug.id)}
                          className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium py-1.5 rounded-full active:scale-95 transition-all"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {suggestedPages.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">
                    Aucune autre suggestion pour le moment.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 2. INVITATIONS ── */}
        {activeTab === 'invitations' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white">Invitations</h2>
            <div className="flex flex-col gap-3">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-start gap-3 bg-[#FAFAFA] dark:bg-[#141414]"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                    {inv.pageName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">
                      <span className="font-semibold text-gray-900 dark:text-white">{inv.inviter}</span> vous invite à suivre{' '}
                      <span className="font-bold text-gray-900 dark:text-white">{inv.pageName}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{inv.subtitle}</p>

                    <div className="mt-3">
                      {inv.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptInvitation(inv.id, inv.pageName)}
                            className="flex-1 bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white text-xs font-semibold py-1.5 rounded-full transition-all shadow-sm shadow-[#FF7A00]/20"
                          >
                            Suivre
                          </button>
                          <button
                            onClick={() => handleDeclineInvitation(inv.id)}
                            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium py-1.5 rounded-full active:scale-95 transition-all"
                          >
                            Décliner
                          </button>
                        </div>
                      )}

                      {inv.status === 'accepted' && (
                        <div className="w-full py-1.5 rounded-full bg-[#FFF2D3] dark:bg-[#FF7A00]/20 text-[#FF7A00] text-xs font-semibold text-center">
                          Suivie
                        </div>
                      )}

                      {inv.status === 'declined' && (
                        <p className="text-[11px] text-gray-400 italic">
                          Vous avez décliné cette invitation
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. SUIVIES ── */}
        {activeTab === 'suivies' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-bold text-gray-900 dark:text-white">Pages suivies</h2>
            <div className="flex flex-col gap-2.5">
              {followedPages.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between bg-[#FAFAFA] dark:bg-[#141414]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 text-sm">
                      {item.name.charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</span>
                  </div>

                  <span className="px-4 py-1.5 rounded-full bg-[#FFF2D3] dark:bg-[#FF7A00]/20 text-[#FF7A00] text-xs font-semibold">
                    Suivie
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
