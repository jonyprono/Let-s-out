import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { SafeImage } from '@/components/shared/SafeImage'
import { Event } from '@/features/events/api'

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

// ─── 1. FeaturedEventCard ─ "À ne pas manquer" (Home) ────────────────────────
export function FeaturedEventCard({
  event,
  onClick,
  isSaved = false,
  onSaveToggle,
  attendees,
  badge = 'À LA UNE'
}: {
  event: Event
  onClick?: () => void
  isSaved?: boolean
  onSaveToggle?: () => void
  attendees?: { avatarUrl?: string | null; displayName?: string }[]
  badge?: string
}) {
  const startDate = new Date(event.startAt)
  const dateStr = format(startDate, "EEE. d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Lieu à définir'

  return (
    <div
      onClick={onClick}
      className="relative shrink-0 snap-start rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{ width: 300, height: 200 }}
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
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
        <div className="flex items-center gap-1 bg-[#B45309] px-2 py-1 rounded-lg">
          <span className="text-[10px]">⭐</span>
          <span className="text-white text-[10px] font-bold tracking-wider">{badge}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSaveToggle?.(); }}
          className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95 transition-transform"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? 'white' : 'none'} stroke="white" strokeWidth="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
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

        {/* Attendees row */}
        <AttendeesRow
          attendees={attendees}
          count={event.currentAttendees}
          size={24}
        />
      </div>
    </div>
  )
}

// ─── 2. SquareEventCard ─ "En vedette" (Explorer) ────────────────────────────
export function SquareEventCard({
  event,
  onClick,
  isSaved = false,
  onSaveToggle,
  attendees,
  badge = 'POPULAIRE'
}: {
  event: Event
  onClick?: () => void
  isSaved?: boolean
  onSaveToggle?: () => void
  attendees?: { avatarUrl?: string | null; displayName?: string }[]
  badge?: string
}) {
  const startDate = new Date(event.startAt)
  const dateStr = format(startDate, 'd MMM yyyy • HH:mm', { locale: fr })
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Lieu à définir'

  return (
    <div
      onClick={onClick}
      className="relative shrink-0 snap-start rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
      style={{ width: 180, height: 240 }}
    >
      <SafeImage
        src={event.coverUrl ?? undefined}
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" />}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Badge + Heart */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
        <div className="bg-[#FF7A00] px-2 py-0.5 rounded-md">
          <span className="text-white text-[9px] font-bold tracking-wider uppercase">{badge}</span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSaveToggle?.(); }}
          className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-95"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'white' : 'none'} stroke="white" strokeWidth="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </button>
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

        {/* Attendees + Rating */}
        <div className="flex items-center justify-between">
          <AttendeesRow attendees={attendees} count={event.currentAttendees} size={20} />
          <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FFB340]">
            <span>⭐</span>
            <span>4.8</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 3. RowEventCard ─ "Populaires / Près de vous" ───────────────────────────
export function RowEventCard({
  event,
  onClick,
  isSaved = false,
  onSaveToggle
}: {
  event: Event
  onClick?: () => void
  isSaved?: boolean
  onSaveToggle?: () => void
}) {
  const startDate = new Date(event.startAt)
  const day = format(startDate, 'dd')
  const month = format(startDate, 'MMM', { locale: fr }).toUpperCase().replace('.', '')
  const fullDate = format(startDate, "EEE. d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  const location = [event.city, event.country].filter(Boolean).join(', ') || 'Lieu à définir'
  const hasCagnotte = (event.poolTarget ?? 0) > 0

  return (
    <div
      onClick={onClick}
      className="flex w-full bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-[#2A2A2A] active:scale-[0.98] transition-transform cursor-pointer"
      style={{ height: 110 }}
    >
      {/* Left: image with date overlay */}
      <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
        <SafeImage
          src={event.coverUrl ?? undefined}
          alt={event.title}
          className="w-full h-full object-cover"
          fallback={<div className="w-full h-full bg-gray-200 dark:bg-gray-800" />}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/20" />
        {/* Date box - centered on image */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-xl flex flex-col items-center justify-center shadow-md" style={{ width: 48, height: 52 }}>
            <span className="text-[#FF7A00] font-bold text-[18px] leading-none">{day}</span>
            <span className="text-gray-900 dark:text-white font-bold text-[10px] leading-none mt-0.5">{month}</span>
          </div>
        </div>
      </div>

      {/* Right: content */}
      <div className="flex-1 px-3 py-2.5 flex flex-col justify-between overflow-hidden">
        {/* Title + heart */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-[15px] text-gray-900 dark:text-white leading-snug flex-1 line-clamp-1">
            {event.title}
          </h4>
          <button
            onClick={e => { e.stopPropagation(); onSaveToggle?.(); }}
            className="shrink-0 w-7 h-7 rounded-full bg-gray-50 dark:bg-[#2A2A2A] flex items-center justify-center -mr-0.5 active:scale-95 transition-transform"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? '#FF7A00' : 'none'} stroke={isSaved ? '#FF7A00' : '#9CA3AF'} strokeWidth="2">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#FF7A00] font-medium">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
          <span className="capitalize truncate">{fullDate}</span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <span className="truncate">{location}</span>
        </div>

        {/* Participants + Cagnotte */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="9" cy="7" r="4"/><path d="M3 20c0-3.866 2.686-7 6-7s6 3.134 6 7" strokeLinecap="round"/><path d="M16 3.5a4 4 0 0 1 0 7M21 20c0-3.866-2.686-7-6-7" strokeLinecap="round"/></svg>
            <span>
              <span className="text-[#FF7A00] font-semibold">{event.currentAttendees}</span>
              {event.maxAttendees ? `/${event.maxAttendees}` : ''} participants
            </span>
          </div>
          {hasCagnotte && (
            <div className="bg-[#FFF2D3] dark:bg-[#FF7A00]/10 text-[#FF7A00] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-[#FF7A00]/20">
              Cagnotte
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
