import { useState, useEffect, useRef } from 'react'
import i18n from '@/lib/i18n'
import { Send, Ban, Flag, X, MessageCircle } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import type { RadarSearchResult } from '../api'
import { useTranslation } from 'react-i18next'
import { useUserProfile } from '@/features/users/UserProfileContext'

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_AVATARS_ON_RADAR = 12
const AVATAR_APPEAR_DELAY_MS = 150

const TIER_TO_RING: Record<string, number> = {
  IMMEDIATE: 0,
  UNDER_1KM: 1,
  UNDER_3KM: 2,
  UNDER_5KM: 3,
  UNDER_10KM: 3,
}

const RING_FRACS = [0.27, 0.46, 0.63, 0.77]

const AVATAR_SIZE = 40

/** Anneaux de recherche : décalage (s), épaisseur (px), taille fixe si « Réduire les animations » */
const RADAR_PULSES = [
  { delay: 0, width: 2, rest: 0.35 },
  { delay: 0.65, width: 1.6, rest: 0.65 },
  { delay: 1.3, width: 1.2, rest: 0.95 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h
}

function computePositions(
  results: RadarSearchResult[],
  sessionId: string,
  cx: number,
  cy: number,
  radius: number
): Array<{ x: number; y: number; result: RadarSearchResult }> {
  const byRing: Record<number, RadarSearchResult[]> = { 0: [], 1: [], 2: [], 3: [] }
  for (const r of results) {
    const ring = TIER_TO_RING[r.proximityTier ?? 'UNDER_5KM'] ?? 3
    byRing[ring].push(r)
  }

  const positions: Array<{ x: number; y: number; result: RadarSearchResult }> = []

  for (let ringIdx = 0; ringIdx < 4; ringIdx++) {
    const items = byRing[ringIdx]
    if (!items.length) continue
    const rPx = RING_FRACS[ringIdx] * radius
    const spread = 360 / items.length

    items.forEach((item, i) => {
      const offset = ((hashStr(sessionId + item.id) % 30) + 30) % 30
      const angleDeg = i * spread + offset
      const angleRad = (angleDeg * Math.PI) / 180
      positions.push({
        x: cx + rPx * Math.cos(angleRad),
        y: cy + rPx * Math.sin(angleRad),
        result: item,
      })
    })
  }

  return positions
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarViewProps {
  isSearching: boolean
  searchCountdown?: number
  /** Durée totale du scan (s) : sert à faire apparaître les profils sur le radar au fil du scan */
  scanDurationSec?: number
  /** Ouverture d'un profil (l'écran Radar conserve alors son dernier scan pour le retour) */
  onOpenProfile?: (userId: string) => void
  results: RadarSearchResult[] | undefined
  sessionId: string
  onSendInvite: (profile: RadarSearchResult) => void
  onBlockUser: (id: string, name: string) => void
  onReportUser: (id: string) => void
  onModifyFilters: () => void
  onWidenRadius: () => void
  listRef?: React.RefObject<HTMLDivElement>
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function RadarView({
  isSearching,
  searchCountdown,
  scanDurationSec,
  onOpenProfile,
  results,
  sessionId,
  onSendInvite,
  onBlockUser,
  onReportUser,
  onModifyFilters,
  onWidenRadius,
  listRef,
}: RadarViewProps) {
  const { t } = useTranslation()
  const { openUserProfile: openProfileDefault } = useUserProfile()
  const openUserProfile = onOpenProfile ?? openProfileDefault
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(280)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      // Cap to 90% of viewport height so the circle never gets cut off
      const maxFromHeight = Math.floor(window.innerHeight * 0.45)
      setSize(Math.min(entry.contentRect.width, 320, maxFromHeight))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 6

  const [selectedProfile, setSelectedProfile] = useState<RadarSearchResult | null>(null)
  const [visibleCount, setVisibleCount] = useState(0)

  const allResults = results ?? []
  const radarResults = allResults.slice(0, MAX_AVATARS_ON_RADAR)
  const overflowCount = Math.max(0, allResults.length - MAX_AVATARS_ON_RADAR)
  const positions = computePositions(radarResults, sessionId, cx, cy, radius)

  const hasResults = !isSearching && allResults.length > 0
  const isEmpty = !isSearching && results !== undefined && allResults.length === 0

  // Pendant le scan : chaque profil détecté apparaît sur les cercles au fil du temps (du plus
  // proche au plus éloigné), tous visibles avant la fin du décompte. La liste complète, elle,
  // n'est affichée qu'à la fin du scan (cf. OutRadar).
  const scanProgress = isSearching && typeof searchCountdown === 'number' && scanDurationSec
    ? Math.min(1, Math.max(0, 1 - searchCountdown / scanDurationSec))
    : null
  const scanVisible = scanProgress === null
    ? 0
    : positions.filter((_, i) => scanProgress >= ((i + 1) / (positions.length + 1)) * 0.9).length
  // Profils déjà apparus pendant le scan : restent affichés à la fin (pas de clignotement)
  const revealedDuringScanRef = useRef(0)
  useEffect(() => {
    if (isSearching) revealedDuringScanRef.current = scanVisible
  }, [isSearching, scanVisible])

  useEffect(() => {
    // Fin du scan : on repart du nombre de profils déjà apparus ; pendant le scan, rien à animer ici
    const start = isSearching ? 0 : revealedDuringScanRef.current
    if (!isSearching) revealedDuringScanRef.current = 0
    setVisibleCount(start)
    if (isSearching || !results || results.length === 0) return
    let count = start
    const total = Math.min(results.length, MAX_AVATARS_ON_RADAR)
    if (count >= total) return
    const timer = setInterval(() => {
      count++
      setVisibleCount(count)
      if (count >= total) clearInterval(timer)
    }, AVATAR_APPEAR_DELAY_MS)
    return () => clearInterval(timer)
  }, [isSearching, results, sessionId])

  useEffect(() => {
    if (isSearching) setSelectedProfile(null)
  }, [isSearching])

  const OUTING_LABELS: Record<string, string> = {
    SPONTANEOUS: t('radarView.sortieSpontanee'),
    RESTAURANT_BAR: 'Restaurant ou bar',
    SPECIFIC_EVENT: 'Evenement precis',
    GROUP_ACTIVITY: 'Activite de groupe',
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      {/* ── Zone Radar ───────────────────────────────────────────────────────── */}
      <div ref={wrapRef} className="w-full flex justify-center overflow-visible">
        <div
          className="relative select-none"
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">

            {/* Fond */}
            <circle cx={cx} cy={cy} r={radius + 4}
              className="fill-gray-50 dark:fill-[#0f0f0f]"
              stroke="rgba(156,163,175,0.2)" strokeWidth={1} />

            {/* Anneaux pointilles */}
            {RING_FRACS.map((frac, i) => (
              <circle key={i} cx={cx} cy={cy} r={frac * radius}
                fill="none" stroke="rgba(156,163,175,0.35)" strokeWidth={1} strokeDasharray="5 7" />
            ))}

            {/* Lignes de graduation */}
            {[0, 90, 45, 135].map((deg, i) => {
              const rad = (deg * Math.PI) / 180
              return (
                <line key={deg}
                  x1={cx + radius * Math.cos(rad)} y1={cy + radius * Math.sin(rad)}
                  x2={cx - radius * Math.cos(rad)} y2={cy - radius * Math.sin(rad)}
                  stroke={i < 2 ? 'rgba(156,163,175,0.22)' : 'rgba(156,163,175,0.12)'}
                  strokeWidth={0.75} />
              )
            })}
          </svg>

          {/* Pulse pendant recherche : 3 anneaux orange (transform: scale + opacity, cf. .radar-pulse-ring).
              Montés seulement pendant la recherche → s'arrêtent à la fin du décompte / aux résultats. */}
          {isSearching && (
            <div
              className="absolute pointer-events-none"
              style={{ left: cx - radius, top: cy - radius, width: radius * 2, height: radius * 2 }}
              aria-hidden="true"
            >
              {RADAR_PULSES.map((p, i) => (
                <span
                  key={i}
                  className="radar-pulse-ring"
                  style={{
                    borderWidth: p.width,
                    animationDelay: `${p.delay}s`,
                    ['--radar-ring-rest' as string]: p.rest,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}

          {/* Pastille centrale utilisateur */}
          <div className="absolute z-10 flex items-center justify-center rounded-full bg-[#FF7A00] border-[3px] border-white dark:border-[#0f0f0f] shadow-lg shadow-[#FF7A00]/40"
            style={{ width: 38, height: 38, left: cx - 19, top: cy - 19 }}>
            <span className="text-base leading-none">📍</span>
          </div>

          {/* Avatars */}
          {positions.map(({ x, y, result }, idx) => {
            const show = isSearching ? idx < scanVisible : idx < visibleCount
            const sel = selectedProfile?.id === result.id
            const half = AVATAR_SIZE / 2
            return (
              <button key={result.id}
                onClick={() => setSelectedProfile(sel ? null : result)}
                disabled={isSearching}
                tabIndex={show ? undefined : -1}
                className="absolute focus:outline-none group"
                style={{
                  // Pendant le scan : affichage seul (fiche ouverte à la fin du scan)
                  pointerEvents: isSearching || !show ? 'none' : undefined,
                  left: x - half, top: y - half,
                  width: AVATAR_SIZE, height: AVATAR_SIZE,
                  zIndex: sel ? 20 : 11,
                  opacity: show ? 1 : 0,
                  transform: show ? 'scale(1)' : 'scale(0.2)',
                  transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                aria-label={t('radarView.profilDe', { v0: result.displayName })}
              >
                <div className={`relative w-full h-full rounded-full overflow-hidden shadow-md border-2 transition-all duration-200 ${sel ? 'border-[#FF7A00] scale-110 shadow-[#FF7A00]/40' : 'border-white dark:border-gray-600 group-hover:border-[#FF7A00]/70 group-hover:scale-110'}`}>
                  {result.avatarUrl ? (
                    <SafeImage src={result.avatarUrl} alt={result.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-300">
                      {result.displayName?.[0]?.toUpperCase() || 'O'}
                    </div>
                  )}
                  {result.isVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-gray-900 p-0.5 flex items-center justify-center">
                      <VerifiedBadge size={13} />
                    </div>
                  )}
                </div>
              </button>
            )
          })}

          {/* Badge +N */}
          {!isSearching && overflowCount > 0 && visibleCount >= MAX_AVATARS_ON_RADAR && (
            <button
              onClick={() => listRef?.current?.scrollIntoView({ behavior: 'smooth' })}
              className="absolute z-20 flex items-center justify-center rounded-full bg-[#FF7A00] text-white font-bold border-2 border-white dark:border-[#0f0f0f] shadow-lg active:scale-95 transition-transform"
              style={{ width: 36, height: 36, left: cx + RING_FRACS[3] * radius - 18, top: cy - 18, fontSize: 10 }}
              aria-label={t('radarView.voirAutresOutsters', { v0: overflowCount })}
            >
              +{overflowCount}
            </button>
          )}

          {/* Label recherche */}
          {isSearching && (
            <div className="absolute bottom-1 left-0 right-0 flex flex-col items-center pointer-events-none">
              <p className="text-[11px] font-semibold text-[#FF7A00] tracking-wide animate-pulse">
                <span>{t('radarView.rechercheDOutstersAProximite')}</span>
              </p>
              {typeof searchCountdown === 'number' && searchCountdown > 0 && (
                <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF7A00]/15 dark:bg-[#FF7A00]/20 border border-[#FF7A00]/30 backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00] animate-ping" />
                  <span className="text-[10px] font-bold text-[#FF7A00] tracking-tight">
                    <span>{t('radarView.scanEnCours', { seconds: searchCountdown })}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Badge 0 Outster détecté quand la recherche est terminée sans résultat */}
          {!isSearching && isEmpty && (
            <div className="absolute bottom-1.5 left-0 right-0 flex flex-col items-center pointer-events-none animate-in fade-in duration-300">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-900/80 dark:bg-black/90 backdrop-blur-md border border-white/10 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-[11px] font-bold text-white tracking-tight">
                  <span>{t('radarView.n0OutsterDetecte')}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fiche apercu profil ───────────────────────────────────────────────── */}
      {selectedProfile && (
        <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="relative h-14 bg-gradient-to-r from-[#FF7A00]/20 via-orange-50 to-transparent dark:from-[#FF7A00]/10 dark:via-[#222] dark:to-[#1A1A1A]">
            <div className="absolute left-4 bottom-0 translate-y-1/2 z-10">
              <button
                type="button"
                onClick={() => openUserProfile(selectedProfile.id)}
                className="relative block rounded-full focus:outline-none active:scale-95 transition-transform"
                aria-label={t('radarView.profilDe', { v0: selectedProfile.displayName })}
              >
                <div className="w-14 h-14 rounded-full border-2 border-white dark:border-[#1A1A1A] overflow-hidden shadow-md bg-gray-200 dark:bg-gray-700">
                  {selectedProfile.avatarUrl ? (
                    <SafeImage src={selectedProfile.avatarUrl} alt={selectedProfile.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
                      {selectedProfile.displayName?.[0]?.toUpperCase() || 'O'}
                    </div>
                  )}
                </div>
                {selectedProfile.isVerified && (
                  <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white dark:bg-[#1A1A1A] p-0.5 flex items-center justify-center">
                    <VerifiedBadge size={16} />
                  </div>
                )}
              </button>
            </div>
            <button onClick={() => setSelectedProfile(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center hover:bg-black/20 transition-colors">
              <X className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          <div className="pt-9 px-4 pb-4 space-y-3">
            <div>
              <button
                type="button"
                onClick={() => openUserProfile(selectedProfile.id)}
                className="block text-left font-bold text-sm text-gray-900 dark:text-white hover:underline focus:outline-none"
              >
                <span>{selectedProfile.displayName}</span>
              </button>
              <p className="text-[11px] text-[#FF7A00] font-medium mt-0.5">{selectedProfile.proximity}</p>
            </div>

            {selectedProfile.outingType && (
              <span className="inline-block text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded-full">
                {OUTING_LABELS[selectedProfile.outingType] || selectedProfile.outingType}
              </span>
            )}

            <div className="flex items-center gap-2 pt-1">
              {selectedProfile.inviteStatus === 'PENDING' ? (
                <span className="flex-1 text-center text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 rounded-full">
                  <span>{t('radarView.demandeEnvoyee')}</span>
                </span>
              ) : selectedProfile.inviteStatus === 'ACCEPTED' ? (
                <button className="flex-1 py-2 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Discuter
                </button>
              ) : selectedProfile.canInvite ? (
                <button
                  onClick={() => { setSelectedProfile(null); onSendInvite(selectedProfile) }}
                  className="flex-1 py-2 rounded-full bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#E06C00] active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#FF7A00]/25"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('radarView.envoyerUneInvitation')}</span>
                </button>
              ) : <div className="flex-1" />}

              <button
                onClick={() => { setSelectedProfile(null); onBlockUser(selectedProfile.id, selectedProfile.displayName) }}
                className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500 hover:bg-red-100 active:scale-95 transition-all"
                aria-label={t('radarView.bloquer', { v0: selectedProfile.displayName })}>
                <Ban className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setSelectedProfile(null); onReportUser(selectedProfile.id) }}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:bg-gray-200 active:scale-95 transition-all"
                aria-label={t('radarView.signaler', { v0: selectedProfile.displayName })}>
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compteur */}
      {hasResults && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          <span className="text-[#FF7A00] font-bold">{allResults.length}</span>{' '}
          <span>{i18n.t('radarView.nearbyHint', { count: allResults.length })}</span>
        </p>
      )}

      {/* Etat vide — Résultat signalant qu'aucun outster n'a été détecté */}
      {isEmpty && (
        <div className="w-full bg-[#FFF9EC] dark:bg-[#1A1A1A] border border-[#FFE5B4] dark:border-[#333] rounded-2xl p-5 text-center space-y-3.5 shadow-sm animate-in fade-in duration-300">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-[#262626] border border-orange-200 dark:border-white/10 flex items-center justify-center mx-auto text-2xl shadow-xs">
            📡
          </div>
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-[#FF7A00]/10 text-[#FF7A00] font-bold text-xs mb-1.5">
              <span>{t('radarView.resultatDuScan0Outster')}</span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              <span>{t('radarView.aucunOutsterAProximitePour')}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
              <span>{t('radarView.leRadarNADetecte')}</span>
            </p>
          </div>
          <div className="flex gap-2.5 justify-center flex-wrap pt-1">
            <button
              onClick={onWidenRadius}
              className="px-5 py-2.5 rounded-full bg-[#FF7A00] text-white text-xs font-semibold hover:bg-[#E06C00] active:scale-95 transition-all shadow-md shadow-[#FF7A00]/25"
            >
              <span>{t('radarView.elargirLeRayon')}</span>
            </button>
            <button
              onClick={onModifyFilters}
              className="px-4 py-2.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
            >
              <span>{t('radarView.modifierLesFiltres')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
