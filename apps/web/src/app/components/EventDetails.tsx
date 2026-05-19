import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ChevronLeft,
  MapPin,
  Calendar,
  Share2,
  Heart,
  Loader2,
  Users,
  MessageCircle,
  Briefcase,
  HandCoins,
  Lock,
  QrCode,
  Copy,
  Check,
  Megaphone,
  BadgeCheck,
  X,
  Star,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/features/events/api'
import { chatApi } from '@/features/chat/api'
import { useAuthStore } from '@/stores/auth.store'
import { useUserProfile } from '@/features/users/UserProfileContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Browser } from '@capacitor/browser'
import { fr } from 'date-fns/locale'
import { usersApi } from '@/features/users/api'
import { apiClient } from '@/lib/api-client'
import { QRCodeSVG } from 'qrcode.react'
import { SafeImage } from '@/components/shared/SafeImage'
import { ManageEventView } from '@/app/components/ManageEventView'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { Icon } from 'leaflet'
import { searchPlaces } from '@/lib/geo'
import { hapticFeedback } from '@/lib/haptics'
import { shareLink } from '@/lib/utils'
import { useFavoritesStore } from '@/stores/favorites.store'

// Fix Leaflet default icon issues by initializing lazily
let customIcon: Icon | undefined;
const getIcon = () => {
  if (!customIcon) {
    customIcon = new Icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }
  return customIcon;
}

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
  const [isFollowing, setIsFollowing] = useState(false)
  const [showContributeModal, setShowContributeModal] = useState(false)
  const [contributeAmount, setContributeAmount] = useState('')
  const [showQRModal, setShowQRModal] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [showParticipantsModal, setShowParticipantsModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [invitingUsers, setInvitingUsers] = useState<Set<string>>(new Set())
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set())
  const [geocodedLat, setGeocodedLat] = useState<number | null>(null)
  const [geocodedLng, setGeocodedLng] = useState<number | null>(null)
  const [showProfileVerificationModal, setShowProfileVerificationModal] = useState(false)
  const [showReleaseModal, setShowReleaseModal] = useState(false)

  const { isFavorite, addFavorite, removeFavorite } = useFavoritesStore()
  const favorite = isFavorite(id || '')

  // Query events
  const { data: event, isLoading, error } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  })

  useEffect(() => {
    if (event && !event.latitude && (event.city || event.address)) {
      const q = `${event.address ? event.address + ' ' : ''}${event.city || ''}`
      searchPlaces(q)
        .then(results => {
          if (results.length > 0) {
            setGeocodedLat(results[0].lat)
            setGeocodedLng(results[0].lon)
          }
        })
        .catch(err => console.error('[EventDetails] Geocoding error:', err))
    }
  }, [event])

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
      toast.success('🎉 Vous participez à cet événement !')
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

  const handlePublish = async () => {
    if (!event) return;
    try {
      await apiClient.put(`/events/${event.id}/publish`)
      toast.success('Événement publié avec succès !')
      qc.invalidateQueries({ queryKey: ['event', id] })
    } catch {
      toast.error('Erreur lors de la publication')
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

  const handleFollow = async () => {
    hapticFeedback.impact()
    if (!user) { toast.error("Connectez-vous pour suivre l'organisateur."); return }
    if (!event?.creator?.id) return
    setIsFollowing(true)
    try {
      await usersApi.followUser(event.creator.id)
      hapticFeedback.success()
      toast.success(`Vous suivez ${organizerName}`)
    } catch {
      setIsFollowing(false)
      hapticFeedback.error()
      toast.error("Erreur lors de l'abonnement")
    }
  }

  const handleContact = async () => {
    hapticFeedback.impact()
    if (!user) { toast.error("Connectez-vous pour contacter l'organisateur."); return }
    if (!event?.creator?.id) return
    try {
      const conv = await chatApi.createDM(event.creator.id)
      navigate(`/chat/${conv.id}`)
    } catch {
      hapticFeedback.error()
      toast.error("Impossible d'ouvrir la discussion.")
    }
  }

  const handleContribute = () => {
    hapticFeedback.impact()
    if (!user) { toast.error("Connectez-vous pour contribuer."); return }
    if (!hasJoined && event?.price === 0) { toast.info("Rejoignez d'abord l'événement."); return }
    setShowContributeModal(true)
  }

  const handleConfirmContribute = () => {
    const amount = parseInt(contributeAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Veuillez entrer un montant valide")
      return
    }
    setShowContributeModal(false)
    navigate(`/events/${id}/pay?amount=${amount}`)
  }

  const handleShare = async () => {
    if (!event) return;
    hapticFeedback.impact();
    await shareLink(
      event.title,
      `Découvrez "${event.title}" sur Let's Out !`,
      `${window.location.origin}/events/${event.id}`
    );
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
      <div className="w-full h-full flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#9747FF]" />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white px-8 text-center">
        <p className="text-gray-500 mb-4">Événement introuvable.</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#9747FF] text-white rounded-full text-sm font-semibold"
        >
          Retour
        </button>
      </div>
    )
  }

  // ─── Derived data ─────────────────────────────────────────────────────────

  const startDate = new Date(event.startAt)
  const endDate = new Date(event.endAt)
  const formattedDate = format(startDate, "EEEE d MMMM yyyy", { locale: fr })
  const formattedStart = format(startDate, "HH:mm", { locale: fr })
  const formattedEnd = format(endDate, "HH:mm", { locale: fr })

  const attendeeCount = event._count?.bookings ?? event.currentAttendees ?? 0
  const maxAttendees = event.maxAttendees
  const isFull = maxAttendees ? attendeeCount >= maxAttendees : false

  const organizerName = event.creator?.profile?.displayName || 'Organisateur'
  const organizerAvatar = event.creator?.profile?.avatarUrl ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
  const organizerFollowers = event.creator?.profile?.followersCount || 0
  const organizerEvents = event.creator?.profile?.eventsCount || 0

  const coverUrl = event.coverUrl ||
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop'

  const transactionFee = 50
  const amountToPay = event.price || 0
  const netToPay = amountToPay + transactionFee
  const hasPool = !!((event as any).poolTarget && (event as any).poolTarget > 0)
  const cagnoteBudget: number = (event as any).poolTarget || 0
  const cagnoteCollected = event.price > 0 ? event.price * attendeeCount : 0
  const cagnoteRemaining = Math.max(cagnoteBudget - cagnoteCollected, 0)
  const cagnoteProgress = cagnoteBudget > 0 ? Math.min(Math.round((cagnoteCollected / cagnoteBudget) * 100), 100) : 0

  return (
    <>
      <div className="w-full h-full bg-white flex flex-col">

        {/* Floating header */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 pt-4 pb-2 flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md relative z-10"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none mt-2">
            <span className="text-[15px] font-bold text-gray-900 bg-white/80 backdrop-blur-md px-4 py-1.5 rounded-full">Détails événement</span>
          </div>

          <div className="flex items-center gap-2 relative z-10 mt-1">
            {event.isPrivate && event.creatorId === user?.id && (
              <button 
                onClick={() => setShowQRModal(true)}
                className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md"
              >
                <QrCode className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <button onClick={handleShare} className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform">
              <Share2 className="w-5 h-5 text-gray-700" />
            </button>
            <button onClick={handleFavorite} className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform">
              <Star className={`w-5 h-5 ${favorite ? 'text-[#FF9F1C] fill-[#FF9F1C]' : 'text-gray-700'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-28">

          <div className="px-4 pt-4">
            <div className="h-48 bg-slate-100 rounded-2xl overflow-hidden relative shadow-sm">
              <SafeImage src={coverUrl} alt={event.title} className="w-full h-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
            </div>
          </div>

          {isCreator && event.status === 'DRAFT' ? (
            <ManageEventView 
              event={event}
              organizerName={organizerName}
              organizerAvatar={organizerAvatar}
              formattedDate={formattedDate}
              formattedStart={formattedStart}
              formattedEnd={formattedEnd}
            />
          ) : (
          <div className="px-5 py-5">
            {/* Title and Badge */}
            <h1 className="mt-2 text-3xl font-bold text-gray-900 leading-tight">{event.title}</h1>
            <div className="mt-3 flex items-center">
              <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-md text-xs font-semibold">{event.category || 'Conférence'}</span>
            </div>

            <div className="mt-6 space-y-4 text-sm text-gray-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFF8F1] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[#FF9F1C]" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-base">{formattedDate}</p>
                  <p className="text-sm text-gray-500">{formattedStart} – {formattedEnd} GMT</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFF8F1] flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-[#FF9F1C]" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-base">{event.address || event.city || 'Lieu non précisé'}</p>
                  <p className="text-sm text-gray-500 mb-3">Localisation</p>
                  
                  {/* Interactive Leaflet Map */}
                  {(event.address || event.city) && (
                    <div className="mt-2">
                      <div className="w-full h-40 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-100 relative z-0">
                        {event.latitude || geocodedLat ? (
                          <MapContainer 
                            center={[event.latitude || geocodedLat!, event.longitude || geocodedLng!]} 
                            zoom={15} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            attributionControl={false}
                          >
                            <TileLayer
                              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />
                            <Marker position={[event.latitude || geocodedLat!, event.longitude || geocodedLng!]} icon={getIcon()} />
                          </MapContainer>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <MapPin className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-400">{event.address || event.city}</span>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={async () => {
                          const lat: number = (event.latitude || geocodedLat) as number
                          const lng = event.longitude || geocodedLng
                          const url = lat && lng 
                            ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` 
                            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.address || ''} ${event.city || ''}`.trim())}`;
                          await Browser.open({ url });
                        }}
                        className="mt-2 w-full py-2.5 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-gray-700 active:scale-[0.98] transition-transform shadow-sm"
                      >
                        <MapPin className="w-4 h-4 text-gray-500" />
                        Y aller (Navigation)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {event.description && (
              <div className="mt-8">
                <p className="text-[17px] font-bold text-gray-900 mb-2">À propos</p>
                <p className="text-[14px] text-gray-600 leading-relaxed">
                  {isDescriptionExpanded ? event.description : `${event.description.substring(0, 120)}${event.description.length > 120 ? '...' : ''}`}
                  {event.description.length > 120 && (
                    <span 
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-gray-500 underline text-[13px] font-medium cursor-pointer ml-1 block mt-1"
                    >
                      {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                    </span>
                  )}
                </p>
              </div>
            )}

            <div className="mt-8">
              <p className="text-[17px] font-bold text-gray-900 mb-4">Organisateurs</p>
              <div className="space-y-3">
                <div className="flex flex-col p-4 rounded-2xl bg-gray-50 border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div 
                      className="cursor-pointer flex-shrink-0"
                      onClick={() => event.creator && openUserProfile(event.creator.id, { displayName: organizerName, avatarUrl: organizerAvatar })}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm">
                        <SafeImage 
                          src={organizerAvatar} 
                          alt={organizerName} 
                          className="w-full h-full object-cover"
                          fallback={
                            <div className="w-full h-full bg-gradient-to-br from-[#FF9F1C] to-[#9747FF] flex items-center justify-center text-xl font-bold text-white">
                              {organizerName.charAt(0).toUpperCase()}
                            </div>
                          }
                        />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => event.creator && openUserProfile(event.creator.id, { displayName: organizerName, avatarUrl: organizerAvatar })}>
                        <p className="text-[15px] font-bold text-gray-900">{organizerName}</p>
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5 mb-2">
                        {organizerFollowers} followers • {organizerEvents} événement{organizerEvents > 1 ? 's' : ''}
                      </p>
                      
                      {user?.id === event.creator.id ? (
                        <span className="text-[12px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Vous</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={handleContact} className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm active:scale-95 transition-transform">
                            Contacter
                          </button>
                          <button onClick={handleFollow} className={`px-3 py-1 rounded-full border text-[11px] font-bold shadow-sm active:scale-95 transition-all ${isFollowing ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white border-gray-200 text-gray-700'}`}>
                            {isFollowing ? 'Suivi' : 'Suivre'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {event.coHosts?.map((coHost: any) => {
                  const coHostName = coHost.profile?.displayName || 'Co-organisateur'
                  const coHostAvatar = coHost.profile?.avatarUrl
                  const coHostFollowers = coHost.profile?.followersCount || 0
                  const coHostEvents = coHost.profile?.eventsCount || 0
                  const isThisCoHostMe = user?.id === coHost.id
                  
                  return (
                    <div key={coHost.id} className="flex flex-col p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div 
                          className="cursor-pointer flex-shrink-0"
                          onClick={() => openUserProfile(coHost.id, { displayName: coHostName, avatarUrl: coHostAvatar })}
                        >
                          <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm">
                            <SafeImage 
                              src={coHostAvatar} 
                              alt={coHostName} 
                              className="w-full h-full object-cover"
                              fallback={
                                <div className="w-full h-full bg-gradient-to-br from-[#FF9F1C] to-[#9747FF] flex items-center justify-center text-xl font-bold text-white">
                                  {coHostName.charAt(0).toUpperCase()}
                                </div>
                              }
                            />
                          </div>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => openUserProfile(coHost.id, { displayName: coHostName, avatarUrl: coHostAvatar })}>
                            <p className="text-[15px] font-bold text-gray-900">{coHostName}</p>
                            <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">Co-hôte</span>
                          </div>
                          <p className="text-[12px] text-gray-500 mt-0.5 mb-2">
                            {coHostFollowers} followers • {coHostEvents} événement{coHostEvents > 1 ? 's' : ''}
                          </p>
                          
                          {isThisCoHostMe ? (
                            <span className="text-[12px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Vous</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => {}} className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm active:scale-95 transition-transform">
                                Contacter
                              </button>
                              <button onClick={() => {}} className={`px-3 py-1 rounded-full border text-[11px] font-bold shadow-sm active:scale-95 transition-all bg-white border-gray-200 text-gray-700`}>
                                Suivre
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mt-8">
              <p className="text-[17px] font-bold text-gray-900 mb-4">Participants</p>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center -space-x-3">
                    {[...Array(Math.min(attendeeCount, 3)).keys()].map((index) => {
                      const attendee = attendeesData?.data?.[index]
                      const avatar = attendee?.user?.profile?.avatarUrl
                      const name = attendee?.user?.profile?.displayName || '?'
                      
                      return (
                        <div key={index} className="w-[36px] h-[36px] rounded-full border-[2px] border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-white shadow-sm relative z-10 overflow-hidden">
                          <SafeImage 
                            src={avatar} 
                            alt={name} 
                            className="w-full h-full object-cover" 
                            fallback={
                              <div className="w-full h-full bg-gradient-to-br from-[#FF9F1C] to-[#9747FF] flex items-center justify-center text-[16px] font-bold text-white">
                                {name.charAt(0).toUpperCase()}
                              </div>
                            }
                          />
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[14px] font-bold text-gray-900">
                    {attendeeCount}/{maxAttendees ?? attendeeCount} 
                    {maxAttendees ? <span className="text-blue-500 font-medium ml-1">| {Math.max(maxAttendees - attendeeCount, 0)} restants</span> : ''}
                  </p>
                </div>

                {hasJoined ? (
                  <div className="px-3 py-1 bg-green-500 text-white text-[11px] font-bold rounded-full shadow-sm">Vous participez !</div>
                ) : (
                  <button onClick={() => setShowParticipantsModal(true)} className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-700 shadow-sm active:scale-95 transition-transform">Voir tous</button>
                )}
              </div>

              {hasJoined && (
                <div className="flex gap-3">
                  <button onClick={() => setShowParticipantsModal(true)} className="flex-1 py-3 bg-white border border-gray-200 rounded-full text-[13px] font-bold text-gray-800 flex justify-center items-center gap-2 shadow-sm active:scale-[0.98] transition-transform">
                    <Users className="w-4 h-4 text-gray-600" />
                    Voir les participants
                  </button>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex-1 py-3 bg-white border border-gray-200 rounded-full text-[13px] font-bold text-gray-800 flex justify-center items-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <Share2 className="w-4 h-4 text-gray-600" />
                    Inviter des amis
                  </button>
                </div>
              )}
              {isOrganizer && event.requiresApproval && (
                <button
                  onClick={() => setShowPendingModal(true)}
                  className="w-full mt-3 py-3 rounded-full bg-orange-50 border border-orange-200 text-[13px] font-bold text-orange-600 flex justify-center items-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Users className="w-4 h-4" />
                  Gérer les demandes en attente
                </button>
              )}
            </div>

            <div className="mt-8">
              <p className="text-[17px] font-bold text-gray-900 mb-4">Participation</p>
              <div className="rounded-[16px] bg-gray-50 p-4 flex items-center justify-between border border-transparent">
                <span className="text-[15px] text-gray-900 font-medium">Montant</span>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-blue-600">{amountToPay.toLocaleString()} F CFA</span>
                  {hasJoined && <span className="px-2 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded-md">Payé</span>}
                </div>
              </div>
            </div>

            {/* Cagnotte — shown only if the event has a pool target */}
            {hasPool && (
              <div className="mt-8">
                <p className="text-[17px] font-bold text-gray-900 mb-4">Cagnotte</p>

                <div className="rounded-[16px] bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[15px] text-gray-900 font-medium">Objectif</span>
                    <span className="text-[15px] font-bold text-blue-600">{cagnoteBudget.toLocaleString()} F CFA</span>
                  </div>
                  
                  <div className="border-t border-dashed border-gray-200 mb-4" />

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[15px] text-gray-600 font-medium">Progression</span>
                    <span className="px-2 py-0.5 bg-[#FF9F1C] text-white text-[12px] font-bold rounded-md">{cagnoteProgress}%</span>
                  </div>
                  
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden mb-5">
                    <div className="h-full rounded-full bg-[#FF9F1C]" style={{ width: `${cagnoteProgress}%` }} />
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[15px] text-gray-600 font-medium">Collecté</span>
                    <span className="text-[15px] font-bold text-[#10B981]">{cagnoteCollected.toLocaleString()} F</span>
                  </div>

                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[15px] text-gray-600 font-medium">Restant</span>
                    <span className="text-[15px] font-bold text-[#FF9F1C]">{cagnoteRemaining.toLocaleString()} F</span>
                  </div>
                  
                  {hasJoined ? (
                    <div className="flex gap-3">
                      {isCreator ? (
                        <button 
                          onClick={() => setShowReleaseModal(true)}
                          disabled={event.poolReleased}
                          className={`flex-1 py-3.5 border rounded-[12px] text-[14px] font-bold flex justify-center items-center gap-2 shadow-sm transition-transform ${event.poolReleased ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white border-[#FF9F1C] text-[#FF9F1C] active:scale-95'}`}
                        >
                          <Briefcase className="w-4 h-4" />
                          {event.poolReleased ? 'Fonds débloqués' : 'Débloquer fonds'}
                        </button>
                      ) : (
                        <button className="flex-1 py-3.5 bg-white border border-gray-200 rounded-[12px] text-[14px] font-bold text-gray-800 flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-transform">
                          <Briefcase className="w-4 h-4 text-gray-600" />
                          Voir la gestion
                        </button>
                      )}
                      <button onClick={handleContribute} className="flex-1 py-3.5 bg-white border border-gray-200 rounded-[12px] text-[14px] font-bold text-gray-800 flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-transform">
                        <HandCoins className="w-4 h-4 text-gray-600" />
                        Contribuer
                      </button>
                    </div>
                  ) : (
                    <button onClick={handleContribute} className="w-full py-3.5 bg-white border border-gray-200 rounded-[32px] text-[14px] font-bold text-gray-800 flex justify-center items-center gap-2 shadow-sm active:scale-95 transition-transform">
                      <HandCoins className="w-4 h-4 text-gray-600" />
                      Contribuer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-4 pb-8 flex items-center justify-between gap-4 shadow-[0_-8px_20px_rgba(0,0,0,0.04)]">
          {isCreator && event.status === 'DRAFT' ? (
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => {
                  setShowProfileVerificationModal(true);
                }}
                className="w-full py-3.5 bg-white border border-[#FF9F1C] rounded-[16px] text-[15px] font-bold text-[#FF9F1C] flex justify-center items-center gap-2 active:scale-95 transition-transform"
              >
                <HandCoins className="w-5 h-5" /> Ajouter cagnotte
              </button>
              <button onClick={handlePublish} className="w-full py-3.5 bg-[#FF9F1C] rounded-[16px] text-[15px] font-bold text-white flex justify-center items-center gap-2 active:scale-95 transition-transform">
                <Megaphone className="w-5 h-5" /> Publier l'événement
              </button>
            </div>
          ) : !hasJoined ? (
            <>
              <div className="flex-shrink-0">
                <p className="text-[15px] font-bold text-gray-700">
                  {maxAttendees ? `${Math.max(maxAttendees - attendeeCount, 0)} places restantes` : 'Places illimitées'}
                </p>
              </div>
              <button
                onClick={handleJoin}
                disabled={joinMutation.isPending || isFull}
                className="flex-1 py-4 rounded-full font-bold text-[16px] text-white transition-all active:scale-95 disabled:opacity-60 bg-[#FF9F1C] shadow-md shadow-orange-500/20"
              >
                {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : isFull ? 'Complet' : event.requiresApproval ? 'Demander à participer' : 'Rejoindre l’événement'}
              </button>
            </>
          ) : (
            <button
              onClick={goToChat}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-full font-bold text-[16px] text-white transition-all active:scale-95 bg-[#FF9F1C] shadow-md shadow-orange-500/20"
            >
              <MessageCircle className="w-5 h-5" />
              Accéder au chat
            </button>
          )}
        </div>
      </div>

      {/* Join confirmation modal */}
      {showJoinModal && event && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full bg-white rounded-t-[20px] shadow-2xl animate-in slide-in-from-bottom duration-300">

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[15px] font-semibold text-gray-900">Rejoindre cet événement ?</span>
              <button
                onClick={() => setShowJoinModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <span className="text-gray-500 text-[14px] font-bold leading-none">✕</span>
              </button>
            </div>

            <div className="px-5 pb-8">

              {isCreator && event.status === 'DRAFT' && (
                <div className="bg-[#EBF3FA] mt-4 mb-6 p-4 rounded-xl text-gray-500 text-[13px] leading-relaxed">
                  Cet événement n'est pas encore visible sur Let's Out.<br/>
                  Publiez-le pour le rendre accessible publiquement.<br/>
                  Ou ajoutez une cagnotte pour partager les frais.
                </div>
              )}

              {/* Event info */}
              <div className="mb-5">
                <h2 className="text-[22px] font-bold text-gray-900 leading-tight">{event.title}</h2>
                <p className="text-[13px] text-gray-500 mt-1">
                  {formattedDate} • {formattedStart} GMT
                </p>
                {(event.address || event.city) && (
                  <p className="text-[13px] text-gray-500 mt-0.5">
                    {event.address || event.city} • {event.city || ''}
                  </p>
                )}
              </div>

              {/* Thin divider */}
              <div className="border-t border-gray-200 mb-5" />

              {/* Description */}
              <p className="text-[13px] text-gray-500 leading-relaxed mb-5">
                {event.price > 0
                  ? `Confirmez votre participation. Un paiement de ${amountToPay.toLocaleString()} F CFA + ${transactionFee} F de frais est requis.`
                  : 'Confirmez votre participation à cet événement. C\'est gratuit !'
                }
              </p>

              {/* Summary table — no background, clean rows */}
              <div className="space-y-3 mb-8 text-[14px]">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Participation</span>
                  <span className="font-bold text-gray-900">{amountToPay.toLocaleString()} F</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Type</span>
                  <span className="font-bold text-gray-900">Cagnotte</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Frais de transaction</span>
                  <span className="font-bold text-gray-900">{transactionFee.toLocaleString()} F</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Net à payer</span>
                  <span className="font-bold text-gray-900">{netToPay.toLocaleString()} F</span>
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={handleConfirmJoin}
                className="w-full bg-[#FF9F1C] text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform"
              >
                Procéder au paiement
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full bg-white rounded-t-[20px] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[15px] font-semibold text-gray-900">Contribuer à la cagnotte</span>
              <button
                onClick={() => setShowContributeModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <span className="text-gray-500 text-[14px] font-bold leading-none">✕</span>
              </button>
            </div>
            <div className="px-5 pb-8">
              <p className="text-[13px] text-gray-500 mb-5">
                Saisissez le montant de votre choix pour soutenir cet événement.
              </p>
              <div className="flex gap-2 items-center mb-6">
                <input 
                  type="number" 
                  min={1} 
                  autoFocus
                  value={contributeAmount} 
                  onChange={e => setContributeAmount(e.target.value)}
                  placeholder="Ex: 5000"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-[16px] font-semibold focus:outline-none focus:border-[#FF9F1C]"
                />
                <div className="px-3 py-3 border border-gray-200 rounded-xl text-[14px] font-bold text-gray-600 bg-gray-50">
                  F CFA
                </div>
              </div>
              <button
                onClick={handleConfirmContribute}
                className="w-full bg-[#FF9F1C] text-white py-4 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform"
              >
                Procéder au paiement
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QR Code Modal for Private Events */}
      {showQRModal && event?.joinCode && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center px-5 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
            >
              <span className="text-gray-500 font-bold leading-none">✕</span>
            </button>
            
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-100 text-[#9747FF] rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-[18px] font-bold text-gray-900 mb-1">Événement privé</h3>
              <p className="text-[14px] text-gray-500 leading-tight">
                Scannez ce QR code pour rejoindre l'événement ou utilisez le code.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center justify-center border border-gray-100 mb-6">
              <div className="bg-white p-3 rounded-xl shadow-sm mb-4">
                <QRCodeSVG value={event.joinCode} size={160} level="M" />
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[28px] font-mono font-bold text-gray-800 tracking-widest bg-gray-200/50 px-4 py-2 rounded-xl">
                  {event.joinCode}
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
                  className="w-10 h-10 bg-[#9747FF] text-white rounded-xl flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                >
                  {codeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold text-[15px]"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Release Pool Modal */}
      {showReleaseModal && event && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="w-full bg-white rounded-t-[20px] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[15px] font-semibold text-gray-900">Débloquer les fonds</span>
              <button
                onClick={() => setShowReleaseModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <span className="text-gray-500 text-[14px] font-bold leading-none">✕</span>
              </button>
            </div>
            <div className="px-5 pb-8">
              <p className="text-[13px] text-gray-500 mb-5 leading-relaxed">
                Vous êtes sur le point de débloquer la somme de <strong className="text-gray-900">{cagnoteCollected.toLocaleString()} F CFA</strong> vers votre portefeuille.
                Cette action est définitive.
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


      {/* Participants Modal */}
      {showParticipantsModal && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full h-[75%] bg-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-[18px] font-bold text-gray-900">Participants ({attendeeCount})</h3>
              <button onClick={() => setShowParticipantsModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-500 font-bold leading-none">✕</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
              {attendeesLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-[#9747FF]" /></div>
              ) : attendeesData?.data?.length > 0 ? (
                <div className="space-y-4">
                  {attendeesData.data.map((booking: any) => (
                    <button 
                      key={booking.id} 
                      className="w-full flex items-center gap-3 active:bg-gray-50 p-2 rounded-xl transition-colors text-left"
                      onClick={() => openUserProfile(booking.user.id, { displayName: booking.user.profile.displayName, avatarUrl: booking.user.profile.avatarUrl })}
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                        <SafeImage 
                          src={booking.user.profile.avatarUrl} 
                          alt={booking.user.profile.displayName} 
                          className="w-full h-full object-cover bg-gray-100" 
                          fallback={
                            <div className="w-full h-full bg-gradient-to-br from-[#FF9F1C] to-[#9747FF] flex items-center justify-center text-xl font-bold text-white">
                              {booking.user.profile.displayName.charAt(0).toUpperCase()}
                            </div>
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-[15px] truncate">{booking.user.profile.displayName}</p>
                        <p className="text-[13px] text-gray-500 truncate">@{booking.user.profile.username}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500 text-[14px]">
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
          <div className="w-full h-[70%] bg-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-[18px] font-bold text-gray-900">Inviter des amis</h3>
              <button onClick={() => setShowInviteModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-500 font-bold leading-none">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
              {friends.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-[14px]">Aucun ami à inviter.</p>
                  <p className="text-gray-400 text-[13px] mt-1">Ajoutez des amis depuis votre profil.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend: any) => (
                    <div key={friend.userId} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                        <SafeImage
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, #9747FF, #FF9F1C)' }}>{(friend.displayName || 'A').charAt(0)}</div>}
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
                        className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 ${
                          invitedUsers.has(friend.userId)
                            ? 'bg-green-100 text-green-600 border border-green-200'
                            : 'bg-[#9747FF] text-white'
                        } disabled:opacity-60`}
                      >
                        {invitingUsers.has(friend.userId) ? <Loader2 className="w-4 h-4 animate-spin" /> : invitedUsers.has(friend.userId) ? '✓ Invité' : 'Inviter'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending Bookings Modal (Organizer) */}
      {showPendingModal && isOrganizer && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
          <div className="w-full h-[70%] bg-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
              <h3 className="text-[18px] font-bold text-gray-900">Demandes en attente</h3>
              <button onClick={() => setShowPendingModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-500 font-bold leading-none">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-24">
              {!pendingBookingsData?.data || pendingBookingsData.data.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 text-[14px]">Aucune demande en attente.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBookingsData.data.map((booking: any) => (
                    <div key={booking.id} className="bg-orange-50 rounded-2xl p-4 flex items-center gap-3">
                      <SafeImage
                        src={booking.user.profile?.avatarUrl}
                        alt={booking.user.profile?.displayName}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        fallback={<div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, #9747FF, #FF9F1C)' }}>{(booking.user.profile?.displayName || 'A').charAt(0)}</div>}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-[14px]">{booking.user.profile?.displayName}</p>
                        <p className="text-gray-500 text-[12px]">@{booking.user.profile?.username}</p>
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
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-50 p-6 pt-8 pb-10 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <button 
              onClick={() => setShowProfileVerificationModal(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            
            <p className="text-[14px] font-bold text-gray-500 mb-6 uppercase tracking-wider">Vérification de profil requise</p>
            
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 mb-4">
                <BadgeCheck className="w-full h-full fill-blue-600 text-white" />
              </div>
              <h2 className="text-[20px] font-bold text-gray-900 mb-3">Vérifiez votre profil</h2>
              <p className="text-[14px] text-gray-500 mb-8 max-w-[280px] leading-relaxed">
                Vous devez avoir un profil vérifié pour ajouter une cagnotte à votre événement. Vérifiez votre profil pour continuer.
              </p>
              
              <button 
                onClick={() => {
                  setShowProfileVerificationModal(false)
                  navigate('/verify-profile')
                }}
                className="w-full py-4 bg-[#FF9F1C] rounded-full text-[15px] font-bold text-white active:scale-95 transition-transform"
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
