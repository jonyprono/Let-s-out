import { useNavigate, useParams, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
import { chatApi } from '@/features/chat/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { useState } from 'react'

export function EventSuccessScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const stateAmountPaid = location.state?.amountPaid

  const { data: eventData } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getById(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: myBookingData } = useQuery({
    queryKey: ['events', id, 'my-booking'],
    queryFn: () => eventsApi.getMyBooking(id!).then(r => r.data),
    enabled: !!id,
    retry: false
  })

  const amountPaid = stateAmountPaid !== undefined ? stateAmountPaid : (myBookingData?.totalPaid || 0)

  const [isJoiningChat, setIsJoiningChat] = useState(false)

  const goToChat = async () => {
    if (!id) return
    setIsJoiningChat(true)
    try {
      const conv = await chatApi.getEventConversation(id)
      navigate(`/chat/${conv.id}`)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 403) {
        toast.info("Rejoignez l'événement pour accéder à la discussion.")
      } else if (status === 404) {
        toast.info("Aucune discussion trouvée pour cet événement.")
      } else {
        toast.error("Impossible de démarrer la conversation")
      }
    } finally {
      setIsJoiningChat(false)
    }
  }

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



  return (
    <div className="w-full h-full bg-white dark:bg-[#1A1A1A] flex flex-col font-poppins">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-[16px] pb-[100px] flex flex-col items-center justify-center" style={{ scrollbarWidth: 'none' }}>

        {/* Success icon */}
        <div className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-[24px] relative">
          <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(243.43deg, #4DEF8E 16.67%, #FFEB3A 83.33%)' }} />
          <svg width="32" height="32" viewBox="0 0 38 38" fill="none" className="relative z-10">
            <path d="M9 19.5L16 26.5L29.5 11.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-[20px] font-semibold text-[#22C55E] mb-[12px] text-center">Participation validée !</h1>
        <p className="text-[12px] font-normal font-inter text-[#404040] text-center mb-[32px] leading-relaxed max-w-[300px]">
          Votre participation est confirmée pour cet événement. Rejoignez le groupe de discussion et découvrez les autres participants.
        </p>

        {/* Summary card */}
        <div className="w-full rounded-[8px] border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1A1A] p-[16px] shadow-sm max-w-[358px]">
          <h2 className="text-[14px] font-semibold text-[#1B1818] mb-[16px]">{event.title}</h2>
          <div className="flex flex-col gap-[12px]">
            <div className="flex items-start justify-between gap-4">
              <span className="text-[14px] font-inter text-[var(--color-text-secondary)]">Date</span>
              <span className="text-[14px] font-inter text-[#1B1818] text-right">
                {formattedDate}, {formattedHour}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-[14px] font-inter text-[var(--color-text-secondary)]">Lieu</span>
              <span className="text-[14px] font-inter text-[#1B1818] text-right">
                {event.address ? `${event.address}` : ''}{event.city ? ` (${event.city})` : event.address ? '' : 'Lieu non précisé'}
              </span>
            </div>
            {amountPaid > 0 && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-[14px] font-inter text-[var(--color-text-secondary)]">Votre participation</span>
                <span className="text-[14px] font-inter text-[#1B1818] text-right">
                  {amountPaid.toLocaleString('fr-FR')} F
                </span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 px-[16px] py-[12px] bg-white dark:bg-[#1A1A1A] max-w-[390px] mx-auto w-full z-40 pb-safe-4 flex flex-col gap-[12px]">
        <button
          onClick={goToChat}
          disabled={isJoiningChat}
          className="w-full h-[40px] rounded-[1000px] text-white font-medium text-[14px] active:scale-95 transition-transform flex items-center justify-center disabled:opacity-70"
          style={{ background: '#FF9500' }}
        >
          {isJoiningChat ? 'Chargement...' : 'Rejoindre le groupe'}
        </button>
        <button
          onClick={() => navigate(`/events/${id}`)}
          className="w-full h-[40px] rounded-[1000px] text-[var(--color-text-primary)] font-medium text-[14px] active:scale-95 transition-transform bg-white dark:bg-[#1A1A1A] border border-[var(--border-default)]"
        >
          Retour à l'événement
        </button>
      </div>
    </div>
  )
}
