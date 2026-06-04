import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Share2,
  Loader2,
  Users,
  Briefcase,
  Lock,
  Copy,
  Check,
  BadgeCheck,
  X,
  Heart,
  Wallet,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
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
import {
  computePoolStats,
  hasPaidParticipation,
  hasActivePool,
  resolveContributionAmount,
} from '@/lib/pool-contribution'
import { ManageEventView } from '@/app/components/ManageEventView'
import { hapticFeedback } from '@/lib/haptics'

import { useFavoritesStore } from '@/stores/favorites.store'


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
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [invitingUsers, setInvitingUsers] = useState<Set<string>>(new Set())
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set())

  const [showProfileVerificationModal, setShowProfileVerificationModal] = useState(false)
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

  // Fetch friends for invite modal
  const { data: friendsData } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
    enabled: showInviteModal,
  })
  const friends = friendsData ?? []

  // Fetch pending bookings for organizer
  const isCreator = user?.id === event?.creatorId
  const isCoHost = user?.id ? event?.coHostIds?.includes(user.id) : false
  const isOrganizer = isCreator || isCoHost
  const { data: pendingBookingsData, refetch: refetchPending } = useQuery({
    queryKey: ['events', id, 'pending-bookings'],
    queryFn: () => eventsApi.getPendingBookings(id!).then(r => r.data),
    enabled: !!id && isOrganizer && showPendingModal,
  })

  const hasJoined = !!myBookingData && myBookingData.status !== 'CANCELLED'

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] })
      toast.success('Fonds débloqués avec succès !')
      setShowReleaseModal(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Impossible de débloquer les fonds.")
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

  const handleConfirmJoin = () => {
    hapticFeedback.success()
    setShowJoinModal(false)
    if (!event) return
    if (event.price > 0) {
      navigate(`/events/${id}/pay`)
    } else {
      joinMutation.mutate()
    }
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
    // Open invite friends modal first; fallback to native share if no friends
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
      formattedDate = format(startDate, "EEEE d MMMM yyyy", { locale: fr })
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
  const isFull = maxAttendees ? attendeeCount >= maxAttendees : false

  const organizerName = event.creator?.profile?.displayName || 'Organisateur'
  const organizerAvatar = event.creator?.profile?.avatarUrl
  const organizerFollowers = event.creator?.profile?.followersCount || 0
  const organizerEvents = event.creator?.profile?.eventsCount || 0

  const coverUrl = event.coverUrl ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop'

  const transactionFee = 50
  const amountToPay = event.price || 0
  const netToPay = amountToPay + transactionFee
  const hasPool = hasActivePool(event)
  const { budget: cagnoteBudget, collected: cagnoteCollected, remaining: cagnoteRemaining, progress: cagnoteProgress } = computePoolStats(event)
  const participationPaid = hasPaidParticipation(event, myBookingData ?? null)

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

  return (
    <>
      <div className="w-full h-full bg-white flex flex-col font-sans">

        {/* Clean Static Header */}
        <div className="flex-shrink-0 bg-white z-10 px-6 pt-4 pt-safe-4 pb-2 flex items-center justify-between border-b border-gray-50">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-start active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" strokeWidth={2.5} />
          </button>
          
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[16px] font-bold text-gray-900">Détails événement</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="w-8 h-8 flex items-center justify-center active:scale-95 transition-transform bg-gray-50 rounded-full">
              <Share2 className="w-4 h-4 text-gray-900" />
            </button>
            <button onClick={handleFavorite} className="w-8 h-8 flex items-center justify-center active:scale-95 transition-transform bg-gray-50 rounded-full">
              <Heart className={`w-4 h-4 ${favorite ? 'text-action-primary fill-[var(--action-primary)]' : 'text-gray-900'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-28" style={{ scrollbarWidth: 'none' }}>

          {/* Banner with transparent matrix pattern overlay */}
          <div className="px-6 pt-4">
            <div className="h-[200px] bg-slate-100 rounded-3xl overflow-hidden relative shadow-sm">
              <div 
                className="absolute inset-0 z-10 opacity-[0.05]" 
                style={{
                  backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
                  backgroundSize: '16px 16px'
                }}
              />
              <SafeImage src={coverUrl} alt={event.title} className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="px-6 py-6">
            {/* Title and Badge */}
            <h1 className="text-[24px] font-bold text-gray-900 leading-tight tracking-tight">{event.title}</h1>
            <div className="mt-2 flex items-center">
              <span className="px-3 py-1 bg-[#EFF6FF] text-[#3B82F6] rounded-full text-[12px] font-bold">{event.category || 'Conférence'}</span>
            </div>

            {/* Date and Location - soft gray icons */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-[14px]">{formattedDate}</p>
                  <p className="text-[13px] text-gray-500">{formattedStart} – {formattedEnd} GMT</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-[14px]">{event.city || event.address || 'Lieu non précisé'}</p>
                  {event.address && event.city && (
                    <p className="text-[13px] text-gray-500">{event.address}</p>
                  )}
                </div>
              </div>
            </div>

            {/* À propos */}
            {event.description && (
              <div className="mt-8">
                <p className="text-[16px] font-bold text-gray-900 mb-2">À propos</p>
                <p className="text-[14px] text-gray-500 leading-relaxed">
                  {isDescriptionExpanded ? event.description : `${event.description.substring(0, 120)}${event.description.length > 120 ? '...' : ''}`}
                  {event.description.length > 120 && (
                    <span 
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-gray-900 underline text-[13px] font-medium cursor-pointer ml-1"
                    >
                      {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Organisateur */}
            <div className="mt-8">
              <p className="text-[16px] font-bold text-gray-900 mb-3">Organisateur</p>
              <div className="flex flex-col p-4 rounded-[20px] bg-white border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
                <div className="flex items-start gap-3">
                  <div 
                    className="cursor-pointer flex-shrink-0"
                    onClick={() => event.creator && openUserProfile(event.creator.id, { displayName: organizerName, avatarUrl: organizerAvatar })}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <SafeImage 
                        src={organizerAvatar} 
                        alt={organizerName} 
                        className="w-full h-full object-cover bg-gray-100"
                        fallback={
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-[16px] font-bold text-gray-500">
                            {organizerName.charAt(0).toUpperCase()}
                          </div>
                        }
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => event.creator && openUserProfile(event.creator.id, { displayName: organizerName, avatarUrl: organizerAvatar })}>
                      <p className="text-[15px] font-bold text-gray-900">{organizerName}</p>
                      <BadgeCheck className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5 mb-3">
                      {organizerFollowers} followers • {organizerEvents} événement{organizerEvents > 1 ? 's' : ''}
                    </p>
                    
                    {user?.id === event.creator?.id ? (
                      <span className="text-[12px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Vous</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!event.creator?.id) return;
                          try {
                            const conv = await chatApi.createDM(event.creator.id);
                            navigate(`/chat/${conv.id}`);
                          } catch (err) {
                            toast.error("Impossible de démarrer la conversation");
                          }
                        }} className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-700 active:scale-95 transition-transform">
                          Contacter
                        </button>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!event.creator?.id) return;
                          try {
                            await apiClient.post(`/users/${event.creator.id}/friend-request`, {});
                            toast.success("Demande envoyée !");
                          } catch (err: any) {
                            if (err?.response?.status === 400 || err?.response?.data?.message?.includes('already')) {
                              toast.error("Demande déjà envoyée ou déjà amis.");
                            } else {
                              toast.error("Erreur lors de l'envoi");
                            }
                          }
                        }} className="px-4 py-1.5 rounded-full border text-[12px] font-bold active:scale-95 transition-all bg-white border-gray-200 text-gray-700">
                          Suivre
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="mt-8">
              <p className="text-[16px] font-bold text-gray-900 mb-3">Participants</p>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-2">
                    {[...Array(Math.min(attendeeCount, 3)).keys()].map((index) => {
                      const attendee = attendeesData?.data?.[index]
                      const avatar = attendee?.user?.profile?.avatarUrl
                      const name = attendee?.user?.profile?.displayName || '?'
                      
                      return (
                        <div key={index} className="w-[32px] h-[32px] rounded-full border-[2px] border-white bg-gray-200 flex items-center justify-center overflow-hidden">
                          <SafeImage src={avatar} alt={name} className="w-full h-full object-cover" />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[13px] font-bold text-gray-900">
                    {attendeeCount}/{maxAttendees ?? attendeeCount}
                    {maxAttendees ? <span className="text-[#3B82F6] font-semibold ml-1">| {Math.max(maxAttendees - attendeeCount, 0)} restants</span> : ''}
                  </p>
                </div>

                {hasJoined ? (
                  <div className="px-3 py-1 bg-[#10B981] text-white text-[11px] font-bold rounded-full">Vous participez !</div>
                ) : (
                  <button onClick={() => setShowParticipantsModal(true)} className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 active:scale-95 transition-transform">Voir tous</button>
                )}
              </div>

              {hasJoined && (
                <div className="flex gap-2">
                  <button onClick={() => setShowParticipantsModal(true)} className="flex-1 py-2.5 bg-white border border-gray-200 rounded-[12px] text-[12px] font-bold text-gray-700 flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-sm">
                    <Users className="w-4 h-4" />
                    Voir les participants
                  </button>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex-1 py-2.5 bg-white border border-gray-200 rounded-[12px] text-[12px] font-bold text-gray-700 flex justify-center items-center gap-2 active:scale-95 transition-transform shadow-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Inviter des amis
                  </button>
                </div>
              )}
            </div>

            {/* Participation */}
            <div className="mt-8">
              <p className="text-[16px] font-bold text-gray-900 mb-3">Participation</p>
              <div className="rounded-[16px] bg-gray-50 p-4 flex items-center justify-between border border-transparent">
                <span className="text-[14px] text-gray-900 font-medium">Montant</span>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#3B82F6]">{amountToPay > 0 ? `${amountToPay.toLocaleString()} F CFA` : 'Gratuit'}</span>
                  {hasJoined && amountToPay > 0 && <span className="px-2 py-0.5 bg-[#10B981] text-white text-[10px] font-bold rounded-[6px]">Payé</span>}
                </div>
              </div>
            </div>

            {/* Cagnotte */}
            {hasPool && (
              <div className="mt-8">
                <p className="text-[16px] font-bold text-gray-900 mb-3">Cagnotte</p>

                <div className="rounded-[20px] border border-gray-100 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[14px] text-gray-900 font-medium">Budget</span>
                    <span className="text-[14px] font-bold text-[#3B82F6]">{cagnoteBudget.toLocaleString()} F CFA</span>
                  </div>
                  
                  <div className="border-t border-dashed border-gray-200 mb-3" />

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-gray-500 font-medium">Progression</span>
                    <span className="px-2 py-0.5 bg-action-primary text-white text-[11px] font-bold rounded-md">{cagnoteProgress}%</span>
                  </div>
                  
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
                    <div className="h-full rounded-full bg-action-primary" style={{ width: `${cagnoteProgress}%` }} />
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-gray-500 font-medium">Collecté</span>
                    <span className="text-[13px] font-bold text-[#10B981]">{cagnoteCollected.toLocaleString()} F</span>
                  </div>

                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[13px] text-gray-500 font-medium">Restant</span>
                    <span className="text-[13px] font-bold text-[#EF4444]">{cagnoteRemaining.toLocaleString()} F</span>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (isCreator || participationPaid) {
                        setShowPoolManagementModal(true)
                      } else {
                        toast.info("Rejoignez l'événement et payez votre participation avant de contribuer à la cagnotte.")
                        if (!hasJoined) setShowJoinModal(true)
                        else if (event.price > 0) navigate(`/events/${id}/pay`)
                      }
                    }}
                    className="w-full py-3 bg-white border border-gray-200 rounded-[12px] text-[13px] font-bold text-gray-700 flex justify-center items-center gap-2 active:scale-95 transition-transform"
                  >
                    <Wallet className="w-4 h-4 text-gray-500" />
                    {isCreator ? 'Voir la gestion' : 'Contribuer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white px-6 pt-4 flex items-center justify-between border-none" style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}>
          {!hasJoined ? (
            <>
              <div className="flex-shrink-0">
                <p className="text-[14px] font-bold text-gray-700">
                  {maxAttendees ? `${Math.max(maxAttendees - attendeeCount, 0)} places restantes` : 'Places illimitées'}
                </p>
              </div>
              <button
                onClick={handleJoin}
                disabled={joinMutation.isPending || isFull}
                className="px-6 py-[14px] rounded-full font-bold text-[14px] text-white transition-all active:scale-95 disabled:opacity-60 bg-action-primary active:bg-action-primary-hover"
              >
                {joinMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isFull ? 'Complet' : 'Rejoindre l\'événement'}
              </button>
            </>
          ) : (
            <button
              onClick={goToChat}
              className="w-full flex items-center justify-center gap-2 py-[14px] rounded-full font-bold text-[15px] text-white transition-all active:scale-95 bg-action-primary active:bg-action-primary-hover"
            >
              Accéder au chat
            </button>
          )}
        </div>
      </div>

      {/* Join confirmation modal */}
      {showJoinModal && event && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full bg-white rounded-t-[32px] shadow-2xl animate-in slide-in-from-bottom duration-300">
            
            <div className="px-6 pt-6 pb-safe-4" style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.5rem))' }}>
              
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-[20px] font-bold text-gray-900 tracking-tight">Rejoindre cet événement ?</span>
                <button
                  onClick={() => setShowJoinModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Event info */}
              <div className="mb-4">
                <h2 className="text-[18px] font-bold text-gray-900 leading-tight mb-2">{event.title}</h2>
                <p className="text-[14px] text-gray-500 font-medium capitalize">
                  {formattedDate} • {formattedStart} GMT
                </p>
                {(event.address || event.city) && (
                  <p className="text-[14px] text-gray-500 font-medium mt-1">
                    {event.city || event.address}
                  </p>
                )}
              </div>

              <div className="border-t border-dashed border-gray-200 my-5" />

              <p className="text-[14px] text-gray-500 leading-relaxed mb-6">
                {event.price > 0
                  ? hasPool
                    ? "Confirmez votre participation à cet événement en contribuant à la cagnotte ouverte."
                    : `Confirmez votre participation. Un paiement de ${amountToPay.toLocaleString()} F CFA est requis.`
                  : "Confirmez votre participation à cet événement. C'est gratuit !"}
              </p>

              {/* Invoice table */}
              <div className="space-y-4 mb-8 text-[14px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Participation</span>
                  <span className="font-bold text-gray-900">{amountToPay > 0 ? `${amountToPay.toLocaleString()} F CFA` : 'Gratuit'}</span>
                </div>
                {amountToPay > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Type</span>
                      <span className="font-bold text-gray-900">{hasPool ? 'Cagnotte' : 'Standard'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 font-medium">Frais de transaction</span>
                      <span className="font-bold text-gray-900">{transactionFee.toLocaleString()} F CFA</span>
                    </div>
                  </>
                )}
                
                <div className="border-t border-dashed border-gray-200 pt-4" />
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-900 font-bold">Net à payer</span>
                  <span className="font-black text-gray-900 text-[18px]">{amountToPay > 0 ? `${netToPay.toLocaleString()} F CFA` : '0 F CFA'}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleConfirmJoin}
                className="w-full bg-action-primary active:bg-action-primary-hover text-white py-[14px] rounded-full font-bold text-[15px] active:scale-95 transition-transform shadow-md shadow-orange-500/20"
              >
                {amountToPay > 0 ? 'Procéder au paiement' : 'Confirmer la participation'}
              </button>

            </div>
          </div>
        </div>
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
          onClose={() => setShowPoolManagementModal(false)}
          onReleaseFunds={isCreator ? () => { setShowPoolManagementModal(false); setShowReleaseModal(true) } : undefined}
        />
      )}
      {/* QR Code Modal for Private Events */}
      {showQRModal && event && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center px-5 pt-safe-4 pb-safe-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-background-white rounded-3xl p-6 shadow-2xl relative mt-safe-2">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
            >
              <span className="text-text-secondary font-bold leading-none">✕</span>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-brand-orange-50 text-action-primary rounded-full flex items-center justify-center mx-auto mb-150">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-1">Événement privé</h3>
              <p className="text-[14px] text-text-secondary leading-tight">
                Scannez ce QR code pour rejoindre l'événement ou utilisez le code.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 mb-6">
              <div className="bg-background-white p-150 rounded-xl shadow-sm mb-200">
                {event.joinCode ? (
                  <QRCodeSVG value={event.joinCode} size={160} level="M" />
                ) : (
                  <div className="w-[160px] h-[160px] flex items-center justify-center text-gray-400 text-sm">Code indisponible</div>
                )}
              </div>
              
              <div className="flex items-center gap-150">
                <span className="text-[28px] font-mono font-bold text-gray-800 tracking-widest bg-gray-200/50 px-200 py-2 rounded-xl">
                  {event.joinCode || '—'}
                </span>
                <button 
                  onClick={() => {
                    const code = event.joinCode!;
                    const copy = async () => {
                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(code);
                        } else {
                          // Fallback for non-HTTPS mobile (HTTP local)
                          const textarea = document.createElement('textarea');
                          textarea.value = code;
                          textarea.style.position = 'fixed';
                          textarea.style.opacity = '0';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                        }
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      } catch {
                        toast.error('Impossible de copier le code.');
                      }
                    };
                    copy();
                  }}
                  className="w-10 h-10 bg-action-primary active:bg-action-primary-hover text-white rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                >
                  {codeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-150.5 bg-gray-900 text-white rounded-xl font-bold text-[15px]"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Release Pool Modal */}
      {showReleaseModal && event && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full bg-background-white rounded-t-[20px] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-150">
              <span className="text-[15px] font-semibold text-gray-900">Débloquer les fonds</span>
              <button
                onClick={() => setShowReleaseModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <span className="text-text-secondary text-[14px] font-bold leading-none">✕</span>
              </button>
            </div>
            <div className="px-5 pb-8">
              <p className="text-[13px] text-text-secondary mb-5 leading-relaxed">
                Vous êtes sur le point de débloquer la somme de <strong className="text-gray-900">{cagnoteCollected.toLocaleString()} F CFA</strong> vers votre portefeuille.
                Cette action est définitive.
              </p>
              
              <button
                onClick={() => releasePoolMutation.mutate()}
                disabled={releasePoolMutation.isPending}
                className="w-full bg-[#10B981] text-white py-200 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {releasePoolMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Briefcase className="w-5 h-5" />}
                Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Participants Modal */}
      {showParticipantsModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full h-[75%] bg-background-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-150 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-[18px] font-bold text-gray-900">Participants ({attendeeCount})</h3>
              <button onClick={() => setShowParticipantsModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-text-secondary font-bold leading-none">✕</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 py-200 pb-24">
              {attendeesLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-action-primary" /></div>
              ) : attendeesData?.data?.length > 0 ? (
                <div className="space-y-200">
                  {attendeesData.data.map((booking: any) => (
                    <button 
                      key={booking.id} 
                      className="w-full flex items-center gap-150 active:bg-gray-50 p-2 rounded-xl transition-colors text-left"
                      onClick={() => openUserProfile(booking.user.id, { displayName: booking.user.profile.displayName, avatarUrl: booking.user.profile.avatarUrl })}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                        <SafeImage 
                          src={booking.user.profile.avatarUrl} 
                          alt={booking.user.profile.displayName} 
                          className="w-full h-full object-cover bg-gray-100" 
                          fallback={
                            <div className="w-full h-full bg-gradient-to-br from-[var(--action-primary)] to-[var(--action-primary)] flex items-center justify-center text-xl font-bold text-white">
                              {booking.user.profile.displayName.charAt(0).toUpperCase()}
                            </div>
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-[15px] truncate">{booking.user.profile.displayName}</p>
                        <p className="text-[13px] text-text-secondary truncate">@{booking.user.profile.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-text-secondary text-[14px]">
                  Aucun participant pour le moment. Soyez le premier !
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full h-[75%] bg-background-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-150 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-[18px] font-bold text-gray-900">Partager l'événement</h3>
                <p className="text-[12px] text-gray-400 mt-0.5">Invitez vos amis ou partagez le lien</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-200" style={{ scrollbarWidth: 'none' }}>
              {friends.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-brand-orange-50 rounded-full flex items-center justify-center mx-auto mb-150">
                    <span className="text-2xl">👥</span>
                  </div>
                  <p className="text-gray-700 font-bold text-[15px]">Aucun ami à inviter</p>
                  <p className="text-gray-400 text-[13px] mt-1">Ajoutez des amis depuis votre profil.</p>
                </div>
              ) : (
                <div className="space-y-150">
                  <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-2">Vos amis</p>
                  {friends.map((friend: any) => (
                    <div key={friend.userId} className="flex items-center gap-150 py-1">
                      <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                        <SafeImage
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--action-primary), var(--color-brand-orange-400))' }}>{(friend.displayName || 'A').charAt(0)}</div>}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-[14px] truncate">{friend.displayName}</p>
                        <p className="text-gray-400 text-[12px]">@{friend.username}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (invitedUsers.has(friend.userId)) return
                          setInvitingUsers(s => new Set([...s, friend.userId]))
                          try {
                            await eventsApi.inviteFriends(id!, [friend.userId])
                            setInvitedUsers(s => new Set([...s, friend.userId]))
                            toast.success(`${friend.displayName} invité !`)
                          } catch {
                            toast.error('Erreur lors de l\'invitation')
                          } finally {
                            setInvitingUsers(s => { const n = new Set(s); n.delete(friend.userId); return n })
                          }
                        }}
                        disabled={invitingUsers.has(friend.userId) || invitedUsers.has(friend.userId)}
                        className={`px-200 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 ${
                          invitedUsers.has(friend.userId)
                            ? 'bg-green-100 text-green-600 border border-green-200'
                            : 'bg-action-primary active:bg-action-primary-hover text-white shadow-sm'
                        } disabled:opacity-60`}
                      >
                        {invitingUsers.has(friend.userId) ? <Loader2 className="w-4 h-4 animate-spin" /> : invitedUsers.has(friend.userId) ? '✓ Invité' : 'Inviter'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Footer: native share link */}
            <div className="px-5 py-200 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={async () => {
                  if (!event) return
                  const url = `${window.location.origin}/events/${event.id}`
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: event.title, text: `Découvrez "${event.title}" sur Let's Out !`, url })
                    } catch { /* user dismissed */ }
                  } else {
                    try {
                      await navigator.clipboard.writeText(url)
                      toast.success('Lien copié !')
                    } catch {
                      toast.error('Impossible de copier le lien')
                    }
                  }
                }}
                className="w-full py-150.5 rounded-full border-2 border-action-primary text-action-primary font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Share2 className="w-4 h-4" />
                Partager le lien
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Bookings Modal (Organizer) */}
      {showPendingModal && isOrganizer && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full h-[70%] bg-background-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-150 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-[18px] font-bold text-gray-900">Demandes en attente</h3>
              <button onClick={() => setShowPendingModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-text-secondary font-bold leading-none">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-200 pb-24">
              {!pendingBookingsData?.data || pendingBookingsData.data.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-text-secondary text-[14px]">Aucune demande en attente.</p>
                </div>
              ) : (
                <div className="space-y-150">
                  {pendingBookingsData.data.map((booking: any) => (
                    <div key={booking.id} className="bg-brand-orange-50 rounded-2xl p-200 flex items-center gap-150">
                      <SafeImage
                        src={booking.user.profile?.avatarUrl}
                        alt={booking.user.profile?.displayName}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        fallback={<div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--action-primary), var(--action-primary))' }}>{(booking.user.profile?.displayName || 'A').charAt(0)}</div>}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-[14px]">{booking.user.profile?.displayName}</p>
                        <p className="text-text-secondary text-[12px]">@{booking.user.profile?.username}</p>
                        {booking.user.profile?.bio && <p className="text-gray-400 text-[11px] mt-0.5 truncate">{booking.user.profile.bio}</p>}
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
                          className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center text-lg font-bold active:scale-95"
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
                          className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center text-lg font-bold active:scale-95"
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

      {/* Profile Verification Modal */}
      {showProfileVerificationModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 transition-opacity" onClick={() => setShowProfileVerificationModal(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-background-white rounded-t-[32px] z-50 p-6 pt-8 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <button 
              onClick={() => setShowProfileVerificationModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-text-secondary" />
            </button>
            
            <p className="text-[14px] font-bold text-text-secondary mb-6 uppercase tracking-wider">Vérification de profil requise</p>
            
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 mb-200">
                <BadgeCheck className="w-full h-full fill-blue-600 text-white" />
              </div>
              <h2 className="text-[20px] font-bold text-gray-900 mb-150">Vérifiez votre profil</h2>
              <p className="text-[14px] text-text-secondary mb-8 max-w-[280px] leading-relaxed">
                Vous devez avoir un profil vérifié pour ajouter une cagnotte à votre événement. Vérifiez votre profil pour continuer.
              </p>
              
              <button 
                onClick={() => {
                  setShowProfileVerificationModal(false)
                  navigate('/verify-profile')
                }}
                className="w-full py-200 bg-action-primary active:bg-action-primary-hover rounded-full text-[15px] font-bold text-white active:scale-95 transition-transform"
              >
                Procéder à la vérification
              </button>
            </div>
          </div>
        </>
      )}

    </>
  )
}
