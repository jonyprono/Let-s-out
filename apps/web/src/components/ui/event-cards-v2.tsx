import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useState, useRef } from 'react'
import { Share2, MessageCircle, Star, Heart } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { Event } from '@/features/events/api'
import { useFavoritesStore } from '@/stores/favorites.store'
import { ShareModal } from '@/components/shared/ShareModal'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import { useNavigate } from 'react-router'

// ─── Shared: Attendee Avatars Row ────────────────────────────────────────────
function AttendeesRow({ attendees, count, size = 24 }: {
  attendees?: { avatarUrl?: string | null; displayName?: string }[]
  count: number
  size?: number
}) {
  const visible = attendees?.slice(0, 3) ?? []
  const extra = Math.max(0, count - visible.length)

  if (count === 0 && visible.length === 0) return null

  return (
    <div className="flex items-center">
      <div className="flex" style={{ marginRight: extra > 0 ? 0 : 4 }}>
        {visible.map((a, i) => (
          <div
            key={i}
            style={{
              width: size, height: size,
              borderRadius: '50%',
              border: '2px solid rgba(0,0,0,0.5)',
              marginLeft: i > 0 ? -size / 3 : 0,
              overflow: 'hidden',
              background: '#555',
              flexShrink: 0,
              zIndex: visible.length - i,
              position: 'relative'
            }}
          >
            {a.avatarUrl ? (
              <img src={a.avatarUrl} alt={a.displayName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#FF7A00', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: size * 0.38, fontWeight: 700 }}>
                {(a.displayName || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {extra > 0 && (
          <div
            style={{
              width: size, height: size,
              borderRadius: '50%',
              border: '2px solid rgba(0,0,0,0.5)',
              marginLeft: -size / 3,
              background: '#FF7A00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: size * 0.33, fontWeight: 700,
              flexShrink: 0, zIndex: 0, position: 'relative'
            }}
          >
            +{extra > 99 ? '99' : extra}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Shared: Feed Interaction Bar (Like / Comment / Share) ────────────────────
const EMOJIS = ['❤️', '🔥', '😍', '👀', '🎉'] as const

function FeedInteractionBar({
  event,
  organizerId,
  dark = false,
}: {
  event: Event
  organizerId?: string
  dark?: boolean
}) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showShareModal, setShowShareModal] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const currentUser = useAuthStore(s => s.user)
  const [optimisticAction, setOptimisticAction] = useState<{ emoji: string | null, diff: number } | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch live reaction counts for this event card
  const { data: reactionsData } = useQuery({
    queryKey: ['events', event.id, 'reactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Record<string, { count: number; users: any[] }> }>(
        `/events/${event.id}/reactions`
      )
      return res.data.data
    },
    initialData: () => {
      const init = (event.reactions ?? []).reduce(
        (acc: Record<string, { count: number; users: any[] }>, r: { emoji: string }) => {
          if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [] }
          acc[r.emoji].count++
          return acc
        },
        {}
      )
      return Object.keys(init).length > 0 ? init : undefined
    },
    staleTime: 15_000,
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  const totalReactions =
    reactionsData
      ? Object.values(reactionsData).reduce((s, v) => s + v.count, 0)
      : (event._count?.reactions ?? 0)

  // Compute myEmoji securely from fresh reactionsData instead of relying on the feed's event object
  const myEmoji = currentUser && reactionsData
    ? Object.entries(reactionsData).find(([_, data]) => data.users.some(u => u.id === currentUser.id))?.[0] ?? null
    : event.reactions?.[0]?.emoji ?? null

  const reactionMutation = useMutation({
    mutationFn: async (emoji: string) => {
      const res = await apiClient.post<{ success: boolean; action: string; data?: unknown }>(
        `/events/${event.id}/reactions`,
        { emoji }
      )
      return { emoji, action: res.data.action }
    },
    onMutate: (emoji) => {
      const isRemoving = myEmoji === emoji
      setOptimisticAction({
        emoji: isRemoving ? null : emoji,
        diff: isRemoving ? -1 : (myEmoji ? 0 : 1)
      })
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['events', event.id, 'reactions'] })
      // Clear optimistic state ONLY AFTER the fresh reactions data has been fetched
      setOptimisticAction(null)
    },
  })

  // Long press → show emoji picker  |  Short tap → toggle ❤️
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation()
    longPressTimer.current = setTimeout(() => setShowEmojiPicker(true), 450)
  }
  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation()
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (reactionMutation.isPending) return
    if (!showEmojiPicker) reactionMutation.mutate('❤️')
  }
  const handleEmojiSelect = (emoji: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShowEmojiPicker(false)
    if (reactionMutation.isPending) return
    reactionMutation.mutate(emoji)
  }

  const tc = dark ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'
  const ac = 'text-[#FF7A00]'

  const currentEmoji = optimisticAction !== null ? optimisticAction.emoji : myEmoji
  const computedReactions = Math.max(0, totalReactions + (optimisticAction?.diff || 0))

  return (
    <>
      <div
        className={`flex items-center ${dark ? 'border-t border-white/10' : 'border-t border-gray-100 dark:border-[#2A2A2A]'} pt-2.5 mt-2`}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Like ── */}
        <div className="relative flex-1 flex">
          <button
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            disabled={reactionMutation.isPending}
            className={`flex items-center justify-center gap-1.5 w-full py-0.5 text-[13px] font-medium transition-colors ${reactionMutation.isPending ? 'opacity-50' : ''} ${currentEmoji ? ac : tc}`}
          >
            <span className="text-[15px] leading-none flex items-center justify-center">
              {currentEmoji ? currentEmoji : <Heart className="w-[15px] h-[15px]" strokeWidth={2.5} />}
            </span>
            {computedReactions > 0 && <span>{computedReactions}</span>}
          </button>

          {showEmojiPicker && (
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex items-center gap-1 bg-white dark:bg-[#222] rounded-full shadow-2xl px-3 py-2 z-50 border border-gray-100 dark:border-white/10"
              onMouseLeave={() => setShowEmojiPicker(false)}
            >
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={e => handleEmojiSelect(emoji, e)}
                  className="text-2xl hover:scale-125 active:scale-110 transition-transform leading-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={`w-px h-4 ${dark ? 'bg-white/15' : 'bg-gray-200 dark:bg-white/10'}`} />

        {/* ── Comment ── */}
        <button
          onClick={() => navigate(`/events/${event.id}/comments`, {
            state: { organizerId, eventTitle: event.title, coverUrl: event.coverUrl ?? event.mediaUrls?.[0] }
          })}
          className={`flex items-center justify-center gap-1.5 flex-1 py-0.5 text-[13px] font-medium ${tc}`}
        >
          <MessageCircle className="w-[15px] h-[15px]" />
          {(event._count?.comments ?? 0) > 0 && <span>{event._count!.comments}</span>}
        </button>

        <div className={`w-px h-4 ${dark ? 'bg-white/15' : 'bg-gray-200 dark:bg-white/10'}`} />

        {/* ── Share ── */}
        <button
          onClick={() => setShowShareModal(true)}
          className={`flex items-center justify-center gap-1.5 flex-1 py-0.5 text-[13px] font-medium ${tc}`}
        >
          <Share2 className="w-[15px] h-[15px]" />
        </button>
      </div>

      {showShareModal && (
        <ShareModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  )
}

export function FeaturedEventCard({
  event,
  onClick,
  attendees,
  badge = 'À LA UNE'
}: {
  event: Event
  onClick?: () => void
  attendees?: { avatarUrl?: string | null; displayName?: string }[]
  badge?: string
}) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore()
  const isSaved = isFavorite(event.id)
  const [showShareModal, setShowShareModal] = useState(false)
  
  const onSaveToggle = () => {
    if (isSaved) removeFavorite(event.id)
    else addFavorite(event)
  }

  const startDate = new Date(event.startAt)
  const dateStr = format(startDate, "EEE. d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Lieu à définir'

  const attendeesList = attendees || ((event as any).bookings || []).map((b: any) => ({
    avatarUrl: b.user?.profile?.avatarUrl,
    displayName: b.user?.profile?.displayName || b.user?.firstName || b.user?.email || '?'
  }))

  return (
    <div
      onClick={onClick}
      className="relative shrink-0 snap-start rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{ width: 'min(82vw, 290px)', height: 'clamp(140px, 20vh, 180px)' }}
    >
      {/* Cover image */}
      <SafeImage
        src={event.coverUrl ?? undefined}
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover"
        fallback={
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />
        }
      />
      {/* Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Top row: badge + heart */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
        <div className="flex items-center gap-1 bg-[#B45309] px-2 py-1 rounded-lg pointer-events-auto">
          <span className="text-[10px]">⭐</span>
          <span className="text-white text-[10px] font-bold tracking-wider">{badge}</span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={e => { e.stopPropagation(); setShowShareModal(true); }}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSaveToggle?.(); }}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
          >
            <Star className="w-4 h-4" fill={isSaved ? '#FF7A00' : 'none'} stroke={isSaved ? '#FF7A00' : 'white'} />
          </button>
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <h3 className="font-bold text-[17px] leading-snug mb-2 line-clamp-2">
          {event.title} {event.viewCount > 100 ? '🔥' : ''}
        </h3>

        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center gap-1.5 text-[11px] text-white/85">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
            <span className="capitalize">{dateStr}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/85">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span className="truncate">{location}</span>
          </div>
        </div>

        {/* Attendees row + Comments */}
        <div className="flex items-center justify-between">
          <AttendeesRow
            attendees={attendeesList}
            count={event.currentAttendees}
            size={24}
          />
          {((event as any)._count?.comments ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/90 bg-black/30 px-2 py-1 rounded-full backdrop-blur-sm">
              <MessageCircle className="w-3.5 h-3.5 text-white/90" />
              <span>{(event as any)._count?.comments}</span>
            </div>
          )}
        </div>
      </div>
      
      {showShareModal && (
        <ShareModal eventId={event.id} eventTitle={event.title} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  )
}

// ─── 2. SquareEventCard ─ "En vedette" (Explorer) ────────────────────────────
export function SquareEventCard({
  event,
  onClick,
  attendees,
  badge = 'POPULAIRE'
}: {
  event: Event
  onClick?: () => void
  attendees?: { avatarUrl?: string | null; displayName?: string }[]
  badge?: string
}) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore()
  const isSaved = isFavorite(event.id)
  const [showShareModal, setShowShareModal] = useState(false)
  
  const onSaveToggle = () => {
    if (isSaved) removeFavorite(event.id)
    else addFavorite(event)
  }

  const startDate = new Date(event.startAt)
  const dateStr = format(startDate, 'd MMM yyyy • HH:mm', { locale: fr })
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Lieu à définir'
  const isPast = startDate < new Date()

  const attendeesList = attendees || ((event as any).bookings || []).map((b: any) => ({
    avatarUrl: b.user?.profile?.avatarUrl,
    displayName: b.user?.profile?.displayName || b.user?.firstName || b.user?.email || '?'
  }))

  return (
    <div
      onClick={onClick}
      className="relative shrink-0 snap-start rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{ width: 'clamp(145px, 40vw, 175px)', height: 'clamp(155px, 21vh, 190px)' }}
    >
      <SafeImage
        src={event.coverUrl ?? undefined}
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Badge + Heart */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between pointer-events-none">
        <div className="bg-[#FF7A00] px-2 py-0.5 rounded-md pointer-events-auto">
          <span className="text-white text-[9px] font-bold tracking-wider uppercase">{badge}</span>
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={e => { e.stopPropagation(); setShowShareModal(true); }}
            className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSaveToggle?.(); }}
            className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95"
          >
            <Star className="w-4 h-4" fill={isSaved ? '#FF7A00' : 'none'} stroke={isSaved ? '#FF7A00' : 'white'} />
          </button>
        </div>
      </div>

      {/* Bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <h3 className="font-bold text-[14px] leading-snug mb-1.5 line-clamp-2">{event.title}</h3>
        <div className="flex flex-col gap-0.5 mb-2">
          <div className="flex items-center gap-1 text-[10px] text-white/80">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-white/80">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
            <span className="truncate">{location}</span>
          </div>
        </div>

        {/* Attendees + Rating + Comments */}
        <div className="flex items-center justify-between mt-1">
          <AttendeesRow attendees={attendeesList} count={event.currentAttendees} size={20} />
          <div className="flex items-center gap-2">
            {((event as any)._count?.comments ?? 0) > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-semibold text-white/90 bg-black/30 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                <MessageCircle className="w-3 h-3 text-white/90" />
                <span>{(event as any)._count?.comments}</span>
              </div>
            )}
            {isPast && (
              <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FFB340]">
                <span>⭐</span>
                <span>{(event as any).averageRating ?? 4.8}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareModal eventId={event.id} eventTitle={event.title} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  )
}

// ─── 3. RowEventCard ─ "Populaires / Près de vous" ───────────────────────────
export function RowEventCard({
  event,
  onClick,
  layout = 'responsive',
}: {
  event: Event
  onClick?: () => void
  layout?: 'responsive' | 'compact'
}) {
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore()
  const isSaved = isFavorite(event.id)

  const onSaveToggle = () => {
    if (isSaved) removeFavorite(event.id)
    else addFavorite(event)
  }

  const startDate = new Date(event.startAt)
  const day = format(startDate, 'dd')
  const month = format(startDate, 'MMM', { locale: fr }).toUpperCase().replace('.', '')
  const fullDate = format(startDate, "EEE. d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Lieu à définir'
  const hasCagnotte = (event.poolTarget ?? 0) > 0

  const tags = event.tags || []
  const isCompact = layout === 'compact'
  
  // Status check for "Événement à venir"
  const isUpcoming = event.startAt > new Date()
  
  return (
    <div
      className="flex flex-col w-full bg-white dark:bg-[#1A1A1A] rounded-[24px] overflow-visible shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] border border-gray-100 dark:border-white/5 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div 
        className={`flex overflow-hidden rounded-[24px] ${isCompact ? 'flex-row h-[120px]' : 'flex-col sm:flex-row sm:h-[180px]'}`} 
        onClick={onClick}
      >
        {/* Left/Top: Image area */}
        <div 
          className={`relative shrink-0 ${isCompact ? 'w-[120px] h-full' : 'w-full h-[220px] sm:w-[180px] sm:h-full'}`}
        >
          <SafeImage
            src={event.coverUrl ?? undefined}
            alt={event.title}
            className="w-full h-full object-cover"
            fallback={<div className="w-full h-full bg-gray-200 dark:bg-gray-800" />}
          />
          <div className="absolute inset-0 bg-black/10" />
          
          {/* Top-left: Date Badge */}
          <div className="absolute top-3 left-3 bg-[#111] dark:bg-black rounded-[14px] flex flex-col items-center justify-center shadow-lg border border-white/10" style={{ width: 46, height: 50 }}>
            <span className="text-white font-bold text-[18px] leading-none mt-1">{day}</span>
            <span className="text-gray-300 font-bold text-[9px] leading-none mt-0.5 tracking-wide">{month}</span>
            <div className="w-4 h-0.5 bg-[#FF7A00] rounded-full mt-1.5" />
          </div>

          {/* Bottom-left: Status Badge (only if upcoming and not compact) */}
          {isUpcoming && !isCompact && (
            <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-[#FF7A00]" />
              <span className="text-white text-[10px] font-semibold tracking-wide">Événement à venir</span>
            </div>
          )}
        </div>

        {/* Right/Bottom: Content area */}
        <div className="flex-1 px-4 py-3 flex flex-col justify-between overflow-hidden bg-white dark:bg-[#1A1A1A]">
          <div>
            {/* Title & Favorite */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <h4 className="font-extrabold text-[16px] sm:text-[18px] text-[#0B1526] dark:text-white leading-tight line-clamp-1">
                {event.title}
              </h4>
              <button
                onClick={e => { e.stopPropagation(); onSaveToggle(); }}
                className="w-8 h-8 rounded-full border border-gray-100 dark:border-white/10 flex items-center justify-center -mt-1 active:scale-95 transition-transform shrink-0 bg-white dark:bg-[#222]"
              >
                <Star className="w-4 h-4" fill={isSaved ? '#FF7A00' : 'none'} stroke={isSaved ? '#FF7A00' : '#888'} />
              </button>
            </div>
            
            {/* Description (only if not compact) */}
            {!isCompact && event.description && (
              <p className="text-[13px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-3 pr-2">
                {event.description}
              </p>
            )}

            <div className={`flex flex-col gap-1.5 ${isCompact ? 'mt-1' : ''}`}>
              {/* Date */}
              <div className="flex items-center gap-2 text-[12px] text-[#FF7A00] font-bold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
                <span className="capitalize truncate">{fullDate}</span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                <span className="truncate">{location}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between">
            {/* Participants & Tags */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="7" r="4"/><path d="M3 20c0-3.866 2.686-7 6-7s6 3.134 6 7" strokeLinecap="round"/><path d="M16 3.5a4 4 0 0 1 0 7M21 20c0-3.866-2.686-7-6-7" strokeLinecap="round"/></svg>
                <span>
                  <span className="text-[#FF7A00] font-bold">{event.currentAttendees}</span>
                  {event.maxAttendees ? `/${event.maxAttendees}` : ''} participants
                </span>
              </div>
              
              {/* Tags (only if not compact) */}
              {!isCompact && tags.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {tags.slice(0, 3).map((tag: any, idx: number) => (
                    <span key={idx} className="bg-[#F4F1FF] dark:bg-[#6C5DD3]/10 text-[#6C5DD3] dark:text-[#8D82E0] px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap">
                      {tag.name ?? tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cagnotte Button */}
            {hasCagnotte && (
              <div className="bg-[#FFF8F3] dark:bg-[#FF7A00]/10 text-[#FF7A00] px-3 py-1.5 rounded-[10px] text-[11px] font-bold border border-[#FF7A00]/20 flex items-center gap-1">
                <div className="w-3.5 h-3.5 bg-[#FF7A00] text-white rounded-full flex items-center justify-center text-[9px]">$</div>
                Cagnotte
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Separator & Interaction bar */}
      <div className="mx-4 h-px bg-gray-100 dark:bg-white/5" />
      <div className="px-4 py-2">
        <FeedInteractionBar event={event} />
      </div>
    </div>
  )
}
