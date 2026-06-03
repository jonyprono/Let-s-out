import { useNavigate, useParams } from 'react'
import { ChevronLeft, HelpCircle, Check, MapPin, Calendar, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
import { useAuthStore } from '@/stores/auth.store'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { SafeImage } from '@/components/shared/SafeImage'

export function EventSuccessScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const { data: eventData } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getById(id!).then(r => r.data),
    enabled: !!id,
  })

  const event = eventData?.event

  if (!event) return null

  const parseSafeDate = (dateStr: any): Date => {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  };

  const startDate = parseSafeDate(event.startAt)
  const formattedDate = format(startDate, "EEEE d MMMM yyyy", { locale: fr })
  const formattedStart = format(startDate, "HH:mm", { locale: fr })

  return (
    <div className="w-full h-full bg-white flex flex-col font-sans">
      {/* Header */}
      <div className="flex-shrink-0 bg-white z-10 px-6 pt-4 pt-safe-4 pb-2 flex items-center justify-between">
        <button
          onClick={() => navigate(`/events/${id}`)}
          className="w-10 h-10 flex items-center justify-start active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6 text-gray-900" strokeWidth={2.5} />
        </button>
        
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[16px] font-bold text-gray-900">Paiement réussi</span>
        </div>

        <div className="flex items-center">
          <button className="w-8 h-8 flex items-center justify-center active:scale-95 transition-transform">
            <HelpCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-28 flex flex-col items-center pt-8">
        
        {/* Success Icon */}
        <div className="w-20 h-20 bg-[#10B981] rounded-full flex items-center justify-center shadow-[0_8px_16px_rgba(16,185,129,0.2)] mb-6">
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>

        <h1 className="text-[24px] font-bold text-gray-900 mb-1 text-center leading-tight">
          Félicitations,<br/>vous participez !
        </h1>
        <p className="text-[14px] text-gray-500 mb-8 text-center">
          Votre billet et le reçu ont été envoyés à votre adresse e-mail.
        </p>

        {/* Ticket Card */}
        <div className="w-full rounded-[24px] bg-white border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden relative">
          
          {/* Top section with cover */}
          <div className="h-[120px] relative">
            <SafeImage 
              src={event.coverUrl || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop'} 
              alt={event.title} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-[18px] font-bold text-white leading-tight">{event.title}</h2>
            </div>
          </div>

          {/* Ticket Details */}
          <div className="p-5">
            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[12px] text-gray-500 font-medium">Date</p>
                  <p className="text-[14px] font-bold text-gray-900 capitalize">{formattedDate}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[12px] text-gray-500 font-medium">Heure</p>
                  <p className="text-[14px] font-bold text-gray-900">{formattedStart} GMT</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-[12px] text-gray-500 font-medium">Lieu</p>
                  <p className="text-[14px] font-bold text-gray-900">{event.city || event.address || 'Lieu non précisé'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-200 my-4" />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-gray-500">Billet N°</span>
                <span className="text-[13px] font-bold text-gray-900 uppercase">LSO-{Math.floor(Math.random() * 1000000)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-gray-500">Participant</span>
                <span className="text-[13px] font-bold text-gray-900">{user?.profile?.displayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[13px] text-gray-500">Prix</span>
                <span className="text-[13px] font-bold text-gray-900">{event.price > 0 ? `${event.price.toLocaleString()} F CFA` : 'Gratuit'}</span>
              </div>
            </div>
          </div>
          
          {/* Ticket cutouts */}
          <div className="absolute left-[-12px] top-[120px] w-6 h-6 bg-white rounded-full border border-gray-100 shadow-[inset_-3px_0_5px_rgba(0,0,0,0.02)]" style={{ zIndex: 1 }} />
          <div className="absolute right-[-12px] top-[120px] w-6 h-6 bg-white rounded-full border border-gray-100 shadow-[inset_3px_0_5px_rgba(0,0,0,0.02)]" style={{ zIndex: 1 }} />
        </div>

      </div>

      {/* Sticky Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pt-4 flex flex-col gap-3 border-none" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
        <button
          onClick={() => navigate(`/events/${id}`)}
          className="w-full py-[14px] rounded-full font-bold text-[15px] text-gray-700 bg-gray-50 active:scale-95 transition-transform"
        >
          Retour à l'événement
        </button>
        <button
          onClick={() => {
            navigate(`/events/${id}`)
            setTimeout(() => {
              // Trigger navigation to chat after we land on event details
              // (Alternatively just navigate to /chat/:convId if we had it)
              const ev = new CustomEvent('force-open-chat', { detail: { eventId: id } })
              window.dispatchEvent(ev)
            }, 500)
          }}
          className="w-full py-[14px] rounded-full font-bold text-[15px] text-white bg-action-primary active:bg-action-primary-hover active:scale-95 transition-transform shadow-md shadow-orange-500/20"
        >
          Accéder au chat
        </button>
      </div>
    </div>
  )
}
