import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { ChevronLeft, X, Lock } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type Rule = { field: string; operator: 'EQ' | 'GT' | 'GTE' | 'LT' | 'LTE'; value: number }
type ConditionLogic = { type: 'AND' | 'OR'; rules: Rule[] }

type BadgeData = {
  id: string
  name: string
  description: string
  icon: string
  category: 'standard' | 'rare' | 'legendary'
  xpReward: number
  conditionsLogic: ConditionLogic
  isActive: boolean
  isEarned: boolean
  earnedAt: string | null
}

type UserStats = {
  eventsCreated: number
  eventsJoined: number
  friendsCount: number
  rating: number
  accountAgeDays: number
  votesParticipated: number
  timesAppointedValidator: number
  validationsPerformed: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  standard: '#3B82F6',
  rare: '#8B5CF6',
  legendary: '#FBBF24',
}

const METRIC_LABELS: Record<string, string> = {
  eventsCreated: 'événements créés',
  eventsJoined: 'événements rejoints',
  friendsCount: 'amis',
  rating: 'étoiles de note',
  accountAgeDays: 'jours d\'ancienneté',
  votesParticipated: 'votes auxquels vous avez participé',
  timesAppointedValidator: 'fois désigné validateur',
  validationsPerformed: 'validations effectuées',
}

function getProgress(badge: BadgeData, stats: UserStats): { current: number; target: number; label: string } | null {
  const rules = badge.conditionsLogic?.rules
  if (!rules || rules.length === 0) return null
  // Show progression for the first meaningful GTE/GT rule
  const rule = rules.find(r => r.operator === 'GTE' || r.operator === 'GT')
  if (!rule) return null
  const current = (stats as any)[rule.field] ?? 0
  const target = rule.operator === 'GT' ? rule.value + 1 : rule.value
  return { current, target, label: METRIC_LABELS[rule.field] || rule.field }
}

// ── Hexagon ────────────────────────────────────────────────────────────────────

const Hexagon = ({ color, children, size = 48 }: { color: string; children: React.ReactNode; size?: number }) => (
  <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-sm" style={{ fill: color }}>
      <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" />
    </svg>
    <div className="relative z-10 text-xl leading-none">{children}</div>
  </div>
)

// ── Badge Detail Modal ─────────────────────────────────────────────────────────

