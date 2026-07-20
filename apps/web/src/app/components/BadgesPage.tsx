import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { ChevronLeft } from 'lucide-react'

// Hexagon SVG wrapper for icons
const Hexagon = ({ color, children }: { color: string, children: React.ReactNode }) => (
  <div className="relative w-12 h-12 flex items-center justify-center">
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ fill: color }}>
      <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" />
    </svg>
    <div className="relative z-10 text-xl">
      {children}
    </div>
  </div>
)

export function BadgesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'tous' | 'en_cours' | 'obtenus'>('tous')

  const evaluateMutation = useMutation({
    mutationFn: async () => apiClient.post('/users/me/badges/evaluate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-badges'] })
  })

  useEffect(() => {
    evaluateMutation.mutate()
  }, [])

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['my-badges'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/badges')
      return res.data.data
    }
  })

  // For the exact UI match, we map the dynamic badges or use fallbacks for colors
  const colorMap: Record<string, string> = {
    'Early adopter': '#2DD4BF', // Teal
    'Top Organisateur': '#FBBF24', // Yellow/Gold
    'Ponctuel': '#3B82F6', // Blue
    'Fiable': '#8B5CF6', // Purple
    'Social star': '#EC4899', // Pink
    'Party Maker': '#F97316', // Orange
    'Top Donateur': '#EF4444', // Red
    'Accueillant': '#14B8A6', // Teal
  }

  const earnedBadges = badges.filter((b: any) => b.isEarned)
  const lockedBadges = badges.filter((b: any) => !b.isEarned)

  // Mock progress for locked badges to match UI
  const getMockProgress = (index: number) => {
    const mockData = [
      { current: 6, target: 10, color: '#F97316' }, // Orange
      { current: 2, target: 5, color: '#3B82F6' },  // Blue
      { current: 7, target: 20, color: '#8B5CF6' }, // Purple
      { current: 12, target: 20, color: '#6B7280' },// Gray
    ]
    return mockData[index % mockData.length]
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-white">
      {/* Header respecting safe area */}
      <div className="pt-[env(safe-area-inset-top,44px)] pb-3 px-4 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-black active:opacity-50">
          <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <h1 className="text-[17px] font-bold text-black tracking-tight">Mes Badges & Récompenses</h1>
        <div className="w-10"></div> {/* Spacer for center alignment */}
      </div>

      <div className="flex-1 px-4 pb-10">
        
        {/* Banner Niveau */}
        <div className="bg-[#FFF8F3] rounded-[20px] p-5 mb-5 flex flex-col relative overflow-hidden mt-2">
          {/* Subtle glow effect behind hexagon */}
          <div className="absolute top-4 left-4 w-16 h-16 bg-[#FF7A00]/20 rounded-full blur-xl"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 drop-shadow-md">
              <Hexagon color="url(#orangeGradient)">
                <span className="text-white font-bold text-xl">12</span>
              </Hexagon>
              {/* SVG definition for the gradient */}
              <svg width="0" height="0">
                <defs>
                  <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FF9F43" />
                    <stop offset="100%" stopColor="#FF7A00" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-[18px] font-bold text-black leading-tight">Niveau 12</h2>
              <p className="text-[13px] text-gray-500 font-medium mt-0.5">Vous progressez bien !</p>
            </div>
          </div>
          
          <div className="mt-5 relative z-10">
            <div className="flex justify-between items-end mb-2">
              <div className="w-3/4 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF7A00] rounded-full" style={{ width: '62.5%' }}></div>
              </div>
              <span className="text-[11px] text-gray-400 font-bold tracking-tight">750 / 1200 XP</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-6 text-center divide-x divide-gray-100">
          <div className="flex flex-col items-center">
            <span className="text-lg mb-1">🛡️</span>
            <span className="text-[16px] font-bold text-black">{earnedBadges.length}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">Badges obtenus</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg mb-1">🎧</span>
            <span className="text-[16px] font-bold text-black">{lockedBadges.length}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">En cours</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg mb-1">🏆</span>
            <span className="text-[16px] font-bold text-black">2</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">Rares</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg mb-1">👑</span>
            <span className="text-[16px] font-bold text-black">1</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">Légendaires</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/80 p-1 rounded-2xl mb-8">
          {[
            { id: 'tous', label: 'Tous les badges' },
            { id: 'en_cours', label: 'En cours' },
            { id: 'obtenus', label: 'Obtenus' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 text-[13px] font-bold rounded-[14px] transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#FF7A00] text-white shadow-sm' 
                  : 'text-gray-500 hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#FF7A00] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Badges Obtenus */}
            {(activeTab === 'tous' || activeTab === 'obtenus') && earnedBadges.length > 0 && (
              <section>
                <h3 className="text-[16px] font-bold text-black mb-4">Badges obtenus ({earnedBadges.length})</h3>
                <div className="grid grid-cols-4 gap-2">
                  {earnedBadges.map((badge: any) => (
                    <div key={badge.id} className="bg-white border border-gray-100 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                      <div className="mb-2.5 drop-shadow-sm">
                        <Hexagon color={colorMap[badge.name] || '#FF7A00'}>
                          {badge.icon}
                        </Hexagon>
                      </div>
                      <span className="text-[10px] font-bold text-black leading-tight mb-1 line-clamp-2 min-h-[24px] flex items-center justify-center">
                        {badge.name}
                      </span>
                      <span className="text-[8px] text-gray-500 leading-tight mb-2 line-clamp-3 min-h-[30px]">
                        {badge.description}
                      </span>
                      <span className="text-[8px] text-gray-400 font-medium mt-auto">
                        {new Date(badge.earnedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Badges En cours */}
            {(activeTab === 'tous' || activeTab === 'en_cours') && lockedBadges.length > 0 && (
              <section>
                <h3 className="text-[16px] font-bold text-black mb-4">Badges en cours ({lockedBadges.length})</h3>
                <div className="grid grid-cols-4 gap-2">
                  {lockedBadges.map((badge: any, i: number) => {
                    const mockProg = getMockProgress(i);
                    const pct = (mockProg.current / mockProg.target) * 100;
                    
                    return (
                      <div key={badge.id} className="bg-[#F8F9FA] rounded-2xl p-2.5 flex flex-col items-center text-center">
                        <div className="mb-2.5 opacity-60 grayscale drop-shadow-sm">
                          <Hexagon color="#9CA3AF">
                            {badge.icon}
                          </Hexagon>
                        </div>
                        <span className="text-[10px] font-bold text-black leading-tight mb-1 line-clamp-2 min-h-[24px] flex items-center justify-center">
                          {badge.name}
                        </span>
                        <span className="text-[8px] text-gray-500 leading-tight mb-3 line-clamp-2 min-h-[20px]">
                          {badge.description}
                        </span>
                        
                        <div className="w-full mt-auto">
                          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: mockProg.color }}></div>
                          </div>
                          <span className="text-[8px] text-gray-400 font-bold">
                            {mockProg.current} / {mockProg.target}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Bottom Banner */}
            <div className="bg-[#FFF8F3] border border-orange-100 rounded-[16px] p-4 flex gap-3 items-center">
              <span className="text-xl">🏆</span>
              <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                Continuez ainsi ! Plus vous êtes actif, plus vous gagnez des récompenses exclusives.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
