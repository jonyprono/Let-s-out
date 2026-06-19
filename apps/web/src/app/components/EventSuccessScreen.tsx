import { useNavigate, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function EventSuccessScreen() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: eventData } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getById(id!).then(r => r.data),
    enabled: !!id,
  })

  const event = eventData

  if (!event) return null

  const parseSafeDate = (dateStr: any): Date => {
    if (!dateStr) return new Date()
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) return d
    return new Date()
  }

  const startDate = parseSafeDate(event.startAt)
  let formattedDate = '--'
  let formattedHour = '--'
  try {
    formattedDate = format(startDate, "d MMMM yyyy", { locale: fr })
    formattedHour = format(startDate, "HH'h'", { locale: fr })
  } catch {}

  const handleOpenChat = async () => {
    navigate(`/events/${id}`)
  }

  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-safe-4 pt-4 pb-3 flex items-center">
        <button
          onClick={() => navigate(`/events/${id}`)}
          className="w-9 h-9 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-gray-900" strokeWidth={2.5} />
        </button>
        <span className="flex-1 text-center text-[16px] font-semibold text-gray-900 -ml-9">Rejoindre l'événement</span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-40 flex flex-col items-center" style={{ scrollbarWidth: 'none' }}>

        {/* Success icon */}
        <div className="mt-10 mb-5">
          <div
            className="w-[80px] h-[80px] rounded-full flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #4CD964, #34C759)' }}
          >
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <path d="M9 19.5L16 26.5L29.5 11.5" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-[22px] font-bold text-[#2E7D32] mb-3 text-center">Participation validée !</h1>
        <p className="text-[13px] text-gray-500 text-center mb-8 leading-relaxed px-4">
          Votre participation est confirmée pour cet événement. Rejoignez le groupe de discussion et découvrez les autres participants.
        </p>

        {/* Summary card */}
        <div className="w-full rounded-2xl border border-gray-100 shadow-sm bg-white p-5">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">{event.title}</h2>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <span className="text-[13px] text-gray-500 shrink-0">Date</span>
              <span className="text-[13px] font-semibold text-gray-900 text-right capitalize">
                {formattedDate}, {formattedHour}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[13px] text-gray-500 shrink-0">Lieu</span>
              <span className="text-[13px] font-semibold text-gray-900 text-right">
                {event.address ? `${event.address}` : ''}{event.city ? ` (${event.city})` : event.address ? '' : 'Lieu non précisé'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-gray-500 shrink-0">Votre participation</span>
              <span className="text-[13px] font-semibold text-gray-900">
                {event.price > 0 ? `${event.price.toLocaleString()} F` : 'Gratuit'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Sticky footer */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white px-5 pt-3 flex flex-col gap-3"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <button
          onClick={handleOpenChat}
          className="w-full py-[14px] rounded-full font-bold text-[15px] text-white bg-[#FF7A00] active:scale-95 transition-transform shadow-md shadow-orange-500/20"
        >
          Rejoindre le groupe
        </button>
        <button
          onClick={() => navigate(`/events/${id}`)}
          className="w-full py-[14px] rounded-full font-bold text-[15px] text-gray-700 border border-gray-200 bg-white active:scale-95 transition-transform"
        >
          Retour à l'événement
        </button>
      </div>
    </div>
  )
}
