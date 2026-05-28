import { useParams, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { chatApi } from '@/features/chat/api'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface BookingReceipt {
  id: string
  status: string
  totalPaid: number
  quantity: number
  createdAt: string
  event: {
    id: string
    title: string
    coverUrl?: string
    startAt: string
    endAt: string
    city?: string
    address?: string
    price: number
    currency: string
    creator: {
      id: string
      profile?: { displayName: string; avatarUrl?: string }
    }
  }
}

export function PaymentReceipt() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()

  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['payment-receipt', bookingId],
    queryFn: async () => {
      const res = await apiClient.get<BookingReceipt>(`/payments/booking/${bookingId}`)
      return res.data
    },
    enabled: !!bookingId,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-action-primary" />
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white px-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Reçu introuvable</h2>
        <p className="text-sm text-gray-400 mb-6">Ce reçu n'existe pas ou vous n'y avez pas accès.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-action-primary text-white rounded-full font-semibold"
        >
          Retour
        </button>
      </div>
    )
  }

  const event = booking.event
  const startDate = new Date(event.startAt)
  const formattedTime = format(startDate, "HH:mm", { locale: fr })

  const goToChat = async () => {
    if (!event) return
    try {
      const conv = await chatApi.getEventConversation(event.id)
      navigate(`/chat/${conv.id}`)
    } catch (err: any) {
      navigate('/messages')
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white px-5 pt-16 pb-10">

      {/* Success section — centered top area */}
      <div className="flex flex-col items-center justify-center text-center mt-16 mb-10">

        {/* Green checkmark circle — matches the design exactly */}
        <div className="mb-6 relative">
          {/* Soft green glow behind */}
          <div className="absolute inset-0 rounded-full bg-green-100 scale-110 opacity-60" />
          {/* SVG: light green filled circle + bold double-check */}
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10"
          >
            <circle cx="36" cy="36" r="36" fill="#D1FAE5" />
            {/* First checkmark (lighter, slightly offset left) */}
            <path
              d="M20 37L27 44"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Second (main) bold checkmark */}
            <path
              d="M24 37L33 46L52 27"
              stroke="#10B981"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-[22px] font-bold text-gray-900 mb-2">Participation confirmée !</h1>
        <p className="text-[14px] text-gray-500">
          Vous avez rejoint l'événement avec succès.
        </p>
      </div>

      {/* Event card */}
      <div className="bg-white rounded-[20px] border border-gray-200 px-5 py-5 flex flex-col items-center text-center mb-8">
        <h2 className="font-bold text-[18px] text-gray-900 mb-2 leading-snug">{event.title}</h2>
        <p className="text-[13px] text-gray-500 mb-1">
          {format(new Date(event.startAt), "EEE, dd MMM yyyy", { locale: fr })} • {formattedTime} GMT
        </p>
        {(event.address || event.city) && (
          <p className="text-[13px] text-gray-500 mb-5">
            {event.address || ''}{event.address && event.city ? ' • ' : ''}{event.city || ''}
          </p>
        )}
        {/* Green Participant badge — wide pill */}
        <div className="bg-[#16A34A] text-white text-[13px] font-bold rounded-[8px] px-6 py-2 mt-2">
          Participant
        </div>
      </div>

      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/events/${event.id}`)}
          className="flex-1 py-[14px] rounded-full border border-gray-300 bg-white text-gray-800 font-semibold text-[14px] active:scale-95 transition-transform"
        >
          Retour à l'événement
        </button>
        <button
          onClick={goToChat}
          className="flex-1 py-[14px] rounded-full bg-action-primary text-white font-bold text-[14px] active:scale-95 transition-transform"
        >
          Accéder au chat
        </button>
      </div>

    </div>
  )
}