function BadgeDetailModal({
  badge,
  stats,
  isOwnProfile,
  onClose,
}: {
  badge: BadgeData
  stats: UserStats | null
  isOwnProfile: boolean
  onClose: () => void
}) {
  const color = categoryColors[badge.category] || '#3B82F6'
  const prog = isOwnProfile && stats ? getProgress(badge, stats) : null
  const pct = prog ? Math.min(100, Math.round((prog.current / prog.target) * 100)) : 0

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-t-[28px] shadow-2xl pb-safe"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 20px)' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-4 pb-2 flex flex-col items-center text-center">
          {/* Icon */}
          <div className={`mb-4 drop-shadow-lg ${!badge.isEarned ? 'grayscale opacity-60' : ''}`}>
            <Hexagon color={badge.isEarned ? color : '#9CA3AF'} size={80}>
              <span className="text-3xl">{badge.icon}</span>
            </Hexagon>
          </div>

          {/* Category pill */}
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-2"
            style={{ background: color + '20', color }}
          >
            {badge.category}
          </span>

          {/* Name */}
          <h2 className="text-[20px] font-bold text-black mb-2 leading-tight">{badge.name}</h2>

          {/* Description */}
          <p className="text-[14px] text-gray-500 leading-relaxed mb-5">{badge.description}</p>

          {/* XP Reward */}
          {badge.xpReward > 0 && (
            <div className="flex items-center gap-2 bg-[#FFF8F3] border border-orange-100 rounded-xl px-4 py-2 mb-5">
              <span className="text-lg">⭐</span>
              <span className="text-[13px] font-bold text-[#FF7A00]">+{badge.xpReward} XP à l'obtention</span>
            </div>
          )}

          {/* Progression — own profile only */}
          {isOwnProfile && (
            <div className="w-full">
              {badge.isEarned ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  <span className="text-lg">✅</span>
                  <div className="text-left">
                    <p className="text-[13px] font-bold text-green-700">Badge obtenu !</p>
                    {badge.earnedAt && (
                      <p className="text-[11px] text-green-600">
                        Le {new Date(badge.earnedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ) : prog ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[12px] font-semibold text-gray-600 capitalize">
                      {prog.label}
                    </span>
                    <span className="text-[12px] font-bold text-gray-800">{prog.current} / {prog.target}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 text-right">{pct}% complété</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <p className="text-[13px] text-gray-500">Attribution manuelle par l'équipe</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}

// ── BadgeCard ──────────────────────────────────────────────────────────────────

function BadgeCard({
  badge,
  stats,
  isOwnProfile,
  onClick,
}: {
  badge: BadgeData
  stats: UserStats | null
  isOwnProfile: boolean
  onClick: () => void
}) {
  const color = categoryColors[badge.category] || '#3B82F6'
  const prog = isOwnProfile && stats && !badge.isEarned ? getProgress(badge, stats) : null
  const pct = prog ? Math.min(100, Math.round((prog.current / prog.target) * 100)) : 0

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-2xl p-2.5 flex flex-col items-center text-center shadow-[0_2px_10px_rgba(0,0,0,0.04)] active:scale-95 transition-transform w-full"
    >
      <div className={`mb-2 drop-shadow-sm ${!badge.isEarned ? 'grayscale opacity-60' : ''}`}>
        <Hexagon color={badge.isEarned ? color : '#9CA3AF'} size={44}>
          {badge.icon}
        </Hexagon>
      </div>
      <span className="text-[10px] font-bold text-black leading-tight mb-1 line-clamp-2 min-h-[24px] flex items-center justify-center w-full">
        {badge.name}
      </span>
      {isOwnProfile && !badge.isEarned && prog ? (
        <div className="w-full mt-auto pt-1">
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-0.5">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
          </div>
          <span className="text-[8px] text-gray-400 font-bold">{prog.current}/{prog.target}</span>
        </div>
      ) : badge.isEarned && badge.earnedAt ? (
        <span className="text-[8px] text-gray-400 font-medium mt-auto">
          {new Date(badge.earnedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </span>
      ) : (
        <span className="text-[8px] text-gray-300 mt-auto">En attente</span>
      )}
    </button>
  )
}

// ── BadgesPage ─────────────────────────────────────────────────────────────────

export function BadgesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'tous' | 'en_cours' | 'obtenus'>('tous')
  const [selectedBadge, setSelectedBadge] = useState<BadgeData | null>(null)

  // This page is always the own profile view (accessed from /badges)
  const isOwnProfile = true

  const evaluateMutation = useMutation({
    mutationFn: async () => apiClient.post('/users/me/badges/evaluate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-badges'] }),
  })

  useEffect(() => {
    evaluateMutation.mutate()
  }, [])

  const { data: badges = [], isLoading } = useQuery<BadgeData[]>({
    queryKey: ['my-badges'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/badges')
      return res.data.data
    },
  })

  // Fetch real stats only when on own profile
  const { data: stats } = useQuery<UserStats>({
    queryKey: ['my-badge-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/badges/stats')
      return res.data.data
    },
    enabled: isOwnProfile,
  })

  const earnedBadges = badges.filter(b => b.isEarned)
  const lockedBadges = badges.filter(b => !b.isEarned)
  const rareBadges = earnedBadges.filter(b => b.category === 'rare')
  const legendaryBadges = earnedBadges.filter(b => b.category === 'legendary')

  const filteredBadges =
    activeTab === 'obtenus' ? earnedBadges
    : activeTab === 'en_cours' ? lockedBadges
    : badges

  const totalXp = earnedBadges.reduce((acc, b) => acc + (b.xpReward || 0), 0)
  const currentLevel = Math.floor((1 + Math.sqrt(1 + 8 * totalXp / 100)) / 2)
  const xpForCurrentLevel = (100 * currentLevel * (currentLevel - 1)) / 2
  const xpForNextLevel = (100 * (currentLevel + 1) * currentLevel) / 2
  const xpProgressInLevel = totalXp - xpForCurrentLevel
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel
  const levelProgressPct = Math.min(100, Math.round((xpProgressInLevel / xpNeededForNextLevel) * 100))


  return (
    <div
      className="flex flex-col w-full bg-white"
      style={{ minHeight: '100dvh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Header — sticky, respects status bar */}
      <div className="pt-[env(safe-area-inset-top,44px)] pb-3 px-4 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-50 border-b border-gray-100/50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-black active:opacity-50">
          <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <h1 className="text-[17px] font-bold text-black tracking-tight">Mes Badges & Récompenses</h1>
        <div className="w-10" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-10" style={{ scrollbarWidth: 'none' }}>

        {/* Banner Niveau */}
        <div className="bg-[#FFF8F3] rounded-[20px] p-5 mb-5 flex flex-col relative overflow-hidden mt-4">
          <div className="absolute top-4 left-4 w-16 h-16 bg-[#FF7A00]/20 rounded-full blur-xl" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="drop-shadow-md">
              <Hexagon color="url(#orangeGradient)" size={64}>
                <span className="text-white font-bold text-xl">{currentLevel}</span>
              </Hexagon>
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
              <h2 className="text-[18px] font-bold text-black leading-tight">Niveau {currentLevel}</h2>
              <p className="text-[13px] text-gray-500 font-medium mt-0.5">Vous progressez bien !</p>
            </div>
          </div>
          <div className="mt-5 relative z-10">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden mr-3">
                <div className="h-full bg-[#FF7A00] rounded-full" style={{ width: `${levelProgressPct}%` }} />
              </div>
              <span className="text-[11px] text-gray-400 font-bold tracking-tight shrink-0">{xpProgressInLevel} / {xpNeededForNextLevel} XP</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2 mb-6 text-center">
          <div className="flex flex-col items-center py-1">
            <span className="text-lg mb-1">🛡️</span>
            <span className="text-[16px] font-bold text-black">{earnedBadges.length}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">Obtenus</span>
          </div>
          <div className="flex flex-col items-center py-1">
            <span className="text-lg mb-1">⏳</span>
            <span className="text-[16px] font-bold text-black">{lockedBadges.length}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">En cours</span>
          </div>
          <div className="flex flex-col items-center py-1">
            <span className="text-lg mb-1">🏆</span>
            <span className="text-[16px] font-bold text-black">{rareBadges.length}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">Rares</span>
          </div>
          <div className="flex flex-col items-center py-1">
            <span className="text-lg mb-1">👑</span>
            <span className="text-[16px] font-bold text-black">{legendaryBadges.length}</span>
            <span className="text-[10px] text-gray-500 font-medium leading-tight px-1">Légendaires</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/80 p-1 rounded-2xl mb-6">
          {[
            { id: 'tous', label: 'Tous les badges' },
            { id: 'en_cours', label: 'En cours' },
            { id: 'obtenus', label: 'Obtenus' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 text-[13px] font-bold rounded-[14px] transition-all ${
                activeTab === tab.id ? 'bg-[#FF7A00] text-white shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-[#FF7A00] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredBadges.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="text-4xl mb-3">🏅</span>
            <p className="text-[15px] font-semibold text-gray-700 mb-1">
              {activeTab === 'obtenus' ? 'Aucun badge obtenu' : 'Tous les badges sont obtenus !'}
            </p>
            <p className="text-[13px] text-gray-400">
              {activeTab === 'obtenus' ? 'Continuez à être actif pour en gagner.' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grid */}
            <div className="grid grid-cols-4 gap-2">
              {filteredBadges.map(badge => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  stats={stats ?? null}
                  isOwnProfile={isOwnProfile}
                  onClick={() => setSelectedBadge(badge)}
                />
              ))}
            </div>

            {/* Bottom Banner */}
            <div className="bg-[#FFF8F3] border border-orange-100 rounded-[16px] p-4 flex gap-3 items-center">
              <span className="text-xl shrink-0">🏆</span>
              <p className="text-[11px] text-gray-600 font-medium leading-relaxed">
                Continuez ainsi ! Plus vous êtes actif, plus vous gagnez des récompenses exclusives.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <BadgeDetailModal
          badge={selectedBadge}
          stats={stats ?? null}
          isOwnProfile={isOwnProfile}
          onClose={() => setSelectedBadge(null)}
        />
      )}
    </div>
  )
}
