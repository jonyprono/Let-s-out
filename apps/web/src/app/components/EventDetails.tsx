import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Loader2,
  Lock,
  Copy,
  Check,
  BadgeCheck,
  X,
  Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SaveEventButton } from '@/components/ui/save-event-button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
import { Share08Icon } from 'hugeicons-react'
import { chatApi } from '@/features/chat/api'
import { useAuthStore } from '@/stores/auth.store'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { usersApi } from '@/features/users/api'

import { QRCodeSVG } from 'qrcode.react'
import { SafeImage } from '@/components/shared/SafeImage'
import { ContributeModal } from '@/components/shared/ContributeModal'
import { PoolManagementModal } from '@/components/shared/PoolManagementModal'
import { ShareModal } from '@/components/shared/ShareModal'
import { getEventParticipationMode } from '@/lib/utils'
import {
  computePoolStats,
  hasPaidParticipation,
  hasActivePool,
  resolveContributionAmount,
} from '@/lib/pool-contribution'
import { ManageEventView } from '@/app/components/ManageEventView'
import { hapticFeedback } from '@/lib/haptics'
import { useFavoritesStore } from '@/stores/favorites.store'

import { JoinEventBottomSheet } from '@/app/components/JoinEventBottomSheet'

const CustomShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.8333 7.0835H11.25V3.91379C11.25 3.5933 11.5098 3.3335 11.8302 3.3335C11.9917 3.3335 12.1457 3.40068 12.2555 3.51893L17.2165 8.8615C17.3987 9.05775 17.5 9.31566 17.5 9.5835C17.5 9.85133 17.3987 10.1092 17.2165 10.3055L12.2555 15.6481C12.1457 15.7663 11.9917 15.8335 11.8302 15.8335C11.5098 15.8335 11.25 15.5737 11.25 15.2532V12.0835C6.62129 12.0835 4.1224 15.4303 3.49332 16.4041C3.38948 16.5648 3.21428 16.6668 3.02292 16.6668C2.73412 16.6668 2.5 16.4327 2.5 16.1439V15.4168C2.5 10.8145 6.23096 7.0835 10.8333 7.0835Z" stroke="#56514F" strokeWidth="1.25" strokeLinejoin="round"/>
  </svg>
)

const CustomChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0">
    <path d="M5.20833 5.625H12.7083M5.20833 8.95833H9.79167M0.625 7.29167C0.625 6.64934 0.636217 6.02233 0.657575 5.41692C0.72735 3.43903 0.762242 2.45007 1.56672 1.63954C2.37121 0.829008 3.38808 0.7855 5.42183 0.698492C6.53764 0.65075 7.72575 0.625 8.95833 0.625C10.1909 0.625 11.379 0.65075 12.4948 0.698492C14.5286 0.7855 15.5455 0.829008 16.3499 1.63954C17.1544 2.45007 17.1893 3.43903 17.2591 5.41692C17.2804 6.02233 17.2917 6.64934 17.2917 7.29167C17.2917 7.934 17.2804 8.561 17.2591 9.16642C17.1893 11.1443 17.1544 12.1333 16.3499 12.9438C15.5455 13.7543 14.5286 13.7978 12.4948 13.8848C11.8832 13.911 11.2498 13.9306 10.5994 13.9429C9.98183 13.9546 9.673 13.9605 9.40167 14.0638C9.13033 14.1672 8.90208 14.3629 8.44542 14.7544L6.62919 16.3118C6.51894 16.4063 6.37849 16.4583 6.23326 16.4583C5.89732 16.4583 5.625 16.186 5.625 15.8501V13.8932C5.55702 13.8905 5.48929 13.8878 5.42182 13.8848C3.38807 13.7978 2.37121 13.7543 1.56672 12.9437C0.762242 12.1332 0.72735 11.1443 0.657575 9.16642C0.636217 8.561 0.625 7.934 0.625 7.29167Z" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

interface EventDetailsProps {
  onBack: () => void
}

