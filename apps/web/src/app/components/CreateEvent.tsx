import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import {
  Cancel01Icon,
  ImageAdd01Icon,
  Location01Icon as HugeMapPin,
  Calendar01Icon as HugeCalendar,
  Clock01Icon as HugeClock,
  UserIcon,
  ArrowLeft01Icon,
  PaintBoardIcon,
  MaskTheater01Icon,
  FootballIcon,
  HeartAddIcon,
  ForkIcon,
  DrinkIcon,
  UserGroupIcon,
  PartyIcon,
  ChurchIcon,
  ShoppingBag01Icon,
  MusicNote01Icon,
  Tv01Icon,
  Clock04Icon,
  PencilEdit01Icon,
  Delete01Icon,
  EarthIcon,
  LockIcon,
  Search01Icon,
  CheckmarkCircle02Icon,
  Upload04Icon,
  Image01Icon,
  LockKeyIcon,
  Coins02Icon
} from 'hugeicons-react'

import { apiClient } from '@/lib/api-client'
import { eventsApi } from '@/features/events/api'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { SafeImage } from '@/components/shared/SafeImage'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { toast } from 'sonner'
import { searchPlaces, reverseGeocode } from '@/lib/geo'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CreateEventProps { onBack: () => void }

// ── Categories (fidèles aux maquettes) ──────────────────────────────────────
const CATEGORIES = [
  { label: 'Art et culture',            value: 'CULTURE',   Icon: PaintBoardIcon },
  { label: 'Comédie',                   value: 'SOCIAL',    Icon: MaskTheater01Icon },
  { label: 'Sport',                     value: 'SPORT',     Icon: FootballIcon },
  { label: 'Santé et bien-être',        value: 'WELLNESS',  Icon: HeartAddIcon },
  { label: 'Cuisine et gastronomie',    value: 'FOOD',      Icon: ForkIcon },
  { label: 'Boissons',                  value: 'NIGHTLIFE', Icon: DrinkIcon },
  { label: 'Réseautage professionnel',  value: 'TECH',      Icon: UserGroupIcon },
  { label: 'Fêtes',                     value: 'PARTIES',   Icon: PartyIcon },
  { label: 'Religion',                  value: 'RELIGION',  Icon: ChurchIcon },
  { label: 'Shopping',                  value: 'LIFESTYLE', Icon: ShoppingBag01Icon },
  { label: 'Musique et son',            value: 'MUSIC',     Icon: MusicNote01Icon },
  { label: 'Télévision et cinéma',      value: 'ART',       Icon: Tv01Icon },
]

