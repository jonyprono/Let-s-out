import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { MapPin, Calendar, Users } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { Event } from '@/features/events/api'
import { SaveEventButton } from '@/components/ui/save-event-button'

// ==========================================
// 1. FeaturedEventCard (À ne pas manquer)
// ==========================================
export function FeaturedEventCard({
  event,
  onClick,
  onSaveToggle,
  isSaved = false
}: {
  event: Event
  onClick?: () => void
  onSaveToggle?: () => void
  isSaved?: boolean
}) {
  const startDate = new Date(event.startAt)
  const formattedDate = format(startDate, "EEE d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  
  // Mock attendees avatars for the UI design
  const attendeesAvatars = [
    'https://i.pravatar.cc/100?img=11',
    'https://i.pravatar.cc/100?img=12',
    'https://i.pravatar.cc/100?img=13'
  ]
  const extraAttendees = Math.max(0, event.currentAttendees - 3)

  return (
    <div 
      onClick={onClick}
      className="relative w-[320px] sm:w-[350px] h-[200px] rounded-3xl overflow-hidden shrink-0 snap-center shadow-md active:scale-[0.98] transition-transform cursor-pointer"
    >
      {/* Background Image with Gradient Overlay */}
      <SafeImage
        src={event.coverUrl || undefined}
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover"
        fallback={<div className="w-full h-full bg-gray-800" />}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

      {/* Top badges */}
      <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
        <div className="bg-[#B45309]/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
          <span>⭐</span> À LA UNE
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <SaveEventButton saved={isSaved} onClick={onSaveToggle} />
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="font-bold text-[18px] leading-tight mb-2 truncate pr-4">
          {event.title} {event.viewCount > 100 ? '🔥' : ''}
        </h3>
        
        <div className="flex flex-col gap-1 text-[11px] text-gray-200 mb-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span className="capitalize">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span className="truncate">{event.city || 'Lieu à définir'}{event.country ? `, ${event.country}` : ''}</span>
          </div>
        </div>

        {/* Avatars */}
        {event.currentAttendees > 0 && (
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {attendeesAvatars.slice(0, Math.min(event.currentAttendees, 3)).map((avatar, i) => (
                <div key={i} className="w-6 h-6 rounded-full border border-black overflow-hidden bg-gray-200">
                  <img src={avatar} alt="Participant" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            {extraAttendees > 0 && (
              <div className="w-6 h-6 rounded-full border border-black bg-[#FF7A00] flex items-center justify-center text-[9px] font-bold text-white -ml-2 relative z-10">
                +{extraAttendees}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


// ==========================================
// 2. SquareEventCard (En vedette)
// ==========================================
export function SquareEventCard({
  event,
  onClick,
  onSaveToggle,
  isSaved = false,
  badgeText = "POPULAIRE"
}: {
  event: Event
  onClick?: () => void
  onSaveToggle?: () => void
  isSaved?: boolean
  badgeText?: string
}) {
  const startDate = new Date(event.startAt)
  const formattedDate = format(startDate, "d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  
  const attendeesAvatars = [
    'https://i.pravatar.cc/100?img=21',
    'https://i.pravatar.cc/100?img=22',
    'https://i.pravatar.cc/100?img=23'
  ]
  const extraAttendees = Math.max(0, event.currentAttendees - 3)

  return (
    <div 
      onClick={onClick}
      className="relative w-[180px] sm:w-[200px] h-[220px] rounded-2xl overflow-hidden shrink-0 snap-center shadow-md active:scale-[0.98] transition-transform cursor-pointer"
    >
      <SafeImage
        src={event.coverUrl || undefined}
        alt={event.title}
        className="absolute inset-0 w-full h-full object-cover"
        fallback={<div className="w-full h-full bg-gray-800" />}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
        <div className="bg-[#FF7A00]/90 backdrop-blur text-white text-[9px] font-bold px-2 py-1 rounded flex items-center gap-1 uppercase tracking-wider">
          {badgeText}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <SaveEventButton saved={isSaved} onClick={onSaveToggle} />
        </div>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <h3 className="font-bold text-[15px] leading-tight mb-1.5 truncate">
          {event.title}
        </h3>
        
        <div className="flex flex-col gap-1 text-[10px] text-gray-200 mb-2">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-white/70" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-white/70" />
            <span className="truncate">{event.city || 'Lieu à définir'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {attendeesAvatars.slice(0, Math.min(event.currentAttendees, 3)).map((avatar, i) => (
              <div key={i} className="w-5 h-5 rounded-full border border-black overflow-hidden bg-gray-200">
                <img src={avatar} alt="Participant" className="w-full h-full object-cover" />
              </div>
            ))}
            {extraAttendees > 0 && (
              <div className="w-5 h-5 rounded-full border border-black bg-[#FF7A00] flex items-center justify-center text-[8px] font-bold text-white relative z-10">
                +{extraAttendees}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FFB340]">
            <span>⭐</span> 4.8
          </div>
        </div>
      </div>
    </div>
  )
}


// ==========================================
// 3. RowEventCard (Événements populaires / Près de vous)
// ==========================================
export function RowEventCard({
  event,
  onClick,
  onSaveToggle,
  isSaved = false
}: {
  event: Event
  onClick?: () => void
  onSaveToggle?: () => void
  isSaved?: boolean
}) {
  const startDate = new Date(event.startAt)
  const day = format(startDate, 'dd')
  const month = format(startDate, 'MMM', { locale: fr }).toUpperCase().replace('.', '')
  
  const fullDate = format(startDate, "EEE. d MMM yyyy • HH:mm 'GMT'", { locale: fr })
  
  const hasCagnotte = event.poolTarget && event.poolTarget > 0

  return (
    <div 
      onClick={onClick}
      className="flex w-full bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-[#333] active:scale-[0.98] transition-transform cursor-pointer h-[110px]"
    >
      {/* Left Image with Date Box Overlay */}
      <div className="relative w-[110px] h-full shrink-0">
        <SafeImage
          src={event.coverUrl || undefined}
          alt={event.title}
          className="w-full h-full object-cover"
          fallback={<div className="w-full h-full bg-gray-200 dark:bg-gray-800" />}
        />
        <div className="absolute inset-0 bg-black/10" />
        
        {/* Date Box Overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-[#222] rounded-xl flex flex-col items-center justify-center w-[48px] h-[52px] shadow-sm">
          <span className="text-[#FF7A00] font-bold text-[18px] leading-none">{day}</span>
          <span className="text-gray-900 dark:text-white font-bold text-[10px] leading-none mt-1">{month}</span>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 p-3 flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-bold text-[15px] text-gray-900 dark:text-white leading-tight truncate">
            {event.title}
          </h4>
          <div onClick={(e) => e.stopPropagation()} className="-mt-1 -mr-1">
            <SaveEventButton saved={isSaved} onClick={onSaveToggle} />
          </div>
        </div>

        <div className="flex flex-col gap-1 mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span className="capitalize truncate">{fullDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{event.city || 'Lieu à définir'}</span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
            <Users className="w-3.5 h-3.5" />
            <span>
              <span className="text-[#FF7A00]">{event.currentAttendees}</span>
              {event.maxAttendees ? `/${event.maxAttendees}` : ''} Participants
            </span>
          </div>
          
          {hasCagnotte && (
            <div className="bg-[#FFF2D3] dark:bg-[#FF7A00]/10 text-[#FF7A00] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#FF7A00]/20">
              Cagnotte
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