export function EventDetails({ onBack }: EventDetailsProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const { openUserProfile } = useUserProfile()
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showContributeModal, setShowContributeModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [showContributionsModal, setShowContributionsModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [showPoolManagementModal, setShowPoolManagementModal] = useState(false)

  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore()
  const favorite = isFavorite(id || '')

  // Query events
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  })



  // Fetch the current user's booking to know if they already joined
  const { data: myBookingData, isLoading: bookingLoading } = useQuery({
    queryKey: ['events', id, 'my-booking'],
    queryFn: async () => {
      try {
        const res = await eventsApi.getMyBooking(id!)
        return res.data
      } catch {
        return null
      }
    },
    enabled: !!id && !!user,
    retry: false,
  })

  // Fetch attendees when modal is open
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ['events', id, 'attendees'],
    queryFn: () => eventsApi.getAttendees(id!).then(r => r.data),
    enabled: !!id,
  })



  // Fetch pending bookings for organizer
  const isCreator = user?.id === event?.creatorId
  const isCoHost = user?.id ? event?.coHostIds?.includes(user.id) : false
  const isOrganizer = isCreator || isCoHost
  const { data: pendingBookingsData, refetch: refetchPending } = useQuery({
    queryKey: ['events', id, 'pending-bookings'],
    queryFn: () => eventsApi.getPendingBookings(id!).then(r => r.data),
    enabled: !!id && isOrganizer && showPendingModal,
  })

  const hasJoined = (!!myBookingData && myBookingData.status !== 'CANCELLED') || isCreator

  const joinMutation = useMutation({
    mutationFn: () => eventsApi.join(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] })
      qc.invalidateQueries({ queryKey: ['events', id, 'my-booking'] })
      navigate(`/events/${id}/success`)
    },
    onError: (err: any) => {
      const errCode = err?.response?.data?.error
      if (errCode === 'Already joined') {
        qc.invalidateQueries({ queryKey: ['events', id, 'my-booking'] })
        toast.info('Vous participez déjà à cet événement.')
      } else if (errCode === 'PAYMENT_REQUIRED') {
        navigate(`/events/${id}/pay`)
      } else {
        toast.error(err?.response?.data?.message || "Impossible de rejoindre l'événement.")
      }
    },
  })

  const releasePoolMutation = useMutation({
    mutationFn: () => eventsApi.releasePool(id!),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['events', id] })
      toast.success(res.data?.message || 'Demande de déblocage envoyée !')
      setShowReleaseModal(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Impossible de débloquer les fonds.")
    }
  })

  const approvePayoutMutation = useMutation({
    mutationFn: () => eventsApi.approvePayout(id!),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['events', id] })
      toast.success(res.data?.message || 'Approbation enregistrée !')
      setShowPoolManagementModal(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Impossible d'approuver le déblocage.")
    }
  })

  const handleJoin = async () => {
    hapticFeedback.impact()
    if (!user) {
      toast.error('Connectez-vous pour participer.')
      return
    }
    if (hasJoined) {
      goToChat()
      return
    }
    setShowJoinModal(true)
  }



  const goToChat = async () => {
    if (!event) return
    try {
      const conv = await chatApi.getEventConversation(id!)
      navigate(`/chat/${conv.id}`)
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 403) {
        toast.info("Rejoignez l'événement pour accéder à la discussion.")
      } else if (status === 404) {
        toast.info("Aucune discussion trouvée pour cet événement.")
      } else {
        navigate('/messages')
      }
    }
  }
  const handleConfirmContribute = (amount: number) => {
    if (!event) return
    const resolved = resolveContributionAmount(event, amount)
    if ('error' in resolved) {
      toast.error(resolved.error)
      return
    }
    setShowContributeModal(false)
    navigate(`/events/${id}/pay?amount=${resolved.amount}&type=contribution`)
  }
  const handleShare = async () => {
    if (!event) return;
    hapticFeedback.impact();
    setShowInviteModal(true);
  };

  const handleFavorite = () => {
    if (!event) return;
    hapticFeedback.impact();
    if (favorite) {
      removeFavorite(event.id);
      toast.success('Retiré des favoris');
    } else {
      addFavorite(event);
      toast.success('Ajouté aux favoris');
    }
  };

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (isLoading || bookingLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background-white">
        <Loader2 className="w-8 h-8 animate-spin text-action-primary" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background-white px-8 text-center">
        <p className="text-text-secondary mb-200">Événement introuvable.</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-action-primary active:bg-action-primary-hover text-white rounded-full text-sm font-semibold"
        >
          Retour
        </button>
      </div>
    )
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const parseSafeDate = (dateStr: any): Date => {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    if (typeof dateStr === 'string') {
      const fixedStr = dateStr.replace(' ', 'T');
      const d2 = new Date(fixedStr);
      if (!isNaN(d2.getTime())) return d2;
    }
    return new Date();
  };

  const startDate = parseSafeDate(event.startAt)
  const endDate = parseSafeDate(event.endAt)

  let formattedDate = "Date non précisée"
  let formattedStart = "--:--"
  let formattedEnd = "--:--"

  try {
    if (event.startAt) {
      formattedDate = format(startDate, "EEE, d MMMM yyyy", { locale: fr })
      formattedStart = format(startDate, "HH:mm", { locale: fr })
    }
    if (event.endAt) {
      formattedEnd = format(endDate, "HH:mm", { locale: fr })
    }
  } catch (err) {
    console.error("Error formatting date in EventDetails:", err)
  }

  const attendeeCount = event._count?.bookings ?? event.currentAttendees ?? 0
  const maxAttendees = event.maxAttendees
  const isFull = maxAttendees != null && attendeeCount >= maxAttendees
  const isPastEvent = event?.startAt ? new Date(event.startAt) < new Date() : false

  const organizerName = event.creator?.profile?.displayName || 'Organisateur'
  const organizerAvatar = event.creator?.profile?.avatarUrl

  const coverUrl = event.coverUrl || null

  const amountToPay = event.price || 0
  const hasPool = hasActivePool(event)
  const { budget: cagnoteBudget, collected: cagnoteCollected, remaining: cagnoteRemaining, progress: cagnoteProgress } = computePoolStats(event)
  const participationPaid = hasPaidParticipation(event, myBookingData ?? null)
  const minPoolAmount = event.poolMinAmount || event.poolTarget

  if (isCreator && event.status === 'DRAFT') {
    return (
      <ManageEventView
        event={event}
        organizerName={organizerName}
        organizerAvatar={organizerAvatar}
        formattedDate={formattedDate}
        formattedStart={formattedStart}
        formattedEnd={formattedEnd}
        onBack={onBack}
      />
    )
  }

  const displayedAttendees = attendeesData?.data?.slice(0, 4) || []
  const extraCount = Math.max(0, attendeeCount - 4)

  return (
    <>
      <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins">

        {/* Header */}
        <div className="flex-shrink-0 bg-[var(--color-background-primary)] z-10 px-4 pt-safe-4 pt-4 pb-3 flex items-center justify-between min-h-[56px] h-[60px] shadow-sm">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center active:scale-95 transition-transform -ml-2"
          >
            <ChevronLeft className="w-6 h-6 text-[var(--color-text-primary)]" strokeWidth={2.5} />
          </button>

          <span className="text-[16px] font-semibold text-[var(--color-text-primary)] font-poppins">Détails événement</span>

          <div className="flex items-center gap-2 -mr-2">
            <button onClick={handleShare} className="w-9 h-9 flex items-center justify-center active:scale-95 transition-transform text-[var(--color-icon-secondary)]">
              <Share08Icon className="w-5 h-5" strokeWidth={1.8} />
            </button>
            <SaveEventButton saved={favorite} onClick={handleFavorite} className="w-9 h-9" />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>

          {/* Cover Image & Title block wrapper to align them properly */}
          <div className="flex flex-col gap-3">
            {/* Cover Image */}
            <div className="min-h-[200px] w-full bg-[var(--color-background-secondary)] relative mb-4 flex items-center justify-center">
              {coverUrl ? (
                <SafeImage src={coverUrl} alt={event.title} className="w-full h-full object-cover absolute inset-0" />
              ) : (
                <div className="flex flex-col items-center justify-center text-[var(--color-icon-muted)]">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
              )}
              {/* Badge superposé en bas à gauche */}
              {event.category && (
                <div className="absolute -bottom-3 left-4">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white bg-[var(--brand-orange-500)] shadow-sm"
                  >
                    <span className="text-[12px]">
                      {event.category.toLowerCase().includes('concert') || event.category.toLowerCase().includes('musique') ? '🎵' :
                       event.category.toLowerCase().includes('sport') ? '⚽' :
                       event.category.toLowerCase().includes('art') ? '🎨' :
                       event.category.toLowerCase().includes('soirée') || event.category.toLowerCase().includes('fête') || event.category.toLowerCase().includes('fete') || event.category.toLowerCase().includes('nightlife') ? '🥳' :
                       event.category.toLowerCase().includes('gastro') || event.category.toLowerCase().includes('food') ? '🍽️' :
                       '✨'}
                    </span>
                    {event.category === 'NIGHTLIFE' ? 'Fêtes' : event.category === 'FOOD' ? 'Cuisine et gastronomie' : event.category}
                  </span>
                </div>
              )}
            </div>
            
            <div className="px-4">

            {/* Title */}
            <div>
              <h1 className="text-[20px] font-semibold font-poppins text-[#1B1818] leading-tight mb-4">{event.title}</h1>
            </div>

            {/* Location & Date */}
            <div className="flex flex-col gap-1">
              <div className="flex items-start gap-3">
                <MapPin className="w-[18px] h-[18px] text-[var(--color-text-secondary)] shrink-0 mt-0.5" />
                <p className="text-[14px] font-normal font-inter text-[var(--color-text-secondary)] leading-snug">
                  {event.address ? <>{event.address}<br/>{event.city}</> : (event.city || 'Lieu non précisé')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-[18px] h-[18px] text-[var(--color-text-secondary)] shrink-0" />
                <p className="text-[14px] font-normal font-inter text-[var(--color-text-secondary)] capitalize leading-snug">
                  {formattedDate}, {formattedStart} - {formattedEnd}
                </p>
              </div>
            </div>
          </div>

          <div className="px-4 pb-6 space-y-[20px] mt-4">

            {/* À propos */}
            {event.description && (
              <div>
                <h2 className="text-[16px] font-semibold font-poppins text-[var(--color-text-primary)] mb-[8px]">À propos</h2>
                <p className="selectable-text text-[14px] font-normal font-inter text-[var(--color-text-secondary)] leading-relaxed break-words whitespace-pre-wrap">
                  {isDescriptionExpanded
                    ? event.description
                    : event.description.length > 120
                      ? event.description.substring(0, 120)
                      : event.description}
                  {event.description.length > 120 && (
                    <span
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-[var(--color-text-primary)] font-semibold cursor-pointer"
                    >
                      {isDescriptionExpanded ? ' Voir moins' : '... Voir plus'}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Organisateurs */}
            <div>
              <h2 className="text-[16px] font-semibold font-poppins text-[var(--color-text-primary)] mb-[8px]">
                {event.coHosts && event.coHosts.length > 0 ? 'Organisateurs' : 'Organisateur'}
              </h2>
              <div className="flex flex-col gap-[16px]">
                {[event.creator, ...(event.coHosts || [])].filter(Boolean).map((org: any) => (
                  <OrganizerCard key={org.id} org={org} currentUserId={user?.id} onOpenProfile={openUserProfile} />
                ))}
              </div>

            </div>

            {/* Participants */}
            <div>
              <h2 className="text-[16px] font-semibold font-poppins text-[var(--color-text-primary)] mb-[8px]">Participants</h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[8px]">
                  {/* Stacked avatars */}
                  <div className="flex items-center -space-x-[8px]">
                    {displayedAttendees.map((booking: any, index: number) => {
                      const avatar = booking?.user?.profile?.avatarUrl
                      const name = booking?.user?.profile?.displayName || '?'
                      return (
                        <div key={index} className="w-[32px] h-[32px] rounded-full border-2 border-white bg-[var(--color-background-secondary)] overflow-hidden relative" style={{ zIndex: 10 - index }}>
                          <SafeImage src={avatar} alt={name} className="w-full h-full object-cover" />
                        </div>
                      )
                    })}
                  </div>
                  {/* Count text */}
                  <p className="text-[14px] text-[var(--brand-orange-500)] font-semibold font-poppins">
                    {hasJoined ? 'Vous' : ''}
                    {extraCount > 0 ? `${hasJoined ? ' +' : '+'}${extraCount} participants` : attendeeCount > 0 ? ` ${attendeeCount} participants` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setShowParticipantsModal(true)}
                  className="px-[12px] py-[6px] rounded-[8px] border border-[var(--border-default)] bg-[var(--color-background-primary)] text-[12px] font-medium text-[var(--color-text-secondary)] active:scale-95 transition-transform"
                >
                  Voir la liste
                </button>
              </div>
            </div>

            {/* Section Participation */}
            <div>
              <p className="text-[16px] font-semibold font-poppins text-[var(--color-text-primary)] mb-[8px]">Participation</p>

              {hasPool ? (
                /* ── CAGNOTTE BLOCK ── */
                <div className="space-y-[16px] bg-[var(--color-background-alt)] p-[16px] rounded-[12px] border border-[var(--border-default)]">
                  <div className="flex items-center justify-between border-b border-[var(--border-default)] border-dashed pb-[12px]">
                    <span className="text-[18px] font-normal text-[#FF7A00]" style={{ fontFamily: "'Mochiy Pop One', sans-serif" }}>Cagnotte</span>
                    {(hasJoined || isCreator) && (
                      <button
                        onClick={() => setShowContributionsModal(true)}
                        className="px-[12px] py-[6px] rounded-[8px] border border-[var(--border-default)] bg-white dark:bg-[#1A1A1A] text-[12px] font-medium text-[var(--color-text-primary)] active:scale-95 transition-transform"
                      >
                        Voir les contributions
                      </button>
                    )}
                  </div>

                  {/* Grid Stats */}
                  <div className="flex flex-col gap-[12px]">
                    <div className="flex items-center justify-between pb-[12px] border-b border-[#CED1D3] border-dashed">
                      <span className="text-[14px] font-normal font-poppins text-[#404040]">Objectif</span>
                      <span className="text-[14px] font-semibold font-inter text-[#007BFF]">{cagnoteBudget.toLocaleString()} F CFA</span>
                    </div>
                    <div className="flex items-center justify-between pb-[12px]">
                      <span className="text-[14px] font-normal font-poppins text-[#404040]">Collecté</span>
                      <span className="text-[14px] font-bold font-inter text-[#00A35F]">{cagnoteCollected.toLocaleString()} F</span>
                    </div>
                    <div className="flex items-center justify-between pb-[12px]">
                      <span className="text-[14px] font-normal font-poppins text-[#404040]">Restant</span>
                      <span className="text-[14px] font-bold font-inter text-[#FF7A00]">{cagnoteRemaining.toLocaleString()} F</span>
                    </div>
                    <div className="flex items-center justify-between pb-[12px]">
                      <span className="text-[14px] font-normal font-poppins text-[#404040]">Progression</span>
                      <div className="flex items-center justify-center px-[3px] py-[1px] bg-[#FF7A00] rounded-[4px] min-w-[36px] h-[22px]">
                        <span className="text-[14px] font-medium font-inter text-white">{cagnoteProgress}%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-[4px]">
                      <span className="text-[14px] font-normal font-poppins text-[#404040]">Participation</span>
                      <span className="text-[14px] font-normal font-inter text-[#1B1818]">
                        A partir de <span className="text-[#007BFF] font-semibold">{(minPoolAmount || 0).toLocaleString()}F</span>
                      </span>
                    </div>
                  </div>

                  {/* Bouton Gérer la cagnotte pour les organisateurs */}
                  {isOrganizer && new Date() > new Date(event?.registrationDeadline || event?.startAt || new Date()) && (
                    <button
                      onClick={() => setShowPoolManagementModal(true)}
                      className="w-full flex items-center justify-center gap-2 py-[12px] rounded-[8px] border border-[#CED1D3] bg-orange-50 text-[14px] font-medium text-[#FF7A00] active:scale-95 transition-transform"
                    >
                      <Briefcase className="w-4 h-4" />
                      Gérer la cagnotte
                    </button>
                  )}

                  {/* "Contribuer à nouveau" if already joined */}
                  {(hasJoined || participationPaid) && !event.poolReleased && (
                    <button
                      onClick={() => {
                        if (isCreator || participationPaid) {
                          navigate(`/events/${id}/pay?type=contribution`)
                        } else {
                          toast.info("Rejoignez l'événement avant de contribuer.")
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-[12px] rounded-[8px] border border-[#CED1D3] bg-white text-[14px] font-medium text-[#1B1818] active:scale-95 transition-transform mt-[16px]"
                    >
                      <span className="text-[16px]">💵</span>
                      Contribuer à nouveau
                    </button>
                  )}

                  {event.poolReleased && (
                    <div className="mt-[16px] p-3 rounded-[8px] bg-red-50 text-red-600 text-[13px] text-center font-medium border border-red-100">
                      Cette cagnotte est désormais clôturée.
                    </div>
                  )}
                </div>
              ) : (
                /* ── STANDARD PARTICIPATION BLOCK ── */
                <div className="rounded-[14px] bg-gray-50 dark:bg-[#222222] p-4 flex items-center justify-between">
                  <span className="text-[14px] text-gray-900 dark:text-white font-medium">Montant</span>
                  <span className="text-[14px] font-bold text-[#007AFF]">
                    {amountToPay > 0 ? `${amountToPay.toLocaleString()} F CFA` : getEventParticipationMode(event)}
                  </span>
                </div>
              )}
            </div>

            {/* Payout Approval Banner for Validators */}
            {event && !!user && event.validatorIds?.includes(user.id) && event.payoutRequest?.status === 'PENDING' && !event.payoutRequest.approvals.includes(user.id) && (
              <div className="mt-4 p-4 rounded-xl border border-[#10B981] bg-[#F0FDF4] dark:bg-[#10B981]/10 dark:border-[#10B981]/30">
                <h3 className="text-[15px] font-bold text-[#047857] dark:text-[#34D399] mb-1">Approbation requise</h3>
                <p className="text-[13px] text-[#065F46] dark:text-[#A7F3D0] mb-3 leading-tight">
                  L'organisateur a demandé le déblocage des fonds. En tant que validateur, veuillez l'approuver.
                </p>
                <button
                  onClick={() => approvePayoutMutation.mutate()}
                  disabled={approvePayoutMutation.isPending}
                  className="w-full flex items-center justify-center py-[10px] bg-[#10B981] text-white text-[14px] font-bold rounded-[8px] active:scale-95 transition-transform"
                >
                  {approvePayoutMutation.isPending ? "Traitement..." : "Approuver le déblocage"}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

        {/* ── Sticky Footer ── */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-[var(--color-background-primary)] px-4 pt-4 pb-safe-4 border-t border-[var(--border-default)] flex items-center gap-3 z-10"
        >
          {hasJoined ? (
            /* Participant or Creator: two buttons */
            <>
              <Button
                variant="outline"
                onClick={handleShare}
                className="flex-[0.45] flex items-center justify-center gap-2 rounded-full font-semibold border-[var(--border-default)] text-[var(--color-text-primary)]"
              >
                <CustomShareIcon />
                Partager
              </Button>
              {event?.status === 'PUBLISHED' && (
                <Button
                  onClick={goToChat}
                  className="flex-[0.55] flex items-center justify-center gap-2 rounded-full font-semibold bg-[var(--brand-orange-500)] text-white hover:opacity-90"
                >
                  <CustomChatIcon />
                  Accéder au chat
                </Button>
              )}
            </>
          ) : (
            /* Non-participant: one wide button */
            !isPastEvent && (
              <Button
                onClick={() => {
                  if (event.poolReleased) {
                    toast.info("L'événement et la cagnotte sont clôturés.");
                    return;
                  }
                  handleJoin();
                }}
                disabled={joinMutation.isPending || isFull || event.poolReleased}
                className="flex-1 w-full rounded-full font-medium text-[14px] h-[40px] border-none transition-opacity active:scale-95 font-poppins"
                style={{
                  background: (joinMutation.isPending || isFull || event.poolReleased) ? 'var(--color-background-secondary)' : 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)',
                  color: (joinMutation.isPending || isFull || event.poolReleased) ? 'var(--color-text-secondary)' : 'white'
                }}
              >
                {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : event.poolReleased ? 'Clôturé' : isFull ? 'Complet' : "Rejoindre l'événement"}
              </Button>
            )
          )}
        </div>
      </div>

      {/* ── Join Event Bottom Sheet ── */}
      {event && (
        <JoinEventBottomSheet
          event={event}
          isOpen={showJoinModal}
          onClose={() => setShowJoinModal(false)}
        />
      )}

      {showContributeModal && event && (
        <ContributeModal
          event={event}
          onClose={() => setShowContributeModal(false)}
          onConfirm={handleConfirmContribute}
        />
      )}

      {showPoolManagementModal && event && (
        <PoolManagementModal
          event={event}
          isCreator={isCreator}
          isCoHost={!!user && !!event?.coHostIds?.includes(user.id)}
          currentUserId={user?.id}
          onClose={() => setShowPoolManagementModal(false)}
          onReleaseFunds={isCreator ? () => { setShowPoolManagementModal(false); setShowReleaseModal(true) } : undefined}
          onApproveFunds={() => approvePayoutMutation.mutate()}
          isApproving={approvePayoutMutation.isPending}
        />
      )}

      {/* QR Code Modal */}
      {showQRModal && event && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center px-5 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-[#1A1A1A] rounded-3xl p-6 shadow-2xl relative">
            <button onClick={() => setShowQRModal(false)} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center">
              <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-orange-50 text-action-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Événement privé</h3>
              <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-tight">Scannez ce QR code pour rejoindre ou utilisez le code.</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#222222] p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 dark:border-white/10 mb-6">
              <div className="bg-white dark:bg-[#1A1A1A] p-3 rounded-xl shadow-sm mb-4">
                {event.joinCode ? (
                  <QRCodeSVG value={event.joinCode} size={160} level="M" />
                ) : (
                  <div className="w-[160px] h-[160px] flex items-center justify-center text-gray-400 text-sm">Code indisponible</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[28px] font-mono font-bold text-gray-800 dark:text-gray-200 tracking-widest bg-gray-200/50 px-4 py-2 rounded-xl">
                  {event.joinCode || '—'}
                </span>
                <button
                  onClick={() => {
                    const code = event.joinCode!;
                    navigator.clipboard?.writeText(code).then(() => {
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    });
                  }}
                  className="w-10 h-10 bg-action-primary text-white rounded-xl flex items-center justify-center active:scale-95"
                >
                  {codeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <button onClick={() => setShowQRModal(false)} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-[15px]">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Release Pool Modal */}
      {showReleaseModal && event && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-t-[20px] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[15px] font-semibold text-gray-900 dark:text-white">Débloquer les fonds</span>
              <button onClick={() => setShowReleaseModal(false)} className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="px-5 pb-8">
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                Vous êtes sur le point de débloquer la somme de <strong className="text-gray-900 dark:text-white">{cagnoteCollected.toLocaleString()} F CFA</strong> vers votre portefeuille. Cette action est définitive.
              </p>
              <button
                onClick={() => releasePoolMutation.mutate()}
                disabled={releasePoolMutation.isPending}
                className="w-full bg-[#10B981] text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {releasePoolMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Briefcase className="w-5 h-5" />}
                Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Attendees Modal ── */}
      {showParticipantsModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowParticipantsModal(false)}>
          <div className="w-full h-[80%] bg-white dark:bg-[#1A1A1A] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-2 pb-4 flex-shrink-0 text-center">
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">Participants</h3>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {attendeesLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-action-primary" /></div>
              ) : (Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || [])?.length > 0 ? (
                <div>
                  {(Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []).map((booking: any) => {
                    const avatar = booking?.user?.profile?.avatarUrl
                    const name = booking?.user?.profile?.displayName || '?'
                    const isVerified = booking?.user?.profile?.isVerified
                    return (
                      <button
                        key={booking.id}
                        className="w-full flex items-center gap-3 px-5 py-3 active:bg-gray-50 dark:bg-[#222222] transition-colors text-left"
                        onClick={() => openUserProfile(
                          booking.user.id, 
                          { displayName: name, avatarUrl: avatar },
                          { title: event?.title || 'Événement', coverUrl: event?.coverUrl }
                        )}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
                          <SafeImage
                            src={avatar}
                            alt={name}
                            className="w-full h-full object-cover"
                            fallback={
                              <div className="w-full h-full bg-[#FF7A00] flex items-center justify-center text-white font-bold text-[14px]">
                                {name.charAt(0).toUpperCase()}
                              </div>
                            }
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-1">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{name}</p>
                          {isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 text-[14px]">Aucun participant pour le moment.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Contributions Modal ── */}
      {showContributionsModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowContributionsModal(false)}>
          <div className="w-full h-[80%] bg-white dark:bg-[#1A1A1A] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 pt-2 pb-4 flex-shrink-0 text-center">
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">Contributions</h3>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {attendeesLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-action-primary" /></div>
              ) : (Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || [])?.length > 0 ? (
                <div>
                  {(() => {
                    const groupedContributions = (Array.isArray(attendeesData) ? attendeesData : attendeesData?.data || []).reduce((acc: any, booking: any) => {
                      const userId = booking?.user?.id;
                      if (!userId) return acc;
                      const amt = Number(booking?.totalPaid || booking?.amount || booking?.paidAmount || 0);
                      if (amt <= 0) return acc;
                      if (!acc[userId]) {
                        acc[userId] = { ...booking, totalAmount: 0 };
                      }
                      acc[userId].totalAmount += amt;
                      return acc;
                    }, {});
                    const contributionsList = Object.values(groupedContributions).sort((a: any, b: any) => b.totalAmount - a.totalAmount);

                    return contributionsList.map((booking: any) => {
                      const avatar = booking?.user?.profile?.avatarUrl
                      const name = booking?.user?.profile?.displayName || '?'
                      const isVerified = booking?.user?.profile?.isVerified
                      const amount = booking?.totalAmount
                      return (
                        <button
                          key={booking.id}
                          className="w-full flex items-center gap-3 px-5 py-3 active:bg-gray-50 dark:bg-[#222222] transition-colors text-left"
                          onClick={() => openUserProfile(
                            booking.user.id, 
                            { displayName: name, avatarUrl: avatar },
                            { title: event?.title || 'Événement', coverUrl: event?.coverUrl }
                          )}
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 shrink-0">
                            <SafeImage
                              src={avatar}
                              alt={name}
                              className="w-full h-full object-cover"
                              fallback={
                                <div className="w-full h-full bg-[#FF7A00] flex items-center justify-center text-white font-bold text-[14px]">
                                  {name.charAt(0).toUpperCase()}
                                </div>
                              }
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-1">
                            <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{name}</p>
                            {isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                          </div>
                          {amount > 0 && (
                            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">{Number(amount).toLocaleString()} F</span>
                          )}
                        </button>
                      )
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400 text-[14px]">Aucune contribution pour le moment.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite / Share Modal */}
      {showInviteModal && event && (
        <ShareModal
          eventId={event.id}
          eventTitle={event.title}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* Pending Bookings Modal (Organizer) */}
      {showPendingModal && isOrganizer && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowPendingModal(false)}>
          <div className="w-full h-[70%] bg-white dark:bg-[#1A1A1A] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-white">Demandes en attente</h3>
              <button onClick={() => setShowPendingModal(false)} className="w-8 h-8 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-10" style={{ scrollbarWidth: 'none' }}>
              {!pendingBookingsData?.data || pendingBookingsData.data.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-400 text-[14px]">Aucune demande en attente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBookingsData.data.map((booking: any) => (
                    <div key={booking.id} className="bg-orange-50 rounded-2xl p-4 flex items-center gap-3">
                      <SafeImage
                        src={booking.user.profile?.avatarUrl}
                        alt={booking.user.profile?.displayName}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        fallback={<div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white bg-[#FF7A00]">{(booking.user.profile?.displayName || 'A').charAt(0)}</div>}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white text-[14px]">{booking.user.profile?.displayName}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-[12px]">@{booking.user.profile?.username}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={async () => {
                            try {
                              await eventsApi.approveBooking(id!, booking.id)
                              toast.success('Participation acceptée !')
                              refetchPending()
                              qc.invalidateQueries({ queryKey: ['events', id] })
                            } catch { toast.error('Erreur') }
                          }}
                          className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center font-bold active:scale-95"
                        >✓</button>
                        <button
                          onClick={async () => {
                            try {
                              await eventsApi.rejectBooking(id!, booking.id)
                              toast.success('Demande refusée.')
                              refetchPending()
                              qc.invalidateQueries({ queryKey: ['events', id] })
                            } catch { toast.error('Erreur') }
                          }}
                          className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center font-bold active:scale-95"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  )
}

function OrganizerCard({ org, currentUserId, onOpenProfile }: { org: any, currentUserId: string | undefined, onOpenProfile: any }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: orgProfile, refetch } = useQuery({
    queryKey: ['users', org.id],
    queryFn: () => usersApi.getById(org.id),
    enabled: !!org.id,
  });

  const orgName = org.profile?.displayName || orgProfile?.displayName || 'Organisateur';
  const orgAvatar = org.profile?.avatarUrl || orgProfile?.avatarUrl;
  const orgFollowers = orgProfile?.followersCount || org.profile?.followersCount || 0;
  const orgEvents = orgProfile?.detailedStats?.eventsCount || orgProfile?.eventsCount || org.detailedStats?.eventsCount || org.profile?.eventsCount || 0;
  const rawRating = Number(orgProfile?.detailedStats?.rating || orgProfile?.rating || org.detailedStats?.rating || org.profile?.rating || 0);
  const orgRating = rawRating > 0 ? rawRating.toFixed(1) : null;
  const isFollowing = orgProfile?.isFollowing || false;

  return (
    <div className="flex flex-col gap-[12px] bg-[var(--color-background-primary)] rounded-[12px] border border-[var(--border-default)] p-[12px] shadow-sm">
      {/* Row 1: avatar + infos */}
      <div 
        className="flex items-center gap-[12px] cursor-pointer"
        onClick={() => onOpenProfile(org.id, { displayName: orgName, avatarUrl: orgAvatar })}
      >
        <div className="flex-shrink-0">
          <div className="w-[40px] h-[40px] rounded-full overflow-hidden bg-gray-200">
            <SafeImage
              src={orgAvatar}
              alt={orgName}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full bg-[var(--color-background-secondary)] flex items-center justify-center text-[15px] font-bold text-[var(--color-text-secondary)]">
                  {orgName.charAt(0).toUpperCase()}
                </div>
              }
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[4px] mb-[2px]">
            <p className="text-[14px] font-semibold font-poppins text-[var(--color-text-primary)]">{orgName}</p>
            <BadgeCheck className="w-[14px] h-[14px] text-[#007AFF]" />
          </div>
          <p className="text-[12px] font-normal font-inter text-[var(--color-text-secondary)]">
            {orgFollowers} followers • {orgEvents} événements {orgRating && <span>• {orgRating} <span className="text-[#FF2E93]">★</span></span>}
          </p>
        </div>
      </div>

      {/* Row 2: action buttons (only if not the current user) */}
      {currentUserId !== org.id && (
        <div className="flex items-center gap-[8px]">
          <button onClick={async (e) => {
            e.stopPropagation();
            try {
              const conv = await chatApi.createDM(org.id);
              navigate(`/chat/${conv.id}`);
            } catch {
              toast.error("Impossible de démarrer la conversation");
            }
          }} className="flex-1 py-[6px] rounded-[100px] border border-[var(--border-default)] bg-white dark:bg-[#1A1A1A] text-[13px] font-semibold text-[var(--color-text-primary)] active:scale-95 transition-transform">
            Message
          </button>
          <button onClick={async (e) => {
            e.stopPropagation();
            try {
              if (isFollowing) {
                await usersApi.unfollowUser(org.id);
                toast.success("Vous ne suivez plus cet organisateur.");
              } else {
                await usersApi.followUser(org.id);
                toast.success("Vous suivez maintenant cet organisateur !");
              }
              refetch();
              qc.invalidateQueries({ queryKey: ['users', org.id] });
            } catch (err: any) {
              toast.error("Erreur lors de l'action");
            }
          }} className={`flex-1 py-[6px] rounded-[100px] border text-[13px] font-semibold active:scale-95 transition-transform ${isFollowing ? 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-700 dark:text-gray-300' : 'border-[var(--border-default)] bg-white dark:bg-[#1A1A1A] text-[var(--color-text-primary)]'}`}>
            {isFollowing ? 'Abonné(e)' : 'Suivre'}
          </button>
        </div>
      )}
    </div>
  );
}