// ── Participation modes ──────────────────────────────────────────────────────
const PARTICIPATION_MODES = [
  { value: 'free',    label: 'Gratuit',      desc: 'Entrée ouverte à tous sans paiement',              emoji: '🔓' },
  { value: 'ticket',  label: 'Sur ticket',   desc: "Accès sur achat de tickets d'entrée",               emoji: '🎫' },
  { value: 'cagnotte',label: 'Sur cagnotte', desc: 'Accès sur contribution à une cagnotte partagée',   emoji: '💰' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDateFr(iso: string) {
  try { return format(new Date(iso + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr }) }
  catch { return iso }
}

function formatDateTime(date: string, time: string) {
  if (!date || !time) return ''
  try {
    return format(new Date(`${date}T${time}`), "EEEE d MMMM yyyy HH:mm", { locale: fr })
      .replace(/^\w/, c => c.toUpperCase())
  } catch { return `${date} ${time}` }
}

function InputField({
  label, value, placeholder, onClick, onChange, readOnly, rightIcons
}: {
  label: string
  value?: string
  placeholder?: string
  onClick?: () => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  readOnly?: boolean
  rightIcons?: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">{label}</p>
      <div className="relative" onClick={onClick}>
        <input
          value={value || ''}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={onChange}
          className={`w-full pl-4 ${rightIcons ? 'pr-[80px]' : 'pr-4'} py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--brand-orange-500)] bg-[var(--color-background-primary)] ${readOnly ? 'cursor-pointer' : ''}`}
        />
        {rightIcons && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {rightIcons}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export function CreateEvent({ onBack }: CreateEventProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const me = useAuthStore((state: any) => state.user)

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [hasEndDate, setHasEndDate] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lon, setLon] = useState<number | null>(null)
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PRIVATE' | null>(null)
  const [allowGuestInvites, setAllowGuestInvites] = useState(false)
  const [description, setDescription] = useState('')
  const [participationMode, setParticipationMode] = useState<string | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [selectedCoOrgs, setSelectedCoOrgs] = useState<any[]>([])
  const [maxPlaces, setMaxPlaces] = useState('')
  const [amount, setAmount] = useState('')

  // ── UI state ────────────────────────────────────────────────────────────
  const [showCategorySheet, setShowCategorySheet] = useState(false)
  const [showStartDateSheet, setShowStartDateSheet] = useState(false)
  const [showEndDateSheet, setShowEndDateSheet] = useState(false)
  const [showRegEndDateSheet, setShowRegEndDateSheet] = useState(false)
  const [showPrivacySheet, setShowPrivacySheet] = useState(false)
  const [showParticipationSheet, setShowParticipationSheet] = useState(false)
  const [showOrganizerSearch, setShowOrganizerSearch] = useState(false)
  const [showLocationSearch, setShowLocationSearch] = useState(false)

  // ── Temp state for date sheets ──────────────────────────────────────────
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempStartTime, setTempStartTime] = useState('10:00')
  const [tempEndDate, setTempEndDate] = useState('')
  const [tempEndTime, setTempEndTime] = useState('12:00')
  const [regEndDate, setRegEndDate] = useState('')
  const [regEndTime, setRegEndTime] = useState('')
  const [tempRegEndDate, setTempRegEndDate] = useState('')
  const [tempRegEndTime, setTempRegEndTime] = useState('12:00')

  // ── Location search ─────────────────────────────────────────────────────
  const [locationTab, setLocationTab] = useState<'liste' | 'carte'>('liste')
  const [locationQuery, setLocationQuery] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState<{label:string;lat:number;lon:number}[]>([])
  const [tempLat, setTempLat] = useState<number>(6.36536)
  const [tempLon, setTempLon] = useState<number>(2.41833)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)

  // ── Organizer search ────────────────────────────────────────────────────
  const [coOrgSearch, setCoOrgSearch] = useState('')

  // ── Submission ──────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [createdEventId, setCreatedEventId] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'preview' | 'done' | 'published'>('form')
  const [formStep, setFormStep] = useState<1 | 2>(1)

  const [enablePool, setEnablePool] = useState(false)
  const [poolDescription, setPoolDescription] = useState('')
  const [poolTarget, setPoolTarget] = useState('')
  const [poolMinAmount, setPoolMinAmount] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Friends for organizer search ────────────────────────────────────────
  const { data: friendsData } = useQuery({
    queryKey: ['friends-search', coOrgSearch],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/friends', { params: { search: coOrgSearch || undefined, limit: 20 } })
      return res.data
    },
    enabled: showOrganizerSearch,
    staleTime: 30000,
  })
  const friends: any[] = Array.isArray(friendsData) ? friendsData : (friendsData?.data ?? [])

  // ── Location search handler ──────────────────────────────────────────────
  const locationTimeoutRef = useRef<number | null>(null)
  const handleLocationSearch = (q: string) => {
    setLocationQuery(q)
    if (q.length < 2) { setLocationSuggestions([]); return }
    if (locationTimeoutRef.current) window.clearTimeout(locationTimeoutRef.current)
    locationTimeoutRef.current = window.setTimeout(async () => {
      try {
        const res = await searchPlaces(q, city)
        setLocationSuggestions(res)
      } catch { setLocationSuggestions([]) }
    }, 400)
  }

  const selectLocation = (s: {label:string;lat:number;lon:number}) => {
    const parts = s.label.split(',')
    setCity(parts[0].trim())
    setAddress(s.label)
    setLat(s.lat)
    setLon(s.lon)
    setShowLocationSearch(false)
    setLocationQuery('')
    setLocationSuggestions([])
  }

  const confirmMapLocation = async () => {
    setIsReverseGeocoding(true)
    const result = await reverseGeocode(tempLat, tempLon)
    setCity(result.city)
    setAddress(result.address)
    setLat(result.lat)
    setLon(result.lon)
    setShowLocationSearch(false)
    setIsReverseGeocoding(false)
    toast.success('Emplacement validé !')
  }

  // ── Cover image ──────────────────────────────────────────────────────────
  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f))
  }

  // ── Pre-fill from editing ─────────────────────────────────────────────
  useEffect(() => {
    const eventData = location.state?.eventData
    const editEventId = location.state?.editEventId
    if (eventData && editEventId) {
      if (eventData.title) setTitle(eventData.title)
      if (eventData.category) setCategory(eventData.category)
      if (eventData.startAt) {
        const d = new Date(eventData.startAt)
        setStartDate(d.toISOString().split('T')[0])
        setStartTime(d.toISOString().split('T')[1].slice(0, 5))
      }
      if (eventData.endAt) {
        const d = new Date(eventData.endAt)
        setEndDate(d.toISOString().split('T')[0])
        setEndTime(d.toISOString().split('T')[1].slice(0, 5))
        setHasEndDate(true)
      }
      if (eventData.city) setCity(eventData.city)
      if (eventData.address) setAddress(eventData.address)
      if (eventData.latitude) setLat(eventData.latitude)
      if (eventData.longitude) setLon(eventData.longitude)
      if (eventData.maxAttendees) setMaxPlaces(String(eventData.maxAttendees))
      if (eventData.price !== undefined) setAmount(String(eventData.price))
      if (eventData.isPrivate !== undefined) setPrivacy(eventData.isPrivate ? 'PRIVATE' : 'PUBLIC')
      if (eventData.description) setDescription(eventData.description)
      if (eventData.coverUrl) setCoverPreview(eventData.coverUrl)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ───────────────────────────────────────────────────────────────
  const canGoToStep2 = title.trim().length >= 2 && !!startDate && !!startTime && !!category && !!(address || city) && !!privacy
  const canSubmit = canGoToStep2 && !!participationMode

  const handleSubmit = async () => {
    if (formStep === 1) {
      if (!canGoToStep2) { toast.error('Remplissez les champs obligatoires.'); return }
      setFormStep(2)
      return
    }
    if (!canSubmit) { toast.error('Remplissez le mode de participation.'); return }
    setLoading(true)
    const editEventId = location.state?.editEventId || createdEventId
    try {
      let coverUrl: string | undefined
      if (coverFile) {
        const { data } = await eventsApi.uploadCover(coverFile)
        coverUrl = data.url
      } else if (coverPreview) {
        coverUrl = coverPreview
      }

      const startAt = new Date(`${startDate}T${startTime}`).toISOString()
      const endAt = hasEndDate && endDate && endTime
        ? new Date(`${endDate}T${endTime}`).toISOString()
        : new Date(`${startDate}T${startTime}`).toISOString()

      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category!,
        currency: 'XOF',
        startAt,
        endAt,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
        country: 'Bénin',
        latitude: lat ?? undefined,
        longitude: lon ?? undefined,
        maxAttendees: maxPlaces ? parseInt(maxPlaces) : undefined,
        price: amount ? parseFloat(amount) : undefined,
        isPrivate: privacy === 'PRIVATE',
        coverUrl,
        poolTarget: enablePool && poolTarget ? parseFloat(poolTarget) : undefined,
        poolMode: enablePool && poolTarget ? (poolMinAmount ? 'minimum' : 'libre') : undefined,
        poolMinAmount: enablePool && poolMinAmount ? parseFloat(poolMinAmount) : undefined,
        status: 'DRAFT',
        coHostIds: selectedCoOrgs.map(o => o.id),
      }

      let res
      if (editEventId) {
        res = await apiClient.patch(`/events/${editEventId}`, payload)
      } else {
        res = await apiClient.post('/events', payload)
      }

      const eventId = editEventId || res.data?.id
      setCreatedEventId(eventId)
      localStorage.removeItem('create_event_draft')
      toast.success('Événement créé ! Publiez-le quand vous êtes prêt.')
      setStep('done')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur lors de la création')
    } finally { setLoading(false) }
  }

  const savePoolToEvent = async () => {
    const eventId = createdEventId || location.state?.editEventId
    if (!eventId || !enablePool || !poolTarget) return
    await apiClient.patch(`/events/${eventId}`, {
      poolTarget: parseFloat(poolTarget),
      poolMode: poolMinAmount ? 'minimum' : 'libre',
      poolMinAmount: poolMinAmount ? parseFloat(poolMinAmount) : undefined,
    })
  }

  const handlePublish = async () => {
    const eventId = createdEventId || location.state?.editEventId
    if (!eventId) return
    setPublishing(true)
    try {
      if (enablePool && poolTarget) await savePoolToEvent()
      await apiClient.put(`/events/${eventId}/publish`)
      toast.success('🎉 Événement publié avec succès !')
      setStep('published')
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors de la publication')
    } finally { setPublishing(false) }
  }

  // ── Derived labels ───────────────────────────────────────────────────────
  const catLabel = CATEGORIES.find(c => c.value === category)
  const privacyLabel = privacy === 'PUBLIC' ? 'Public' : privacy === 'PRIVATE' ? 'Privé' : null
  const participationLabel = PARTICIPATION_MODES.find(p => p.value === participationMode)?.label ?? null
  const startDateLabel = startDate && startTime ? formatDateTime(startDate, startTime) : null
  const endDateLabel = endDate && endTime ? formatDateTime(endDate, endTime) : null

  // ── Auto-transition to publish ──────────────────────────────────────────
  useEffect(() => {
    if (step === 'done' && participationMode !== 'cagnotte') {
      const timer = setTimeout(() => {
        handlePublish()
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [step, participationMode])

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER — DONE or PUBLISHED screen
  // ──────────────────────────────────────────────────────────────────────────
  if (step === 'done' || step === 'published') {
    const isPublished = step === 'published'
    return (
      <div className={`w-full h-full flex flex-col relative overflow-hidden ${isPublished ? 'bg-[var(--color-background-primary)]' : 'bg-[var(--color-background-primary-alt)]'}`}>
        <div className={`px-5 pt-safe-6 pb-4 shrink-0 ${isPublished ? 'bg-[var(--color-background-primary)]' : 'bg-[var(--color-background-primary-alt)]'}`} />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-40">
          <div className="flex flex-col items-center pt-8 gap-5">
            {/* Top Section */}
            <div className="flex flex-col items-center gap-3 w-full">
              {/* Icon */}
              <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center mb-1 ${isPublished ? 'bg-gradient-to-tr from-[var(--brand-yellow-500)] to-[var(--functional-green-500)]' : 'bg-[var(--brand-orange-400)]'}`}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              {/* Title */}
              <h1 className={`text-[24px] font-semibold text-center ${isPublished ? 'text-[var(--functional-green-500)]' : 'text-[var(--brand-orange-500)]'}`} style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isPublished ? 'Publié !' : 'Terminé !'}
              </h1>
              <p className="text-[14px] text-[var(--color-text-secondary)] text-center max-w-[300px] leading-[1.6]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isPublished
                  ? "Votre événement a été publié avec succès. Vous pouvez maintenant le partager ou voir les détails."
                  : "Votre événement a été bien créé. Publiez-le pour le rendre visible ou invitez vos amis à participer."}
              </p>
            </div>

            {/* Summary Card */}
            <div className="w-full bg-[var(--color-background-primary)] rounded-[16px] p-5 shadow-[var(--shadow-bottom-sheet)] border border-[var(--border-tertiary)]">
              <h3 className="font-bold text-[15px] text-[var(--color-text-primary)] mb-5 truncate">{title || 'Votre événement'}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">Date</span>
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)] text-right truncate max-w-[200px]">
                    {startDate ? `${formatDateFr(startDate)}, ${startTime.replace(':', 'h')}${endTime ? ` - ${endTime.replace(':', 'h')}` : ''}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">Lieu</span>
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)] text-right truncate max-w-[200px]">{address || city || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">Participation</span>
                  <div className={`px-2.5 py-1 rounded-[6px] text-[12px] font-bold ${participationMode === 'free' ? 'bg-[var(--functional-green-500)] text-[var(--color-text-inverse)]' : 'bg-[var(--brand-blue-500)] text-[var(--color-text-inverse)]'}`}>
                    {participationMode === 'free' ? 'Gratuite' : 'Cagnotte'}
                  </div>
                </div>
              </div>
            </div>

            {/* Alert Box for Cagnotte */}
            {!isPublished && participationMode === 'cagnotte' && (
              <div className="w-full bg-[var(--brand-blue-100)] rounded-[12px] p-4 flex gap-3 items-start border border-[var(--brand-blue-100)]">
                <div className="w-[18px] h-[18px] shrink-0 mt-[1px]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2.5L21.5 12L12 21.5L2.5 12L12 2.5Z" stroke="var(--brand-blue-500)" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 8V13M12 16H12.01" stroke="var(--brand-blue-500)" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="text-[12px] text-[var(--color-text-primary)] leading-[1.5]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Votre événement contient une cagnotte. Vérifiez votre compte pour pouvoir le publier et activer la cagnotte.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className={`absolute bottom-0 left-0 right-0 px-5 py-6 space-y-3 bg-gradient-to-t ${isPublished ? 'from-[var(--color-background-primary)] via-[var(--color-background-primary)]' : 'from-[var(--color-background-alt)] via-[var(--color-background-alt)]'} to-transparent`}>
          {isPublished && (
            <button
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: title || 'Mon événement',
                      text: "Rejoignez-moi pour cet événement sur Let's Out !",
                      url: window.location.origin + `/events/${createdEventId}`
                    })
                  } catch (err) { console.log('Partage annulé ou échoué', err) }
                } else {
                  navigator.clipboard.writeText(window.location.origin + `/events/${createdEventId}`)
                  toast.success('Lien copié dans le presse-papiers !')
                }
              }}
              className="w-full py-[15px] rounded-[100px] bg-[var(--color-action-primary)] font-semibold text-[15px] text-[var(--color-text-inverse)] active:scale-[0.98] transition-transform"
            >
              Partager l'événement
            </button>
          )}

          {!isPublished && participationMode === 'cagnotte' && (
            <button
              onClick={() => { toast.info('Redirection vers la vérification du compte...') }}
              className="w-full py-[15px] rounded-[100px] bg-[var(--color-action-primary)] font-semibold text-[15px] text-[var(--color-text-inverse)] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              Vérifier mon compte
            </button>
          )}

          {!isPublished && participationMode !== 'cagnotte' && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className={`w-full py-[15px] rounded-[100px] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${publishing ? 'bg-[var(--brand-orange-100)] text-[var(--brand-orange-400)]' : 'bg-[var(--color-action-primary)] text-[var(--color-text-inverse)]'}`}
            >
              {publishing ? <div className="w-5 h-5 border-2 border-[var(--brand-orange-400)] border-t-transparent rounded-full animate-spin" /> : null}
              {publishing ? 'Publication...' : "Publier l'événement"}
            </button>
          )}

          <button
            onClick={() => navigate(createdEventId ? `/events/${createdEventId}` : '/profile')}
            className="w-full py-[15px] rounded-[100px] border border-[var(--border-default)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)] font-semibold text-[15px] active:scale-[0.98] transition-transform"
          >
            Voir l'événement
          </button>
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER — ORGANIZER SEARCH screen
  // ──────────────────────────────────────────────────────────────────────────
  if (showOrganizerSearch) {
    return (
      <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col">
        <div className="px-5 pt-safe-6 pb-3 border-b border-[var(--border-tertiary)] shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowOrganizerSearch(false)}
              className="w-9 h-9 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center active:scale-95 transition-transform">
              <ArrowLeft01Icon className="w-5 h-5 text-[var(--color-icon-primary)]" strokeWidth={2} />
            </button>
            <div className="flex-1 relative">
              <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-icon-muted)]" />
              <input
                autoFocus
                value={coOrgSearch}
                onChange={e => setCoOrgSearch(e.target.value)}
                placeholder="Rechercher un organisateur"
                className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-default)] rounded-full text-[14px] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-3">
          {friends.filter(f => !selectedCoOrgs.find(o => o.id === (f.userId || f.id))).map((f: any) => {
            const name = f.displayName || f.username || 'Utilisateur'
            const uid = f.userId || f.id
            const colors = ['var(--brand-orange-500)', 'var(--functional-green-500)', 'var(--brand-blue-500)', 'var(--brand-pink-500)', 'var(--functional-red-500)']
            const color = colors[name.charCodeAt(0) % colors.length]
            return (
              <div key={uid} className="flex items-center justify-between py-3 border-b border-[var(--border-tertiary)] last:border-0">
                <div className="flex items-center gap-3">
                  {f.avatarUrl ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <SafeImage src={f.avatarUrl} alt={name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[var(--color-text-inverse)] font-bold text-[15px]"
                      style={{ backgroundColor: color }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">{name}</p>
                    {f.username && <p className="text-[12px] text-[var(--color-text-secondary)]">@{f.username}</p>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCoOrgs(p => [...p, { id: uid, name, avatarUrl: f.avatarUrl }])
                    setShowOrganizerSearch(false)
                  }}
                  className="text-[13px] font-semibold text-[var(--color-action-primary)] active:scale-95 transition-transform px-3 py-1 rounded-full border border-[var(--color-action-primary)]">
                  Ajouter
                </button>
              </div>
            )
          })}
          {friends.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-16 text-center">
              <UserIcon className="w-12 h-12 text-[var(--color-icon-muted)] mb-3" strokeWidth={1.5} />
              <p className="text-[14px] text-[var(--color-text-secondary)]">Aucun ami trouvé</p>
              <p className="text-[12px] text-[var(--color-text-muted)] mt-1">Essayez un autre nom</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER — LOCATION SEARCH screen
  // ──────────────────────────────────────────────────────────────────────────
  if (showLocationSearch) {
    return (
      <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col">
        {/* Header with tabs */}
        <div className="px-5 pt-safe-6 pb-0 border-b border-[var(--border-tertiary)] shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setShowLocationSearch(false)}
              className="w-9 h-9 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center active:scale-95">
              <ArrowLeft01Icon className="w-5 h-5 text-[var(--color-icon-primary)]" strokeWidth={2} />
            </button>
            <div className="flex-1 relative">
              <Search01Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-icon-muted)]" />
                <input
                  autoFocus
                  value={locationQuery}
                  onChange={e => handleLocationSearch(e.target.value)}
                  placeholder="Rechercher un lieu..."
                  className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-default)] rounded-full text-[14px] focus:outline-none focus:border-[var(--brand-orange-500)]"
                />
            </div>
          </div>
          {/* Tabs */}
          <div className="flex">
            {(['liste','carte'] as const).map(tab => (
              <button key={tab} onClick={() => setLocationTab(tab)}
                className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${locationTab === tab ? 'border-[var(--color-action-primary)] text-[var(--color-text-brand-primary)]' : 'border-transparent text-[var(--color-text-secondary)]'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {locationTab === 'liste' ? (
          <div className="flex-1 overflow-y-auto">
            {locationSuggestions.map((s, i) => (
              <button key={i} onClick={() => selectLocation(s)}
                className="w-full flex items-start gap-3 px-5 py-4 border-b border-[var(--border-tertiary)] last:border-0 hover:bg-gray-50 text-left active:bg-orange-50 transition-colors">
                <div className="w-9 h-9 rounded-full bg-[var(--brand-orange-100)] flex items-center justify-center shrink-0 mt-0.5">
                  <HugeMapPin className="w-4 h-4 text-[var(--brand-orange-500)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{s.label.split(',')[0]}</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)] truncate">{s.label.split(',').slice(1).join(',').trim()}</p>
                </div>
              </button>
            ))}
            {locationSuggestions.length === 0 && locationQuery.length >= 2 && (
              <div className="flex flex-col items-center justify-center pt-16">
                <HugeMapPin className="w-12 h-12 text-[var(--color-icon-muted)] mb-3" strokeWidth={1.5} />
                <p className="text-[14px] text-[var(--color-text-secondary)]">Aucun lieu trouvé</p>
              </div>
            )}
            {/* Confirm from map button */}
            <div className="px-5 py-4 border-t border-[var(--border-tertiary)] mt-4">
              <button onClick={() => { setLocationTab('carte') }}
                className="w-full py-3.5 rounded-full border border-[var(--border-default)] text-[var(--color-text-primary)] font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                <HugeMapPin className="w-4 h-4 text-[var(--brand-orange-500)]" />
                Sélectionner sur la carte
              </button>
            </div>
          </div>
        ) : (
          // MAP tab
          <div className="flex-1 relative">
            <MapContainer
              center={[6.36536, 2.41833]} zoom={14}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapInteractionHandler onMapClick={coords => { setTempLat(coords.lat); setTempLon(coords.lng) }} />
              <Marker position={[tempLat, tempLon]} draggable={true}
                eventHandlers={{ dragend: e => { const p = e.target.getLatLng(); setTempLat(p.lat); setTempLon(p.lng) } }} />
            </MapContainer>
            <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-background-primary)] border-t border-[var(--border-tertiary)] px-5 pt-4 pb-8 z-[110]">
              <button onClick={confirmMapLocation} disabled={isReverseGeocoding}
                className="w-full py-4 rounded-full bg-[var(--color-action-primary)] font-bold text-[15px] text-[var(--color-text-inverse)] flex items-center justify-center gap-2 active:scale-95 transition-all">
                {isReverseGeocoding ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <CheckmarkCircle02Icon className="w-5 h-5" />}
                {isReverseGeocoding ? "Traduction de l'adresse..." : 'Confirmer la sélection'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER — MAIN FORM
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-safe-6 pb-4 bg-[var(--color-background-primary)] shrink-0">
        <div className="flex items-center justify-center relative">
          <button
            onClick={() => formStep === 2 ? setFormStep(1) : onBack()}
            className="absolute left-0 w-8 h-8 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center active:scale-95 transition-transform"
          >
            <Cancel01Icon className="w-4 h-4 text-[var(--color-icon-primary)]" />
          </button>
          <span className="text-[15px] font-bold text-[var(--color-text-primary)]">Créer un événement</span>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="mx-5 h-[2px] bg-[var(--brand-orange-200)] rounded-full overflow-hidden shrink-0">
        <div className="h-full bg-[var(--brand-orange-500)] rounded-full transition-all duration-300"
          style={{ width: formStep === 1 ? '50%' : '100%' }} />
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto pb-36">

        {/* ── Cover photo ─────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-6">
          <div className="relative w-full h-[200px] bg-[var(--color-background-secondary)] rounded-[16px] overflow-hidden">
            {coverPreview ? (
              <>
                <SafeImage src={coverPreview} alt="Couverture" className="absolute inset-0 w-full h-full object-cover" />
                <button
                  onClick={e => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null) }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                  <Cancel01Icon className="w-4 h-4 text-[var(--color-icon-danger)]" />
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <ImageAdd01Icon className="w-8 h-8 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              </div>
            )}
          {/* Galerie / Importer buttons — bottom-right, stacked vertically */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-between gap-3 bg-white/95 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-text-primary)] shadow-sm active:scale-95 transition-transform min-w-[110px]">
                Gallerie
                <Image01Icon className="w-[18px] h-[18px] text-[var(--color-text-primary)]" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-between gap-3 bg-white/95 rounded-[10px] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-text-primary)] shadow-sm active:scale-95 transition-transform min-w-[110px]">
                Importer
                <Upload04Icon className="w-[18px] h-[18px] text-[var(--color-text-primary)]" strokeWidth={1.5} />
              </button>
            </div>
            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleCover} />
          </div>
        </div>

        {/* ── Organizer row ────────────────────────────────────────────── */}
        <div className="px-5 pb-6">
          {/* Main organizer */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
              {me?.profile?.avatarUrl ? (
                <SafeImage src={me.profile.avatarUrl} alt={me.profile.displayName || 'Vous'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[var(--brand-orange-500)] flex items-center justify-center text-[var(--color-text-inverse)] font-bold text-[16px]">
                  {me?.profile?.displayName?.charAt(0)?.toUpperCase() || 'M'}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[var(--color-text-primary)] truncate">{me?.profile?.displayName || 'Vous'}</p>
              <p className="text-[12px] text-[var(--color-text-secondary)]">Organisateur de l'événement</p>
            </div>
          </div>
          {/* Co-organisateurs */}
          {selectedCoOrgs.map(org => (
            <div key={org.id} className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                <SafeImage src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover"
                  fallback={<div className="w-full h-full bg-[var(--functional-green-500)] flex items-center justify-center text-[var(--color-text-inverse)] font-bold text-[15px]">{org.name.charAt(0)}</div>} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-[var(--color-text-primary)] truncate">{org.name}</p>
                <p className="text-[12px] text-[var(--color-text-secondary)]">Co-organisateur</p>
              </div>
              <button onClick={() => setSelectedCoOrgs(p => p.filter(o => o.id !== org.id))}
                className="w-7 h-7 rounded-full bg-[var(--functional-red-50)] flex items-center justify-center active:scale-95">
                <Cancel01Icon className="w-4 h-4 text-[var(--color-icon-danger)]" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          {/* Add organizer button */}
          <button
            onClick={() => setShowOrganizerSearch(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-background-alt)] border border-[var(--border-default)] rounded-full text-[13px] font-medium text-[var(--color-text-secondary)] active:opacity-70 transition-opacity self-start mt-2">
            <UserIcon className="w-4 h-4 text-[var(--brand-orange-400)]" fill="currentColor" strokeWidth={1.5} />
            Ajouter un organisateur
          </button>
        </div>

        {/* ── Form fields ──────────────────────────────────────────────── */}
        <div className="px-5">

          {formStep === 1 && (
            <div className="animate-in slide-in-from-right-2">
              {/* Nom */}
              <InputField
                label="Nom"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Nom de l'événement..."
              />

              {/* Date et heure de début */}
              <InputField
                label="Date et heure de début"
                value={startDateLabel ?? undefined}
                placeholder="Sélectionnez une date et heure"
                readOnly
                onClick={() => { setTempStartDate(startDate); setTempStartTime(startTime || '10:00'); setShowStartDateSheet(true) }}
              />

              {/* Ajouter une heure de fin */}
              <div className="mb-4">
                {!hasEndDate ? (
                  <button
                    onClick={() => { setHasEndDate(true); setTempEndDate(endDate || startDate); setTempEndTime(endTime || '12:00'); setShowEndDateSheet(true) }}
                    className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-text-primary)] active:opacity-70 transition-opacity"
                  >
                    <Clock04Icon className="w-4 h-4 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
                    Ajouter une heure de fin
                  </button>
                ) : (
                  <div>
                    <InputField
                      label="Date et heure de fin"
                      value={endDateLabel ?? undefined}
                      placeholder="Sélectionnez une date et heure"
                      readOnly
                      onClick={() => { setTempEndDate(endDate || startDate); setTempEndTime(endTime || '12:00'); setShowEndDateSheet(true) }}
                      rightIcons={endDate ? (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setTempEndDate(endDate || startDate); setTempEndTime(endTime || '12:00'); setShowEndDateSheet(true) }} className="p-1 active:scale-90"><PencilEdit01Icon className="w-5 h-5 text-[var(--color-text-secondary)]" strokeWidth={1.5} /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEndDate(''); setEndTime(''); setHasEndDate(false) }} className="p-1 active:scale-90"><Delete01Icon className="w-5 h-5 text-[var(--color-text-secondary)]" strokeWidth={1.5} /></button>
                        </>
                      ) : null}
                    />
                    {endDate && endTime && (
                      <div className="flex items-center gap-1.5 mt-[-6px] mb-4">
                        <Clock04Icon className="w-3.5 h-3.5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
                        <span className="text-[12px] text-[var(--color-text-muted)]">Heure de fin ajoutée</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Lieu de l'événement */}
              <InputField
                label="Lieu de l'événement"
                value={address || city || undefined}
                placeholder="Où aura lieu l'événement ?"
                readOnly
                onClick={() => setShowLocationSearch(true)}
              />

              {/* Confidentialité */}
              <InputField
                label="Confidentialité"
                value={privacyLabel ?? undefined}
                placeholder="Qui peut le voir ?"
                readOnly
                onClick={() => setShowPrivacySheet(true)}
              />

              {/* Dynamic fields */}
              {privacy && (
                <div className="animate-in slide-in-from-top-2">
                  <div className="mb-4">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Détails</p>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Quels sont les détails ?"
                      rows={4}
                      className="w-full px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--brand-orange-500)] bg-[var(--color-background-primary)] resize-none"
                    />
                  </div>

                  <InputField
                    label="Catégorie"
                    value={catLabel ? catLabel.label : undefined}
                    placeholder="Facultatif"
                    readOnly
                    onClick={() => setShowCategorySheet(true)}
                  />
                </div>
              )}
            </div>
          )}

          {formStep === 2 && (
            <div className="animate-in slide-in-from-right-2">
              <div className="mb-4">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Participants attendus</p>
                <input
                  value={maxPlaces}
                  onChange={e => setMaxPlaces(e.target.value)}
                  type="number"
                  min={1}
                  placeholder="0"
                  className="w-full px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--brand-orange-500)] bg-[var(--color-background-primary)]"
                />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 ml-1">Facultatif</p>
              </div>

              <InputField
                label="Participation"
                value={participationLabel ?? undefined}
                placeholder="Comment participer ?"
                readOnly
                onClick={() => setShowParticipationSheet(true)}
              />

              {/* Cagnotte inline fields — matches Figma maquette */}
              {participationMode === 'cagnotte' && (
                <div className="animate-in slide-in-from-top-2 space-y-0">

                  {/* Montant cible */}
                  <div className="mb-4">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Montant cible</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={1} value={poolTarget}
                        onChange={e => setPoolTarget(e.target.value)}
                        placeholder="0"
                        className="flex-1 px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--brand-orange-500)] bg-[var(--color-background-primary)]"
                      />
                      <div className="px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-background-secondary)] shrink-0">F CFA</div>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 ml-1">Montant estimé des dépenses</p>
                  </div>

                  {/* Détails */}
                  <div className="mb-4">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Détails</p>
                    <textarea
                      value={poolDescription}
                      onChange={e => setPoolDescription(e.target.value)}
                      placeholder="Quels sont les détails des dépenses prévues ?"
                      rows={4}
                      className="w-full px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--brand-orange-500)] bg-[var(--color-background-primary)] resize-none"
                    />
                  </div>

                  {/* Participation minimale */}
                  <div className="mb-2">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5">Participation minimale</p>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number" min={1} value={poolMinAmount}
                        onChange={e => setPoolMinAmount(e.target.value)}
                        placeholder="0"
                        className="flex-1 px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--brand-orange-500)] bg-[var(--color-background-primary)]"
                      />
                      <div className="px-4 py-3.5 border border-[var(--border-default)] rounded-[12px] text-[15px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-background-secondary)] shrink-0">F CFA</div>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 ml-1">Facultatif</p>
                  </div>

                </div>
              )}

              <div className="mt-4 mb-4">
                {!regEndDate ? (
                  <div>
                    <button
                      onClick={() => { setTempRegEndDate(regEndDate || startDate); setTempRegEndTime(regEndTime || '12:00'); setShowRegEndDateSheet(true) }}
                      className="flex items-center gap-2 px-4 py-[10px] bg-[var(--color-background-secondary)] rounded-full text-[13px] font-medium text-[var(--color-text-secondary)] active:opacity-70 transition-opacity"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="4" width="12" height="10" rx="2" fill="var(--border-tertiary)" />
                        <path d="M2 6C2 4.89543 2.89543 4 4 4H12C13.1046 4 14 4.89543 14 6V6.5H2V6Z" fill="var(--functional-red-500)" />
                        <path d="M4.5 3V5M11.5 3V5" stroke="var(--color-text-secondary)" strokeLinecap="round" />
                      </svg>
                      Ajouter une date limite d'inscription
                    </button>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 ml-1">Facultatif</p>
                  </div>
                ) : (
                  <InputField
                    label="Date limite d'inscription"
                    value={`${formatDateFr(regEndDate)} à ${regEndTime.replace(':', 'h')}`}
                    placeholder="Facultatif"
                    readOnly
                    onClick={() => { setTempRegEndDate(regEndDate || startDate); setTempRegEndTime(regEndTime || '12:00'); setShowRegEndDateSheet(true) }}
                  />
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 bg-[var(--color-background-primary)] border-t border-[var(--border-tertiary)] px-5 py-4">
        {formStep === 1 ? (
          <button
            onClick={() => { if (canGoToStep2) setFormStep(2) }}
            disabled={!canGoToStep2}
            className={`w-full py-[15px] rounded-[100px] font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${!canGoToStep2 ? 'bg-[var(--brand-orange-100)] text-[var(--brand-orange-400)]' : 'bg-[var(--color-action-primary)] text-[var(--color-text-inverse)]'}`}
          >
            Suivant
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !canSubmit}
            className={`w-full py-[15px] rounded-[100px] font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${loading || !canSubmit ? 'bg-[var(--brand-orange-100)] text-[var(--brand-orange-400)]' : 'bg-[var(--color-action-primary)] text-[var(--color-text-inverse)]'}`}
          >
            {loading ? <div className="w-5 h-5 border-2 border-[var(--brand-orange-400)] border-t-transparent rounded-full animate-spin" /> : null}
            {loading ? "Création..." : "Créer l'événement"}
          </button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BOTTOM SHEETS                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* ── Start Date Sheet ─────────────────────────────────────────────── */}
      <BottomSheet title="Date et heure de début" open={showStartDateSheet} onClose={() => setShowStartDateSheet(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Date de début</label>
            <div className="relative">
              <HugeCalendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              <input
                type="date"
                value={tempStartDate}
                onChange={e => setTempStartDate(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[var(--border-default)] rounded-2xl text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
            {tempStartDate && (
              <p className="text-[13px] text-[var(--color-text-secondary)] mt-1.5 pl-1">{formatDateFr(tempStartDate)}</p>
            )}
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Heure de début</label>
            <div className="relative">
              <HugeClock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              <input
                type="time"
                value={tempStartTime}
                onChange={e => setTempStartTime(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[var(--border-default)] rounded-2xl text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
          </div>
          <button
            onClick={() => { setStartDate(tempStartDate); setStartTime(tempStartTime); setShowStartDateSheet(false) }}
            disabled={!tempStartDate || !tempStartTime}
            className="w-full py-4 rounded-full bg-[var(--color-action-primary)] font-bold text-[15px] text-[var(--color-text-inverse)] active:scale-[0.98] disabled:opacity-50 transition-all mt-2">
            Terminé
          </button>
        </div>
      </BottomSheet>

      {/* ── End Date Sheet ───────────────────────────────────────────────── */}
      <BottomSheet title="Date et heure de fin" open={showEndDateSheet} onClose={() => setShowEndDateSheet(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Date de fin</label>
            <div className="relative">
              <HugeCalendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              <input
                type="date"
                value={tempEndDate}
                min={startDate}
                onChange={e => setTempEndDate(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[var(--border-default)] rounded-2xl text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
            {tempEndDate && (
              <p className="text-[13px] text-[var(--color-text-secondary)] mt-1.5 pl-1">{formatDateFr(tempEndDate)}</p>
            )}
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Heure de fin</label>
            <div className="relative">
              <HugeClock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              <input
                type="time"
                value={tempEndTime}
                onChange={e => setTempEndTime(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[var(--border-default)] rounded-2xl text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
          </div>
          <button
            onClick={() => { setEndDate(tempEndDate); setEndTime(tempEndTime); setShowEndDateSheet(false) }}
            disabled={!tempEndDate || !tempEndTime}
            className="w-full py-4 rounded-full bg-[var(--color-action-primary)] font-bold text-[15px] text-[var(--color-text-inverse)] active:scale-[0.98] disabled:opacity-50 transition-all mt-2">
            Terminé
          </button>
        </div>
      </BottomSheet>

      {/* ── Registration End Date Sheet ───────────────────────────────────── */}
      <BottomSheet title="Date limite d'inscription" open={showRegEndDateSheet} onClose={() => setShowRegEndDateSheet(false)}>
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Date limite</label>
            <div className="relative">
              <HugeCalendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              <input
                type="date"
                value={tempRegEndDate}
                onChange={e => setTempRegEndDate(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[var(--border-default)] rounded-2xl text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
            {tempRegEndDate && (
              <p className="text-[13px] text-[var(--color-text-secondary)] mt-1.5 pl-1">{formatDateFr(tempRegEndDate)}</p>
            )}
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Heure limite</label>
            <div className="relative">
              <HugeClock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-icon-muted)]" strokeWidth={1.5} />
              <input
                type="time"
                value={tempRegEndTime}
                onChange={e => setTempRegEndTime(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-[var(--border-default)] rounded-2xl text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[var(--brand-orange-500)]"
              />
            </div>
          </div>
        </div>
        <button
          onClick={() => { setRegEndDate(tempRegEndDate); setRegEndTime(tempRegEndTime); setShowRegEndDateSheet(false) }}
          disabled={!tempRegEndDate || !tempRegEndTime}
          className="w-full py-4 rounded-full bg-[var(--color-action-primary)] font-bold text-[15px] text-[var(--color-text-inverse)] active:scale-[0.98] disabled:opacity-50 transition-all mt-4"
        >
          Confirmer
        </button>
      </BottomSheet>
      <BottomSheet title="Confidentialité de l'événement" open={showPrivacySheet} onClose={() => setShowPrivacySheet(false)}>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 leading-[1.6]">
          Choisissez qui peut voir cet événement et y participer.<br />Vous pourrez envoyer des invitations plus tard.
        </p>
        <div className="flex flex-col">
          {[
            { value: 'PUBLIC' as const, label: 'Public', desc: `Tout le monde sur ou en dehors de Let's Out`, Icon: EarthIcon },
            { value: 'PRIVATE' as const, label: 'Privé', desc: 'Uniquement les personnes invités', Icon: LockKeyIcon },
          ].map(opt => (
            <div key={opt.value} className="flex flex-col w-full py-4 border-b border-[var(--border-tertiary)] last:border-0">
              <button
                onClick={() => { setPrivacy(opt.value); if (opt.value === 'PUBLIC') setAllowGuestInvites(false); setShowPrivacySheet(false) }}
                className="w-full flex items-center gap-4 text-left"
              >
                {/* Grey circle icon */}
                <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center shrink-0">
                  <opt.Icon className="w-5 h-5 text-[var(--color-text-secondary)]" strokeWidth={1.5} />
                </div>
                {/* Text */}
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-[var(--color-text-primary)]">{opt.label}</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{opt.desc}</p>
                </div>
                {/* Radio */}
                <div className={`w-[20px] h-[20px] rounded-full border-[2px] flex items-center justify-center shrink-0 transition-colors ${privacy === opt.value ? 'border-[var(--brand-orange-500)]' : 'border-[var(--border-default)]'}`}>
                  {privacy === opt.value && <div className="w-[10px] h-[10px] rounded-full bg-[var(--brand-orange-500)]" />}
                </div>
              </button>
              
              {/* Toggle switch for PRIVATE */}
              {opt.value === 'PRIVATE' && privacy === 'PRIVATE' && (
                <div className="flex items-center justify-between mt-3 pt-1 ml-[56px]">
                  <span className="text-[12px] text-[var(--color-text-secondary)] mr-4 leading-tight">Autoriser les participants à inviter d'autres participants</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setAllowGuestInvites(!allowGuestInvites); }}
                    className={`w-9 h-5 rounded-full flex items-center px-[2px] transition-colors shrink-0 ${allowGuestInvites ? 'bg-[var(--brand-orange-500)]' : 'bg-[var(--color-action-secondary)]'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-[var(--color-background-primary)] shadow-sm transition-transform ${allowGuestInvites ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* ── Category Sheet ───────────────────────────────────────────────── */}
      <BottomSheet title="Sélectionner une catégorie" open={showCategorySheet} onClose={() => setShowCategorySheet(false)}>
        <div className="divide-y divide-[var(--border-tertiary)]">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setShowCategorySheet(false) }}
              className="w-full flex items-center gap-4 py-[13px] text-left active:bg-[var(--color-background-secondary)] transition-colors"
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center shrink-0">
                <cat.Icon className="w-[18px] h-[18px] text-[var(--color-icon-secondary)]" strokeWidth={1.5} />
              </div>
              {/* Label */}
              <span className="flex-1 text-[15px] font-medium text-[var(--color-text-primary)] text-left">{cat.label}</span>
              {/* Radio */}
              <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                category === cat.value ? 'border-[var(--brand-orange-500)]' : 'border-[var(--border-default)]'
              }`}>
                {category === cat.value && <div className="w-[11px] h-[11px] rounded-full bg-[var(--brand-orange-500)]" />}
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet title="Mode de participation" open={showParticipationSheet} onClose={() => setShowParticipationSheet(false)}>
        <p className="text-[13px] text-[var(--color-text-secondary)] mb-5">Comment participer à cet événement.</p>
        <div className="flex flex-col">
          {[
            { value: 'free', label: 'Gratuitement', desc: 'Entrée ouverte à tous sans paiement', Icon: LockIcon },
            { value: 'cagnotte', label: 'Sur cagnotte', desc: 'Créez une cagnotte pour partager les frais', Icon: Coins02Icon },
          ].map(mode => {
            const isCagnotte = mode.value === 'cagnotte'
            const accentColor = isCagnotte ? 'var(--brand-blue-500)' : 'var(--brand-orange-500)'
            const isSelected = participationMode === mode.value
            return (
              <button
                key={mode.value}
                onClick={() => {
                  setParticipationMode(mode.value);
                  setShowParticipationSheet(false);
                  setEnablePool(mode.value === 'cagnotte');
                }}
                className={`w-full flex items-center gap-4 py-4 text-left`}
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center shrink-0">
                  <mode.Icon className="w-5 h-5 text-[var(--color-text-secondary)]" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{mode.label}</p>
                  <p className="text-[12px] text-[var(--color-text-secondary)]">{mode.desc}</p>
                </div>
                <div
                  className="w-[20px] h-[20px] rounded-full border-[2px] flex items-center justify-center shrink-0 transition-colors"
                  style={{ borderColor: isSelected ? accentColor : 'var(--border-default)' }}
                >
                  {isSelected && <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: accentColor }} />}
                </div>
              </button>
            )
          })}
        </div>
      </BottomSheet>

    </div>
  )
}

// -- Map helper ----------------------------------------------------------------
function MapInteractionHandler({ onMapClick }: { onMapClick: (coords: {lat: number, lng: number}) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng) } })
  return null
}


