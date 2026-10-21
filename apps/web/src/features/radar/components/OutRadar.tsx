import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  Radio,
  Eye,
  EyeOff,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Compass,
  Filter,
  MoreVertical,
  Ban,
  Flag,
  Loader2,
  Inbox,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { SafeImage } from '@/components/shared/SafeImage'
import { useAuthStore } from '@/stores/auth.store'
import { apiClient } from '@/lib/api-client'
import { radarApi, RadarSearchResult } from '../api'
import { RadarView } from './RadarView'

// Types de sortie avec libellés et icônes
const OUTING_TYPES = [
  { value: 'ALL', label: 'Tous types' },
  { value: 'SPONTANEOUS', label: 'Sortie spontanée' },
  { value: 'RESTAURANT_BAR', label: 'Restaurant ou bar' },
  { value: 'SPECIFIC_EVENT', label: 'Événement précis' },
  { value: 'GROUP_ACTIVITY', label: 'Activité de groupe' },
]

export function OutRadar() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s: any) => s.user)

  // Onglet principal : 'radar' (Recherche & Profils) ou 'invites' (Mes invitations)
  const [activeTab, setActiveTab] = useState<'radar' | 'invites'>('radar')

  // État de localisation
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [requestingGeo, setRequestingGeo] = useState(false)

  // Paramètres de recherche
  const [radiusKm, setRadiusKm] = useState<number>(1) // 500m (0.5), 1km, 3km, 5km
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'FEMALE' | 'MALE'>('ALL')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [outingTypeFilter, setOutingTypeFilter] = useState('ALL')
  const [showFiltersModal, setShowFiltersModal] = useState(false)

  // Visibilité
  const [showVisibilityModal, setShowVisibilityModal] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<30 | 60>(30)
  const [visibilityOutingType, setVisibilityOutingType] = useState('SPONTANEOUS')

  // Menu action profil (bloquer / signaler)
  const [actionMenuProfileId, setActionMenuProfileId] = useState<string | null>(null)

  // Modal d'invitation personnalisée
  const [inviteTarget, setInviteTarget] = useState<RadarSearchResult | null>(null)
  const [inviteMessage, setInviteMessage] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  // OUT RADAR : identifiant de session pour redistribuer les angles à chaque recherche
  const [searchSessionId, setSearchSessionId] = useState(() => Math.random().toString(36).slice(2))

  // Ref vers la liste complète (pour le scroll depuis le badge +N)
  const listRef = useRef<HTMLDivElement>(null)

  // ── 1. Query: Statut de visibilité actuel ────────────────────────────────────
  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ['radar', 'status'],
    queryFn: radarApi.getStatus,
    refetchInterval: (query) => (query.state.data?.isVisible ? 15000 : false),
  })

  // Compte à rebours local de visibilité
  const [remainingSec, setRemainingSec] = useState<number>(0)

  useEffect(() => {
    if (!statusData?.isVisible || !statusData?.expiresAt) {
      setRemainingSec(0)
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const end = new Date(statusData.expiresAt!).getTime()
      const diff = Math.max(0, Math.floor((end - now) / 1000))
      setRemainingSec(diff)
      if (diff === 0) {
        queryClient.invalidateQueries({ queryKey: ['radar', 'status'] })
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [statusData?.isVisible, statusData?.expiresAt, queryClient])

  // ── 2. Query: Résultats de recherche ────────────────────────────────────────
  const {
    data: searchResults,
    isLoading: loadingSearch,
    isFetching: fetchingSearch,
    refetch: triggerSearch,
  } = useQuery({
    queryKey: [
      'radar',
      'search',
      coords?.latitude,
      coords?.longitude,
      radiusKm,
      genderFilter,
      verifiedOnly,
      outingTypeFilter,
    ],
    queryFn: () => {
      if (!coords) return []
      return radarApi.search({
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusKm,
        gender: genderFilter,
        verifiedOnly,
        outingType: outingTypeFilter === 'ALL' ? undefined : outingTypeFilter,
      })
    },
    enabled: Boolean(coords),
    staleTime: 10000,
  })

  // ── 3. Query: Mes invitations ──────────────────────────────────────────────
  const { data: invitesList, isLoading: loadingInvites } = useQuery({
    queryKey: ['radar', 'invites'],
    queryFn: radarApi.getInvites,
    enabled: activeTab === 'invites',
  })

  // ── 4. Demande de géolocalisation native uniquement au moment de la recherche ──
  const requestLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGeoError('La géolocalisation n’est pas supportée par votre appareil.')
        resolve(null)
        return
      }

      setRequestingGeo(true)
      setGeoError(null)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setRequestingGeo(false)
          const newCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }
          setCoords(newCoords)
          resolve(newCoords)
        },
        (err) => {
          setRequestingGeo(false)
          console.warn('Geolocation error:', err)
          setGeoError(
            'La recherche ne peut pas fonctionner sans autorisation de localisation. Veuillez autoriser l’accès à votre position.'
          )
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      )
    })
  }

  // ── 5. Action : Lancer la recherche ──────────────────────────────────────────
  const handleLaunchSearch = async () => {
    let currentCoords = coords
    if (!currentCoords) {
      currentCoords = await requestLocation()
      if (!currentCoords) return
    }
    // Nouvelle session → positions des avatars redistribuées
    setSearchSessionId(Math.random().toString(36).slice(2))
    triggerSearch()
  }

  // ── 5b. Élargir le rayon d'un cran ───────────────────────────────────────────
  const handleWidenRadius = useCallback(() => {
    const radii = [0.5, 1, 3, 5]
    const idx = radii.indexOf(radiusKm)
    if (idx < radii.length - 1) {
      setRadiusKm(radii[idx + 1])
    }
    handleLaunchSearch()
  }, [radiusKm])

  // ── 6. Mutation : Activer / Désactiver la visibilité ──────────────────────────
  const visibilityMutation = useMutation({
    mutationFn: radarApi.setVisibility,
    onSuccess: (data) => {
      queryClient.setQueryData(['radar', 'status'], data)
      setShowVisibilityModal(false)
      if (data.isVisible) {
        toast.success(`Vous êtes maintenant visible pour ${data.durationMinutes} minutes.`)
      } else {
        toast.success('Vous êtes maintenant invisible. Vos coordonnées ont été effacées.')
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Erreur lors du changement de visibilité.'
      toast.error(msg)
    },
  })

  const handleToggleVisibility = async (makeVisible: boolean) => {
    if (!makeVisible) {
      visibilityMutation.mutate({ isVisible: false })
      return
    }

    // Pour devenir visible, on a besoin des coordonnées
    let currentCoords = coords
    if (!currentCoords) {
      currentCoords = await requestLocation()
      if (!currentCoords) {
        toast.error('La position GPS est requise pour activer la visibilité.')
        return
      }
    }

    visibilityMutation.mutate({
      isVisible: true,
      durationMinutes: selectedDuration,
      outingType: visibilityOutingType,
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
    })
  }

  // ── 7. Envoi d'une invitation ──────────────────────────────────────────────
  const handleSendInvite = async () => {
    if (!inviteTarget) return
    setSendingInvite(true)
    try {
      await radarApi.sendInvite({
        receiverId: inviteTarget.id,
        outingType: inviteTarget.outingType || undefined,
        message: inviteMessage.trim() || undefined,
      })
      toast.success(`Invitation envoyée à ${inviteTarget.displayName} !`)
      setInviteTarget(null)
      setInviteMessage('')
      queryClient.invalidateQueries({ queryKey: ['radar', 'search'] })
      queryClient.invalidateQueries({ queryKey: ['radar', 'invites'] })
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Erreur lors de l'envoi de l'invitation."
      toast.error(msg)
    } finally {
      setSendingInvite(false)
    }
  }

  // ── 8. Réponse à une invitation ────────────────────────────────────────────
  const respondInviteMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'ACCEPT' | 'DECLINE' }) =>
      radarApi.respondInvite(id, action),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['radar', 'invites'] })
      queryClient.invalidateQueries({ queryKey: ['radar', 'search'] })
      if (vars.action === 'ACCEPT') {
        toast.success('Invitation acceptée !')
        if (res.conversationId) {
          navigate('/messages', { state: { conversationId: res.conversationId } })
        }
      } else {
        toast.info('Invitation refusée.')
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || 'Erreur lors de la réponse.'
      toast.error(msg)
    },
  })

  // ── 9. Bloquer / Signaler un profil ─────────────────────────────────────────
  const handleBlockUser = async (targetId: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment bloquer ${name} ? Vous ne vous verrez plus jamais sur OUT RADAR.`)) return
    try {
      await apiClient.post(`/users/${targetId}/block`)
      toast.success(`${name} a été bloqué.`)
      setActionMenuProfileId(null)
      queryClient.invalidateQueries({ queryKey: ['radar', 'search'] })
    } catch {
      toast.error('Erreur lors du blocage.')
    }
  }

  const handleReportUser = (targetId: string) => {
    setActionMenuProfileId(null)
    navigate(`/reports/new?userId=${targetId}`)
  }

  // Formatage mm:ss
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const isVisible = Boolean(statusData?.isVisible)

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white flex flex-col">
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-[#1A1A1A]/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 pt-safe-4 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Retour"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#FF7A00]/15 flex items-center justify-center text-[#FF7A00]">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <h1 className="text-lg font-bold tracking-tight">OUT RADAR</h1>
            </div>
          </div>

          {/* Onglet Mes invitations avec badge */}
          <button
            onClick={() => setActiveTab(activeTab === 'radar' ? 'invites' : 'radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'invites'
                ? 'bg-[#FF7A00] text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Invitations</span>
          </button>
        </div>
      </div>

      {/* ── CORPS DU RADAR ───────────────────────────────────────────────────── */}
      <div className="flex-1 p-4 max-w-xl mx-auto w-full space-y-4 pb-20">
        {activeTab === 'invites' ? (
          /* ── ONGLET : MES INVITATIONS ─────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Mes invitations OUT RADAR</h2>
              <button
                onClick={() => setActiveTab('radar')}
                className="text-xs font-semibold text-[#FF7A00] hover:underline"
              >
                Retour au radar
              </button>
            </div>

            {loadingInvites ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#FF7A00]" />
              </div>
            ) : !invitesList || invitesList.length === 0 ? (
              <div className="text-center py-14 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3 text-xl">
                  📬
                </div>
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">Aucune invitation pour le moment</p>
                <p className="text-xs text-gray-400 mt-1">
                  Les demandes que vous recevez ou envoyez apparaîtront ici.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitesList.map((inv) => {
                  const isReceived = inv.receiverId === currentUser?.id
                  const otherUser = isReceived ? inv.sender : inv.receiver
                  const profile = otherUser?.profile

                  return (
                    <div
                      key={inv.id}
                      className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
                            {profile?.avatarUrl ? (
                              <SafeImage
                                src={profile.avatarUrl}
                                alt={profile.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-sm">
                                {profile?.displayName?.[0] || 'O'}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm truncate">{profile?.displayName || 'Outster'}</p>
                              {(profile?.kycStatus === 'verified' || otherUser?.isVerified) && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 fill-blue-500 text-white shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {isReceived ? 'Vous a invité' : 'Invitation envoyée'} · {new Date(inv.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Statut badge */}
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                            inv.status === 'ACCEPTED'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : inv.status === 'DECLINED'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : inv.status === 'EXPIRED'
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                              : 'bg-orange-100 dark:bg-[#FF7A00]/20 text-[#FF7A00]'
                          }`}
                        >
                          {inv.status === 'PENDING'
                            ? 'En attente'
                            : inv.status === 'ACCEPTED'
                            ? 'Acceptée'
                            : inv.status === 'DECLINED'
                            ? 'Refusée'
                            : 'Expirée'}
                        </span>
                      </div>

                      {inv.outingType && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-[#FF7A00]" />
                          <span>
                            {OUTING_TYPES.find((t) => t.value === inv.outingType)?.label || inv.outingType}
                          </span>
                        </div>
                      )}

                      {inv.message && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 italic px-1">
                          « {inv.message} »
                        </p>
                      )}

                      {/* Actions */}
                      {isReceived && inv.status === 'PENDING' && (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => respondInviteMutation.mutate({ id: inv.id, action: 'ACCEPT' })}
                            disabled={respondInviteMutation.isPending}
                            className="flex-1 py-2 rounded-full bg-[#FF7A00] text-white text-xs font-semibold hover:bg-[#E06C00] active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Accepter
                          </button>
                          <button
                            onClick={() => respondInviteMutation.mutate({ id: inv.id, action: 'DECLINE' })}
                            disabled={respondInviteMutation.isPending}
                            className="py-2 px-4 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            Refuser
                          </button>
                        </div>
                      )}

                      {inv.status === 'ACCEPTED' && (
                        <button
                          onClick={() => navigate('/messages')}
                          className="w-full py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#FF7A00]" />
                          Ouvrir la discussion
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── ONGLET : OUT RADAR (Recherche & Profils) ──────────────────────── */
          <>
            {/* 1. Bloc de bienvenue & explication */}
            <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 shadow-xs space-y-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">OUT RADAR</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  Découvre les Outsters disponibles autour de toi pour partager une sortie ou une activité.
                </p>
              </div>

              {/* 2. Commande de visibilité (Invisible / Visible) */}
              <div className="bg-gray-50 dark:bg-[#222222] rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isVisible
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-600'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
                    }`}
                  >
                    {isVisible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {isVisible ? 'Vous êtes Visible' : 'Vous êtes Invisible'}
                      </p>
                      {isVisible && remainingSec > 0 && (
                        <span className="text-[11px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimer(remainingSec)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {isVisible
                        ? 'Détectable par les Outsters dans le rayon choisi'
                        : 'Votre profil n’apparaît dans aucun résultat'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (isVisible) {
                      handleToggleVisibility(false)
                    } else {
                      setShowVisibilityModal(true)
                    }
                  }}
                  disabled={visibilityMutation.isPending || loadingStatus}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 active:scale-95 ${
                    isVisible
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300'
                      : 'bg-[#FF7A00] text-white hover:bg-[#E06C00]'
                  }`}
                >
                  {visibilityMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isVisible ? (
                    'Devenir invisible'
                  ) : (
                    'Activer'
                  )}
                </button>
              </div>

              {/* 3. Choix du rayon et filtres */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Rayon de recherche</span>
                  <button
                    onClick={() => setShowFiltersModal(true)}
                    className="flex items-center gap-1 text-[#FF7A00] font-semibold hover:underline"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtres</span>
                    {(genderFilter !== 'ALL' || verifiedOnly || outingTypeFilter !== 'ALL') && (
                      <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />
                    )}
                  </button>
                </div>

                {/* Sélecteur de rayon (500m, 1km, 3km, 5km) */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 0.5, label: '500 m' },
                    { value: 1.0, label: '1 km' },
                    { value: 3.0, label: '3 km' },
                    { value: 5.0, label: '5 km' },
                  ].map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRadiusKm(r.value)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        radiusKm === r.value
                          ? 'bg-[#FF7A00] text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message d'erreur de géolocalisation */}
              {geoError && (
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-orange-800 dark:text-orange-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#FF7A00] mt-0.5" />
                  <p>{geoError}</p>
                </div>
              )}

              {/* 4. Bouton principal "Rechercher" */}
              <button
                onClick={handleLaunchSearch}
                disabled={requestingGeo || fetchingSearch}
                className="w-full h-11 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-[#FF7A00]/20"
              >
                {requestingGeo || fetchingSearch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recherche en cours...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    <span>Rechercher les Outsters</span>
                  </>
                )}
              </button>
            </div>

            {/* ── 5. RADAR VISUEL + LISTE COMPLÈTE (AUCUNE CARTE GÉO) ─────────── */}

            {/* Zone radar — affichée si recherche en cours ou résultats disponibles */}
            {(fetchingSearch || loadingSearch || searchResults !== undefined) && (
              <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs">
                <RadarView
                  isSearching={fetchingSearch || loadingSearch}
                  results={searchResults}
                  sessionId={searchSessionId}
                  onSendInvite={(profile) => setInviteTarget(profile)}
                  onBlockUser={handleBlockUser}
                  onReportUser={handleReportUser}
                  onModifyFilters={() => setShowFiltersModal(true)}
                  onWidenRadius={handleWidenRadius}
                  listRef={listRef}
                />
              </div>
            )}

            {/* Liste complète des résultats (accessible, visible sous le radar) */}
            {!loadingSearch && searchResults && searchResults.length > 0 && (
              <div ref={listRef} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    {searchResults.length} Outster{searchResults.length > 1 ? 's' : ''} à proximité
                  </h3>
                  <span className="text-[11px] text-gray-400">Rayon : {radiusKm < 1 ? '500 m' : `${radiusKm} km`}</span>
                </div>

                {searchResults.map((profile) => (
                  <div
                    key={profile.id}
                    className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-xs relative transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
                          {profile.avatarUrl ? (
                            <SafeImage
                              src={profile.avatarUrl}
                              alt={profile.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-sm">
                              {profile.displayName?.[0] || 'O'}
                            </div>
                          )}
                        </div>

                        {/* Informations */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {profile.displayName}
                            </p>
                            {profile.isVerified && (
                              <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-500 text-white shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-[#FF7A00] font-medium mt-0.5">{profile.proximity}</p>
                          {profile.outingType && (
                            <span className="inline-block mt-1 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                              {OUTING_TYPES.find((t) => t.value === profile.outingType)?.label || profile.outingType}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Menu modération */}
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuProfileId(actionMenuProfileId === profile.id ? null : profile.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuProfileId === profile.id && (
                          <div className="absolute right-0 top-8 z-30 w-36 bg-white dark:bg-[#252525] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 text-xs font-medium">
                            <button
                              onClick={() => handleBlockUser(profile.id, profile.displayName)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-red-600"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Bloquer
                            </button>
                            <button
                              onClick={() => handleReportUser(profile.id)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                            >
                              <Flag className="w-3.5 h-3.5" />
                              Signaler
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bouton invitation */}
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-end">
                      {profile.inviteStatus === 'PENDING' ? (
                        <span className="text-xs font-semibold text-orange-500 bg-orange-50 dark:bg-orange-950/30 px-3 py-1.5 rounded-full">Demande envoyée</span>
                      ) : profile.inviteStatus === 'ACCEPTED' ? (
                        <button
                          onClick={() => navigate('/messages')}
                          className="px-3.5 py-1.5 rounded-full bg-green-500 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Discuter
                        </button>
                      ) : profile.inviteStatus === 'DECLINED' ? (
                        <span className="text-xs font-semibold text-gray-400 px-3 py-1.5">Invitation déclinée</span>
                      ) : (
                        <button
                          onClick={() => setInviteTarget(profile)}
                          className="px-4 py-1.5 rounded-full bg-[#FF7A00] text-white text-xs font-semibold hover:bg-[#E06C00] active:scale-95 transition-all flex items-center gap-1.5 shadow-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Envoyer une invitation
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── MODAL : CONFIGURER LA VISIBILITÉ ─────────────────────────────────── */}
      {showVisibilityModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 space-y-4 max-h-[85dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Activer ma visibilité</h3>
              <button
                onClick={() => setShowVisibilityModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Votre profil sera temporairement détectable par les Outsters à proximité. À la fin du délai, vous repasserez automatiquement en invisible.
            </p>

            {/* Durée obligatoire (30 ou 60 minutes) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Durée de visibilité
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDuration(d as 30 | 60)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                      selectedDuration === d
                        ? 'bg-[#FF7A00] text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {d} minutes
                  </button>
                ))}
              </div>
            </div>

            {/* Type de sortie recherché */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Type de sortie recherché
              </label>
              <select
                value={visibilityOutingType}
                onChange={(e) => setVisibilityOutingType(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-medium outline-none text-gray-900 dark:text-white"
              >
                {OUTING_TYPES.filter((t) => t.value !== 'ALL').map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleToggleVisibility(true)}
              disabled={visibilityMutation.isPending}
              className="w-full py-3 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] text-white text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-[#FF7A00]/25"
            >
              {visibilityMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Confirmer et devenir visible'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL : FILTRES COMBINABLES ──────────────────────────────────────── */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 space-y-4 max-h-[85dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Filtres de recherche</h3>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {/* Filtre Genre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Genre</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'ALL', label: 'Tous' },
                  { value: 'FEMALE', label: 'Femmes' },
                  { value: 'MALE', label: 'Hommes' },
                ].map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGenderFilter(g.value as any)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                      genderFilter === g.value
                        ? 'bg-[#FF7A00] text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre Vérification KYC */}
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Profils vérifiés uniquement</p>
                <p className="text-[11px] text-gray-400">Afficher uniquement les comptes certifiés KYC</p>
              </div>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 accent-[#FF7A00] rounded cursor-pointer"
              />
            </div>

            {/* Filtre Type de sortie */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Type de sortie
              </label>
              <select
                value={outingTypeFilter}
                onChange={(e) => setOutingTypeFilter(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-medium outline-none text-gray-900 dark:text-white"
              >
                {OUTING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setGenderFilter('ALL')
                  setVerifiedOnly(false)
                  setOutingTypeFilter('ALL')
                }}
                className="py-2.5 px-4 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowFiltersModal(false)
                  handleLaunchSearch()
                }}
                className="flex-1 py-2.5 rounded-full bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#E06C00] shadow-md shadow-[#FF7A00]/25"
              >
                Appliquer les filtres
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : ENVOYER UNE INVITATION ──────────────────────────────────── */}
      {inviteTarget && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 border border-gray-100 dark:border-gray-800 space-y-4 max-h-[85dvh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Inviter {inviteTarget.displayName}</h3>
              <button
                onClick={() => setInviteTarget(null)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Une notification sera envoyée à {inviteTarget.displayName}. Si elle accepte, vous pourrez discuter ensemble pour organiser la sortie.
            </p>

            <textarea
              placeholder="Ajouter un mot sympa (optionnel)... Ex: Hello ! Partant pour boire un verre ?"
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 text-xs text-gray-900 dark:text-white outline-none resize-none placeholder:text-gray-400"
            />

            <button
              onClick={handleSendInvite}
              disabled={sendingInvite}
              className="w-full py-3 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] text-white text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-[#FF7A00]/25"
            >
              {sendingInvite ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer l'invitation</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
