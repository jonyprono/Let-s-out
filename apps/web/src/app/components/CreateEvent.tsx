import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { ChevronLeft, Calendar, Clock, MapPin, Search, X, Loader2, Image as ImageIcon, Navigation, Map as MapIcon, Check, Edit3, BadgeCheck } from 'lucide-react'
import { CagnotteAddIcon, PublishEventIcon } from '@/components/shared/icons/EventActionIcons'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { SafeImage } from '@/components/shared/SafeImage'
import { CategoryChip } from '@/components/shared/CategoryChip'
import { toast } from 'sonner'
import { searchPlaces, searchCities, reverseGeocode, getCurrentPosition } from '@/lib/geo'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

// Fix default Leaflet icon path issues
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'


interface CreateEventProps { onBack: () => void }

const CATEGORIES = [
  { label: 'Social', value: 'SOCIAL' },
  { label: 'Art & Culture', value: 'CULTURE' },
  { label: 'Bien-être & Santé', value: 'WELLNESS' },
  { label: 'Technologie', value: 'TECH' },
  { label: 'Science & Education', value: 'SCIENCE' },
  { label: 'Voyages', value: 'TRAVEL' },
  { label: 'Lifestyle', value: 'LIFESTYLE' },
  { label: 'Tourisme', value: 'TOURISM' },
]

const TOTAL_STEPS = 6

export function CreateEvent({ onBack }: CreateEventProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const me = useAuthStore((state: any) => state.user)
  const initialStep: number = Number(location.state?.step) || 1
  const [step, setStep] = useState<number>(initialStep)

  // Step 1
  const [title, setTitle] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  // Step 2 — Date & lieu
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [citySuggestions, setCitySuggestions] = useState<{label:string;lat:number|string;lon:number|string}[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [lat, setLat] = useState<number|null>(null)
  const [lon, setLon] = useState<number|null>(null)
  
  // Map Modal State
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapCenter, setMapCenter] = useState<[number, number]>([6.36536, 2.41833]) // Default to Cotonou
  const [tempLat, setTempLat] = useState<number>(6.36536)
  const [tempLon, setTempLon] = useState<number>(2.41833)
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false)
  
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [mapSearchSuggestions, setMapSearchSuggestions] = useState<{label:string;lat:number;lon:number}[]>([])

  // Step 3
  const [maxPlaces, setMaxPlaces] = useState('')
  const [amount, setAmount] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [enablePool, setEnablePool] = useState(false)
  const [poolTarget, setPoolTarget] = useState('')
  // Cagnotte modal
  const [showPoolModal, setShowPoolModal] = useState(false)
  const [poolStep, setPoolStep] = useState(1) // 1=but, 2=objectif, 3=participation, 4=mode
  const [poolDescription, setPoolDescription] = useState('')
  const [poolDeadline, setPoolDeadline] = useState('')
  const [poolMode, setPoolMode] = useState<'libre' | 'minimum' | 'fixe'>('libre')
  const [poolMinAmount, setPoolMinAmount] = useState('')

  // Step 4
  const [description, setDescription] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Step 5
  const [coOrgSearch, setCoOrgSearch] = useState('')
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [selectedCoOrgs, setSelectedCoOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [createdEventId, setCreatedEventId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  // Friends search
  const { data: friendsData } = useQuery({
    queryKey: ['friends-search', coOrgSearch],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/friends', { params: { search: coOrgSearch || undefined, limit: 20 } })
      return res.data
    },
    enabled: showSearchModal,
    staleTime: 30000,
  })
  const friends: any[] = Array.isArray(friendsData) ? friendsData : (friendsData?.data ?? [])

  // Pre-fill from navigation state (coming from ManageEventView) or restore from localStorage
  useEffect(() => {
    const eventData = location.state?.eventData
    const editEventId = location.state?.editEventId

    if (eventData && editEventId) {
      // Pre-fill from real event data (editing a draft)
      if (eventData.title) setTitle(eventData.title)
      if (eventData.category) setCategories([eventData.category])
      if (eventData.startAt) {
        const d = new Date(eventData.startAt)
        setDate(d.toISOString().split('T')[0])
        setStartTime(d.toISOString().split('T')[1].slice(0, 5))
      }
      if (eventData.endAt) {
        const d = new Date(eventData.endAt)
        setEndTime(d.toISOString().split('T')[1].slice(0, 5))
      }
      if (eventData.city) { setCity(eventData.city); setCityInput(eventData.city) }
      if (eventData.address) setAddress(eventData.address)
      if (eventData.latitude) setLat(eventData.latitude)
      if (eventData.longitude) setLon(eventData.longitude)
      if (eventData.maxAttendees) setMaxPlaces(String(eventData.maxAttendees))
      if (eventData.price !== undefined) setAmount(String(eventData.price))
      if (eventData.isPrivate !== undefined) setIsPrivate(eventData.isPrivate)
      if (eventData.description) setDescription(eventData.description)
      if (eventData.coverUrl) setCoverPreview(eventData.coverUrl)
    } else {
      // Fall back to localStorage draft
      const draftStr = localStorage.getItem('create_event_draft')
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr)
          if (draft.title) setTitle(draft.title)
          if (draft.categories) setCategories(draft.categories)
          if (draft.date) setDate(draft.date)
          if (draft.startTime) setStartTime(draft.startTime)
          if (draft.endTime) setEndTime(draft.endTime)
          if (draft.city) { setCity(draft.city); setCityInput(draft.city) }
          if (draft.address) setAddress(draft.address)
          if (draft.lat) setLat(draft.lat)
          if (draft.lon) setLon(draft.lon)
          if (draft.maxPlaces) setMaxPlaces(draft.maxPlaces)
          if (draft.amount) setAmount(draft.amount)
          if (draft.isPrivate !== undefined) setIsPrivate(draft.isPrivate)
          if (draft.enablePool !== undefined) setEnablePool(draft.enablePool)
          if (draft.poolTarget) setPoolTarget(draft.poolTarget)
          if (draft.description) setDescription(draft.description)
          toast.success('Brouillon local restauré')
        } catch (e) {
          console.error('Failed to parse local draft', e)
        }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft on change
  useEffect(() => {
    // Only save if at least title or category is started to avoid saving pure empty state
    // Do not save if we are on step 6 or 7 (preview or done)
    if (step < 6 && (title || categories.length > 0 || city)) {
      const draft = { step, title, categories, date, startTime, endTime, city, address, lat, lon, maxPlaces, amount, isPrivate, enablePool, poolTarget, description }
      localStorage.setItem('create_event_draft', JSON.stringify(draft))
    }
  }, [step, title, categories, date, startTime, endTime, city, address, lat, lon, maxPlaces, amount, isPrivate, description])

  const toggleCategory = (val: string) =>
    setCategories(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val])

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setCoverFile(f); setCoverPreview(URL.createObjectURL(f))
  }

  // Géolocalisation GPS native (Capacitor) — via geo.ts (double fallback)
  const handleGeolocate = async () => {
    setGeoLoading(true)
    try {
      const pos = await getCurrentPosition()
      const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
      setCity(result.city)
      setAddress(result.address)
      if (result.city) setCityInput(result.city)
      setLat(result.lat)
      setLon(result.lon)
      setCitySuggestions([])
      setMapCenter([pos.coords.latitude, pos.coords.longitude])
      toast.success('Position trouvée !')
    } catch (e: any) {
      console.error('[GPS]', e)
      if (e?.message === 'PERMISSION_DENIED') {
        toast.error('Permission GPS refusée. Autorisez l\'accès à la localisation dans vos paramètres.')
      } else {
        toast.error('Impossible de récupérer votre position. Vérifiez que le GPS est activé.')
      }
    } finally {
      setGeoLoading(false)
    }
  }

  // Handle map interaction
  const openMap = () => {
    if (lat && lon) {
      setMapCenter([lat, lon])
      setTempLat(lat)
      setTempLon(lon)
    } else {
      setTempLat(mapCenter[0])
      setTempLon(mapCenter[1])
    }
    setMapSearchQuery('')
    setMapSearchSuggestions([])
    setShowMapModal(true)
  }

  const handleMapSearch = async (q: string) => {
    setMapSearchQuery(q)
    if (q.length < 2) { setMapSearchSuggestions([]); return }
    try {
      const results = await searchPlaces(q, city)
      setMapSearchSuggestions(results)
    } catch { setMapSearchSuggestions([]) }
  }

  const selectMapSuggestion = (s: {label:string; lat:number; lon:number}) => {
    setMapCenter([s.lat, s.lon])
    setTempLat(s.lat)
    setTempLon(s.lon)
    setMapSearchQuery('')
    setMapSearchSuggestions([])
  }

  const confirmMapLocation = async () => {
    setIsReverseGeocoding(true)
    // reverseGeocode from geo.ts never throws — has full fallback
    const result = await reverseGeocode(tempLat, tempLon)
    setCity(result.city)
    setAddress(result.address)
    if (result.city) setCityInput(result.city)
    setLat(result.lat)
    setLon(result.lon)
    setMapCenter([tempLat, tempLon])
    setShowMapModal(false)
    setIsReverseGeocoding(false)
    toast.success('Emplacement validé !')
  }

  // Recherche ville
  const cityTimeoutRef = useRef<number | null>(null)
  const handleCitySearch = (q: string) => {
    setCityInput(q)
    if (q.length < 2) { setCitySuggestions([]); return }
    if (cityTimeoutRef.current) window.clearTimeout(cityTimeoutRef.current)
    cityTimeoutRef.current = window.setTimeout(async () => {
      try {
        const results = await searchCities(q)
        setCitySuggestions(results)
      } catch { setCitySuggestions([]) }
    }, 400)
  }

  const selectCity = (s: { label: string; lat: number|string; lon: number|string }) => {
    const parts = s.label.split(',')
    setCity(parts[0].trim())
    setAddress(s.label)
    setCityInput(parts[0].trim())
    setLat(parseFloat(String(s.lat)))
    setLon(parseFloat(String(s.lon)))
    setCitySuggestions([])
  }

  const canNext = () => {
    if (step === 1) return title.trim().length >= 2 && categories.length > 0
    if (step === 2) return !!date && !!startTime && !!endTime && !!city
    if (step === 3) return !!maxPlaces
    if (step === 4) return description.trim().length >= 10
    return true
  }

  const handleSubmit = async () => {
    setLoading(true)
    const editEventId = location.state?.editEventId || createdEventId
    try {
      let coverUrl: string | undefined
      if (coverFile) {
        const fd = new FormData(); fd.append('file', coverFile)
        const { data } = await apiClient.post('/chat/upload', fd)
        coverUrl = data.url
      } else if (coverPreview) {
        coverUrl = coverPreview
      }
      const startAt = new Date(`${date}T${startTime}`).toISOString()
      const endAt = new Date(`${date}T${endTime}`).toISOString()

      const payload = {
        title: title.trim(), description: description.trim(),
        category: categories[0], startAt, endAt,
        city: city.trim(), address: address.trim() || undefined,
        country: 'Bénin',
        latitude: lat ?? undefined,
        longitude: lon ?? undefined,
        maxAttendees: maxPlaces ? parseInt(maxPlaces) : undefined,
        price: amount ? parseFloat(amount) : 0, currency: 'XOF',
        isPrivate, coverUrl,
        poolTarget: enablePool && poolTarget ? parseFloat(poolTarget) : undefined,
        poolMode: enablePool && poolTarget ? poolMode : undefined,
        poolMinAmount: enablePool && poolMinAmount ? parseFloat(poolMinAmount) : undefined,
        status: 'DRAFT',
        coHostIds: selectedCoOrgs.map(o => o.id)
      }

      let res
      if (editEventId) {
        res = await apiClient.patch(`/events/${editEventId}`, payload)
      } else {
        res = await apiClient.post('/events', payload)
      }

      localStorage.removeItem('create_event_draft')
      const eventId = editEventId || res.data?.id
      setCreatedEventId(eventId)
      toast.success('Événement créé ! Publiez-le quand vous êtes prêt.')
      setStep(7)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la création")
    } finally { setLoading(false) }
  }

  const savePoolToEvent = async () => {
    const eventId = createdEventId || location.state?.editEventId
    if (!eventId || !enablePool || !poolTarget) return
    await apiClient.patch(`/events/${eventId}`, {
      poolTarget: parseFloat(poolTarget),
      poolMode,
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
      navigate(`/events/${eventId}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur lors de la publication')
    } finally {
      setPublishing(false)
    }
  }

  // ── Shared layout ──────────────────────────────────────────────────
  const stepTitles = ['Informations', 'Date & lieu', 'Participation', 'Présentation', 'Organisation']
  const stepSubs = [
    "Indiquez les informations essentielles de votre événement",
    "Indiquez quand et où l'événement aura lieu",
    "Définissez les modalités de participation",
    "Donnez envie de rejoindre votre événement",
    "Ajoutez les personnes qui co-organisent avec vous",
  ]

  const formattedDate = date
    ? format(new Date(date + 'T00:00:00'), 'dd MMMM yyyy', { locale: fr })
    : ''

  return (
    <div className="w-full h-full bg-background flex flex-col">

      {/* Header */}
      <div className="px-5 pt-safe-6 pb-0 bg-background">
        <div className="flex items-center justify-center relative mb-3">
          {step < 7 && (
            <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)}
              className="absolute left-0 w-8 h-8 flex items-center justify-center">
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </button>
          )}
          <span className="text-[15px] font-semibold text-gray-900">
            {step === 7 ? 'Détails événement' : 'Créer un événement'}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-[2px] bg-[#F5F5F5] overflow-hidden">
          <div className="h-full bg-[#FF9F1C] transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-32 bg-background">
        {step < 6 && (
          <>
            <h2 className="text-[22px] font-bold text-[#1A1A1A] mb-1.5">{stepTitles[step - 1]}</h2>
            <p className="text-[13px] text-[#888888] mb-7">{stepSubs[step - 1]}</p>
          </>
        )}

        {/* ── STEP 1: Informations ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="text-[13px] font-medium text-muted-foreground mb-2 block">Nom</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Nom de l'événement..."
                className="w-full px-4 py-3.5 border border-border rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-card text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-muted-foreground mb-3 block">Catégories</label>
              <div className="flex flex-wrap gap-2.5">
                {CATEGORIES.map(cat => (
                  <CategoryChip
                    key={cat.value}
                    label={cat.label}
                    selected={categories.includes(cat.value)}
                    onClick={() => toggleCategory(cat.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Date & lieu ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
                {date ? (
                  <div className="flex items-center w-full pl-12 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] bg-white">
                    <span className="flex-1 text-[#1A1A1A] font-medium">{formattedDate}</span>
                    <button onClick={() => setDate('')} className="w-6 h-6 rounded-full bg-[#F9F9F9] flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-[#888888]" />
                    </button>
                  </div>
                ) : (
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#BBBBBB] focus:outline-none focus:border-[#FF9F1C] bg-white"
                  />
                )}
              </div>
            </div>

            {/* Heure */}
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Heure</label>
              {startTime && endTime ? (
                <div className="flex items-center w-full pl-4 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] bg-white">
                  <Clock className="w-5 h-5 text-[#888888] mr-3" />
                  <span className="flex-1 text-[#1A1A1A] font-medium">{startTime} h – {endTime} h</span>
                  <button onClick={() => { setStartTime(''); setEndTime('') }} className="w-6 h-6 rounded-full bg-[#F9F9F9] flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-[#888888]" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A]"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C] bg-white text-[#1A1A1A]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Ville avec autocomplete Nominatim */}
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Ville</label>
              {city && !citySuggestions.length ? (
                <div className="flex items-center w-full pl-4 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] bg-white">
                  <MapPin className="w-5 h-5 text-[#888888] mr-3" />
                  <span className="flex-1 text-[#1A1A1A] font-medium">{city}</span>
                  <button onClick={() => { setCity(''); setCityInput('') }} className="w-6 h-6 rounded-full bg-[#F9F9F9] flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-[#888888]" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
                  <input value={cityInput} onChange={e => handleCitySearch(e.target.value)}
                    placeholder="Sélectionnez une ville"
                    className="w-full pl-12 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#1A1A1A] placeholder-[#BBBBBB] focus:outline-none focus:border-[#FF9F1C] bg-white"
                  />
                  {citySuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 bg-white border border-[#E5E5E5] rounded-xl mt-1 shadow-lg overflow-hidden">
                      {citySuggestions.map((s, i) => (
                        <button key={i} onClick={() => selectCity(s)}
                          className="w-full text-left px-4 py-3 text-[14px] text-[#1A1A1A] hover:bg-gray-50 border-b border-[#F5F5F5] last:border-0 flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-[#888888] flex-shrink-0" />
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Localisation / GPS */}
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Localisation</label>
              {address && !citySuggestions.length ? (
                <div className="flex items-center w-full pl-4 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] bg-white">
                  <MapPin className="w-5 h-5 text-[#888888] mr-3 flex-shrink-0" />
                  <span className="flex-1 text-[#1A1A1A] font-medium truncate">{address}</span>
                  <button onClick={() => setAddress('')} className="w-6 h-6 rounded-full bg-[#F9F9F9] flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-[#888888]" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
                  <input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Sélectionnez sur la carte"
                    className="w-full pl-12 pr-24 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#1A1A1A] placeholder-[#BBBBBB] focus:outline-none focus:border-[#FF9F1C] bg-white"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button onClick={handleGeolocate} disabled={geoLoading} title="Ma position"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F9F9F9] active:scale-95 transition-transform">
                      {geoLoading ? <Loader2 className="w-4 h-4 text-[#FF9F1C] animate-spin" /> : <Navigation className="w-4 h-4 text-[#555555]" />}
                    </button>
                    <button onClick={openMap} title="Ouvrir la carte"
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F9F9F9] active:scale-95 transition-transform">
                      <MapIcon className="w-4 h-4 text-[#555555]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: Participation ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Nombre de places</label>
              <input type="number" min={1} value={maxPlaces} onChange={e => setMaxPlaces(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#1A1A1A] placeholder-[#BBBBBB] focus:outline-none focus:border-[#FF9F1C] bg-white"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Montant de participation</label>
              <div className="flex gap-2 items-center">
                <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0 (gratuit)"
                  className="flex-1 px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#1A1A1A] placeholder-[#BBBBBB] focus:outline-none focus:border-[#FF9F1C] bg-white"
                />
                <div className="px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#555555] bg-white flex-shrink-0 flex items-center justify-center font-medium">
                  F CFA ▾
                </div>
              </div>
            </div>

            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-3 block mt-2">Confidentialité</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsPrivate(false)}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${!isPrivate ? 'border-[#FF9F1C]' : 'border-[#E5E5E5]'}`}>
                    {!isPrivate && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]" />}
                  </div>
                  <span className="text-[15px] text-[#1A1A1A]">Public</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer" onClick={() => setIsPrivate(true)}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isPrivate ? 'border-[#FF9F1C]' : 'border-[#E5E5E5]'}`}>
                    {isPrivate && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]" />}
                  </div>
                  <span className="text-[15px] text-[#1A1A1A]">Privé</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Présentation ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="À propos de votre événement..."
                rows={6}
                className="w-full px-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#1A1A1A] placeholder-[#BBBBBB] resize-none focus:outline-none focus:border-[#FF9F1C] bg-white"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#555555] mb-2 block">Couverture</label>
              <button onClick={() => fileRef.current?.click()}
                className="w-full h-40 border border-dashed border-[#E5E5E5] rounded-xl flex flex-col items-center justify-center gap-2 overflow-hidden relative bg-[#F9F9F9] active:scale-[0.99] transition-transform">
                {coverPreview ? (
                  <>
                    <SafeImage src={coverPreview} alt="Aperçu couverture" className="absolute inset-0 w-full h-full object-cover" />
                    <button onClick={e => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null) }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm">
                      <X className="w-4 h-4 text-[#FF4444]" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-[#E5E5E5] mb-1">
                      <ImageIcon className="w-5 h-5 text-[#888888]" />
                    </div>
                    <span className="text-[13px] font-medium text-[#555555]">Sélectionner une image</span>
                  </>
                )}
              </button>
              <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleCover} />
            </div>
          </div>
        )}

        {/* ── STEP 5: Organisation ── */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
              <button onClick={() => setShowSearchModal(true)}
                className="w-full text-left pl-12 pr-4 py-3.5 border border-[#E5E5E5] rounded-xl text-[15px] text-[#BBBBBB] bg-white focus:outline-none focus:border-[#FF9F1C]">
                Rechercher un ami
              </button>
            </div>

            {selectedCoOrgs.length > 0 && (
              <div className="space-y-3 mt-4">
                {selectedCoOrgs.map(org => (
                  <div key={org.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-[#E5E5E5]">
                        <SafeImage 
                          src={org.avatarUrl} 
                          alt={org.name} 
                          className="w-full h-full object-cover" 
                          fallback={
                            <div className="w-full h-full bg-[#FFD99A] flex items-center justify-center text-[#1A1A1A] font-bold text-[14px]">
                              {org.name.charAt(0).toUpperCase()}
                            </div>
                          }
                        />
                      </div>
                      <span className="text-[15px] font-medium text-[#1A1A1A]">{org.name}</span>
                    </div>
                    <button onClick={() => setSelectedCoOrgs(p => p.filter(o => o.id !== org.id))}
                      className="text-[13px] font-semibold text-[#FF4444] border border-[#FF4444]/20 bg-[#FF4444]/5 rounded-full px-4 py-1.5 active:scale-95 transition-transform">
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 6: Rendu après publication ── */}
        {step === 6 && (
          <div className="space-y-0">
            {/* Preview banner */}
            <div className="bg-[#FFF8ED] border border-[#FFE4B2] rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
              <span className="text-[#FF9F1C] text-xl">👁</span>
              <div>
                <p className="text-[13px] font-bold text-[#FF9F1C]">Rendu après publication</p>
                <p className="text-[11px] text-[#B87A00]">Voici comment votre événement apparaîtra publiquement.</p>
              </div>
            </div>

            {/* ── Cover image ── */}
            <div className="w-full h-52 bg-[#F0F0F0] rounded-[20px] overflow-hidden relative mb-5">
              {coverPreview ? (
                <SafeImage src={coverPreview} alt="Aperçu couverture" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="text-5xl">{categories[0] === 'SOCIAL' ? '✨' : categories[0] === 'CULTURE' ? '🎭' : categories[0] === 'WELLNESS' ? '🧘' : categories[0] === 'TECH' ? '💻' : categories[0] === 'SCIENCE' ? '🔬' : categories[0] === 'TRAVEL' ? '✈️' : categories[0] === 'LIFESTYLE' ? '🍹' : '🗺️'}</div>
                  <span className="text-[13px] text-[#AAAAAA] font-medium">Image de couverture</span>
                </div>
              )}
            </div>

            {/* ── Title + Categories ── */}
            <h2 className="text-[24px] font-bold text-[#1A1A1A] leading-tight mb-3">{title || 'Titre de l\'événement'}</h2>
            <div className="flex flex-wrap gap-2 mb-5">
              {categories.map(cat => (
                <span key={cat} className="text-[12px] font-bold text-[#FF9F1C] bg-[#FFF0D9] px-3 py-1 rounded-full border border-[#FFD99A]">
                  {CATEGORIES.find(c => c.value === cat)?.label}
                </span>
              ))}
            </div>

            {/* ── Location + Date ── */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#FFF8F1] flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-[#FF9F1C]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] text-[14px]">{city || 'Ville non précisée'}</p>
                  <p className="text-[13px] text-gray-500">{address || 'Lieu non précisé'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#FFF8F1] flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4 text-[#FF9F1C]" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] text-[14px] capitalize">{formattedDate || 'Date non précisée'}</p>
                  <p className="text-[13px] text-gray-500">{startTime ? `${startTime} h – ${endTime} h (GMT)` : '--:--'}</p>
                </div>
              </div>
            </div>

            {/* ── À propos ── */}
            <div className="mb-6">
              <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-2">À propos</h3>
              <p className="text-[14px] text-gray-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                {description || 'Aucune description fournie.'}
              </p>
              {description && description.length > 120 && (
                <span className="text-[13px] text-gray-400 underline mt-1 block cursor-pointer">Voir plus</span>
              )}
            </div>

            {/* ── Organisateurs ── */}
            <div className="mb-6">
              <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-3">Organisateurs</h3>
              <div className="space-y-3">
                {/* Main organizer */}
                <div className="bg-gray-50 rounded-[16px] p-4 border border-gray-100">
                  <div className="flex items-center gap-3">
                    {me?.profile?.avatarUrl ? (
                      <SafeImage src={me.profile.avatarUrl} alt={me.profile.displayName || 'Vous'} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FF9F1C] to-[#FFB75E] flex items-center justify-center font-bold text-[18px] text-white">
                        {me?.profile?.displayName?.charAt(0) || 'M'}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[15px] font-bold text-[#1A1A1A]">{me?.profile?.displayName || 'Vous'}</p>
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5 mb-2">{me?.profile?.followersCount || 0} followers • {me?.profile?.eventsCount || 0} événement</p>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm">Contacter</button>
                        <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm">Suivre</button>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Co-organisateurs */}
                {selectedCoOrgs.map(org => (
                  <div key={org.id} className="bg-gray-50 rounded-[16px] p-4 border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden">
                        <SafeImage src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full bg-orange-200 flex items-center justify-center font-bold text-white">{org.name.charAt(0)}</div>}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold text-[#1A1A1A]">{org.name}</p>
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">Co-hôte</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm">Contacter</button>
                          <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm">Suivre</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Let's Out Staff */}
                <div className="bg-gray-50 rounded-[16px] p-4 border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#FFCA28] to-[#FF9F1C] flex items-center justify-center">
                      <span className="text-white font-bold text-[13px]">LO</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[15px] font-bold text-[#1A1A1A]">Let's Out Staff</p>
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-0.5 mb-2">2020 followers • 6 événements • 4.8 ★</p>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm">Contacter</button>
                        <button className="px-3 py-1 rounded-full border border-gray-200 bg-white text-[11px] font-bold text-gray-700 shadow-sm">Suivre</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Participation ── */}
            <div className="mb-6">
              <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-3">Participation</h3>
              <div className="bg-gray-50 rounded-[16px] p-4 border border-gray-100 flex items-center justify-between">
                <span className="text-[14px] text-gray-700 font-medium">Montant</span>
                <span className="text-[15px] font-bold text-blue-600">
                  {amount && amount !== '0' ? `${parseInt(amount).toLocaleString()} F CFA` : 'Gratuit'}
                </span>
              </div>
            </div>

            {/* ── Participants ── */}
            <div className="mb-2">
              <h3 className="text-[16px] font-bold text-[#1A1A1A] mb-3">Participants</h3>
              <div className="bg-gray-50 rounded-[16px] p-4 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['#FF9F1C','#FF9F1C','#B070FF'].map((color, i) => (
                      <div key={i} className="w-9 h-9 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <span className="text-[14px] font-bold text-gray-900">0/{maxPlaces || '∞'}</span>
                </div>
                <button className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-700 shadow-sm">Voir tous</button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 7: Gestion du brouillon ── */}
        {step === 7 && (
          <div className="pb-8">
            {/* Titre */}
            <h1 className="text-[26px] font-bold text-gray-900 leading-tight mb-4">{title || 'Votre événement'}</h1>

            {/* Info banner */}
            <div className="bg-[#EBF3FA] mb-6 p-4 rounded-xl border border-blue-100">
              <p className="text-gray-600 text-[13px] leading-relaxed">
                Cet événement n'est pas encore visible sur Let's Out.<br />
                Publiez-le pour le rendre accessible publiquement.<br />
                Ou ajoutez une cagnotte pour partager les frais.
              </p>
            </div>

            <div className="space-y-4">
              {/* Organisateurs */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-[15px]">Organisateurs</h3>
                  <button onClick={() => setStep(5)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {me?.profile?.avatarUrl ? (
                      <SafeImage src={me.profile.avatarUrl} alt={me.profile.displayName || 'Vous'} className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#FF9F1C] to-[#FFB75E] flex items-center justify-center text-white font-bold text-[13px]">
                        {me?.profile?.displayName?.charAt(0).toUpperCase() || 'M'}
                      </div>
                    )}
                    <span className="text-[14px] text-gray-700 font-medium">{me?.profile?.displayName || 'Vous'}</span>
                  </div>
                  {selectedCoOrgs.map(org => (
                    <div key={org.id} className="flex items-center gap-3 pl-2 border-l-2 border-gray-100">
                      <SafeImage src={org.avatarUrl} alt={org.name} className="w-7 h-7 rounded-full object-cover"
                        fallback={<div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-white font-bold text-[11px]">{org.name.charAt(0).toUpperCase()}</div>}
                      />
                      <span className="text-[13px] text-gray-600 font-medium flex items-center gap-1.5">
                        {org.name}
                        <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Co-hôte</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#FFCA28] to-[#FF9F1C] flex items-center justify-center">
                      <span className="text-white font-bold text-[10px]">LO</span>
                    </div>
                    <span className="text-[14px] text-gray-700 font-medium flex items-center gap-1">
                      Let's Out Staff <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Informations */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-[15px]">Informations</h3>
                  <button onClick={() => setStep(1)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] text-gray-500">Nom</span>
                  <span className="text-[14px] font-medium text-gray-900 text-right max-w-[200px] truncate">{title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-gray-500">Catégories</span>
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {categories.map(cat => (
                      <span key={cat} className="text-[12px] font-bold text-[#FF9F1C] bg-[#FFF0D9] px-3 py-1 rounded-full border border-[#FFD99A]">
                        {CATEGORIES.find(c => c.value === cat)?.label || cat}
                      </span>
                    ))}
                    {categories.length === 0 && <span className="text-[14px] text-gray-400">Non spécifié</span>}
                  </div>
                </div>
              </div>

              {/* Date & lieu */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-[15px]">Date & lieu</h3>
                  <button onClick={() => setStep(2)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] text-gray-500">Date</span>
                  <span className="text-[14px] font-medium text-gray-900">{formattedDate || '—'}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] text-gray-500">Heure</span>
                  <span className="text-[14px] font-medium text-gray-900">{startTime && endTime ? `${startTime} – ${endTime} (GMT)` : '—'}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] text-gray-500">Ville</span>
                  <span className="text-[14px] font-medium text-gray-900 text-right max-w-[200px] truncate">{city || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-gray-500">Localisation</span>
                  <span className="text-[14px] font-medium text-gray-900 text-right max-w-[200px] truncate">{address || '—'}</span>
                </div>
              </div>

              {/* Participation */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-[15px]">Participation</h3>
                  <button onClick={() => setStep(3)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] text-gray-500">Places</span>
                  <span className="text-[14px] font-medium text-gray-900">{maxPlaces || 'Illimitées'}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[14px] text-gray-500">Ticket</span>
                  <span className="text-[14px] font-medium text-[#FF9F1C] font-bold">{amount && amount !== '0' ? `${parseInt(amount).toLocaleString()} F CFA` : 'Gratuit'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[14px] text-gray-500">Confidentialité</span>
                  <span className="text-[14px] font-medium text-gray-900">{isPrivate ? 'Privée' : 'Publique'}</span>
                </div>
              </div>

              {/* Description */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-[15px]">Description</h3>
                  <button onClick={() => setStep(4)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
                <p className="text-[13px] text-gray-600 line-clamp-3">{description || 'Aucune description'}</p>
                {description && description.length > 100 && (
                  <span className="text-[13px] text-gray-400 underline mt-1 block cursor-pointer">Voir plus</span>
                )}
              </div>

              {/* Couverture */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 text-[15px]">Couverture</h3>
                  <button onClick={() => setStep(4)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform">
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </button>
                </div>
                {coverPreview ? (
                  <div className="w-full h-36 rounded-xl overflow-hidden">
                    <SafeImage src={coverPreview} alt="Couverture" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-36 rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-2">
                    <span className="text-3xl">🖼</span>
                    <span className="text-[13px] text-gray-400">Aucune image</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="w-full shrink-0 border-t border-gray-100 px-5 pt-4 pb-6 bg-white">
        <div className="flex gap-3">
          {step < 6 ? (
            <>
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex-1 py-[17px] rounded-full border border-[#E5E5E5] font-semibold text-[15px] text-[#1A1A1A] bg-white transition-colors active:bg-gray-50">
                  Précédent
                </button>
              )}
              <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}
                className={`flex-1 py-[17px] rounded-full font-semibold text-[15px] text-white transition-all ${canNext() ? 'bg-[#FF9F1C]' : 'bg-[#FFD99A]'}`}>
                {step === 1 ? 'Commencer' : 'Suivant'}
              </button>
            </>
          ) : step === 6 ? (
            <>
              <button onClick={() => setStep(5)}
                className="flex-1 py-[17px] rounded-full border border-[#E5E5E5] font-semibold text-[15px] text-[#1A1A1A] bg-white transition-colors active:bg-gray-50">
                Précédent
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`flex-1 py-[17px] rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2 active:scale-95 transition-all ${
                  !loading ? 'bg-[#FF9F1C]' : 'bg-[#FFD99A]'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Création...' : "Créer l'événement"}
              </button>
            </>
          ) : (
            /* Step 7: publish actions */
            <div className="w-full space-y-3">
              <button
                onClick={() => { setShowPoolModal(true) }}
                className="w-full py-[15px] rounded-full border border-gray-200 text-[#FF9F1C] font-bold text-[15px] bg-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
              >
                <CagnotteAddIcon className="w-5 h-5 text-[#FF9F1C]" />
                Ajouter cagnotte
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className={`w-full py-[15px] rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all ${
                  publishing ? 'bg-[#FFD99A]' : 'bg-[#FF9F1C]'
                }`}
              >
                {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PublishEventIcon className="w-5 h-5 text-white" />}
                {publishing ? 'Publication...' : "Publier l'événement"}
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="w-full py-[13px] rounded-full border border-gray-200 text-gray-500 font-semibold text-[14px] bg-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Retour au profil
              </button>
            </div>
          )}
        </div>
        {step < 6 && (
          <div className="flex justify-center mt-3 pb-1">
            <div className="w-32 h-[5px] bg-black rounded-full" />
          </div>
        )}
      </div>

      {/* ── Modal Cagnotte multi-étapes ── */}
      {showPoolModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          {/* Header */}
          <div className="px-5 pt-safe-6 pb-0 flex-shrink-0">
            <div className="flex items-center justify-center relative mb-3">
              <button
                onClick={() => {
                  if (poolStep === 1) {
                    setShowPoolModal(false)
                  } else {
                    setPoolStep(s => s - 1)
                  }
                }}
                className="absolute left-0 w-8 h-8 flex items-center justify-center"
              >
                <ChevronLeft className="w-6 h-6 text-gray-800" />
              </button>
              <span className="text-[15px] font-semibold text-gray-900">Ajouter cagnotte</span>
              {enablePool && (
                <button
                  onClick={() => { setEnablePool(false); setPoolTarget(''); setPoolDescription(''); setPoolDeadline(''); setPoolMode('libre'); setPoolMinAmount(''); setShowPoolModal(false) }}
                  className="absolute right-0 text-[12px] text-red-400 font-medium"
                >
                  Supprimer
                </button>
              )}
            </div>
            {/* Progress bar — 4 segments */}
            <div className="flex gap-1.5 mb-1">
              {[1,2,3,4].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${s <= poolStep ? 'bg-[#FF9F1C]' : 'bg-gray-100'}`} />
              ))}
            </div>
            {/* Event name chip */}
            <p className="text-[11px] text-gray-400 text-center mt-2 mb-1">
              Cagnotte · <span className="font-medium text-gray-600">{title || 'Votre événement'}</span>
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pt-5 pb-32">

            {/* ── POOL STEP 1: But de la cagnotte ── */}
            {poolStep === 1 && (
              <div>
                <h2 className="text-[20px] font-bold text-gray-900 mb-1">But de la cagnotte</h2>
                <p className="text-[13px] text-gray-400 mb-6">Expliquez l'objectif &amp; le dépôt de la cagnotte</p>
                <label className="text-[13px] font-semibold text-gray-700 mb-2 block">Description</label>
                <textarea
                  value={poolDescription}
                  onChange={e => setPoolDescription(e.target.value)}
                  placeholder="Indiquez l'objectif..."
                  rows={5}
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-[14px] text-gray-700 resize-none focus:outline-none focus:border-[#FF9F1C] placeholder:text-gray-300 transition-colors"
                />
                <p className="text-[12px] text-gray-400 mt-2">{poolDescription.length}/500 caractères</p>
              </div>
            )}

            {/* ── POOL STEP 2: Objectif de collecte ── */}
            {poolStep === 2 && (
              <div>
                <h2 className="text-[20px] font-bold text-gray-900 mb-1">Objectif de collecte</h2>
                <p className="text-[13px] text-gray-400 mb-6">Définissez le montant à atteindre</p>

                <label className="text-[13px] font-semibold text-gray-700 mb-2 block">Montant cible</label>
                <div className="flex gap-2 items-center mb-5">
                  <input
                    type="number"
                    min={1}
                    value={poolTarget}
                    onChange={e => setPoolTarget(e.target.value)}
                    placeholder="150 000"
                    className="flex-1 px-4 py-3.5 border border-gray-200 rounded-2xl text-[15px] font-medium text-gray-900 focus:outline-none focus:border-[#FF9F1C] transition-colors"
                  />
                  <div className="px-4 py-3.5 border border-gray-200 rounded-2xl text-[13px] font-semibold text-gray-500 bg-gray-50 flex-shrink-0 flex items-center gap-1">
                    F CFA <ChevronLeft className="w-3 h-3 rotate-[-90deg] text-gray-400" />
                  </div>
                </div>

                <label className="text-[13px] font-semibold text-gray-700 mb-2 block">Date limite de participation</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={poolDeadline}
                    onChange={e => setPoolDeadline(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-2xl text-[14px] text-gray-500 focus:outline-none focus:border-[#FF9F1C] transition-colors"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  ⚠️ Une vérification d'identité (KYC) sera requise pour le retrait des fonds.
                </p>
              </div>
            )}

            {/* ── POOL STEP 3: Mode de participation ── */}
            {poolStep === 3 && (
              <div>
                <h2 className="text-[20px] font-bold text-gray-900 mb-1">Participation</h2>
                <p className="text-[13px] text-gray-400 mb-6">Choisissez comment les participants pourront contribuer</p>

                <label className="text-[13px] font-semibold text-gray-700 mb-3 block">Mode de participation</label>

                <div className="relative">
                  <select
                    value={poolMode}
                    onChange={e => setPoolMode(e.target.value as any)}
                    className="w-full appearance-none px-4 py-3.5 border border-gray-200 rounded-2xl text-[14px] text-gray-700 font-medium bg-white focus:outline-none focus:border-[#FF9F1C] transition-colors pr-10"
                  >
                    <option value="libre">Montant libre</option>
                    <option value="minimum">Montant minimum</option>
                    <option value="fixe">Montant fixe</option>
                  </select>
                  <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-[-90deg] pointer-events-none" />
                </div>

                {/* Description du mode */}
                <div className="mt-4 p-4 bg-gray-50 rounded-2xl">
                  {poolMode === 'libre' && (
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      🎁 Chaque participant contribue librement, <strong>selon ses moyens</strong>. Aucun montant minimum n'est imposé.
                    </p>
                  )}
                  {poolMode === 'minimum' && (
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      📌 Chaque participant doit contribuer <strong>au moins le montant minimum</strong>. Il peut donner plus s'il le souhaite.
                    </p>
                  )}
                  {poolMode === 'fixe' && (
                    <p className="text-[13px] text-gray-500 leading-relaxed">
                      🔒 Chaque participant contribue <strong>exactement le même montant</strong>, ni plus ni moins.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── POOL STEP 4: Montant minimum ou fixe ── */}
            {poolStep === 4 && (
              <div>
                <h2 className="text-[20px] font-bold text-gray-900 mb-1">Participation</h2>
                <p className="text-[13px] text-gray-400 mb-6">Choisissez comment les participants pourront contribuer</p>

                <label className="text-[13px] font-semibold text-gray-700 mb-3 block">Mode de participation</label>

                {/* Mode affiché en lecture seule — tap pour modifier */}
                <div className="relative mb-5">
                  <select
                    value={poolMode}
                    onChange={e => setPoolMode(e.target.value as any)}
                    className="w-full appearance-none px-4 py-3.5 border border-[#FF9F1C] rounded-2xl text-[14px] text-gray-700 font-medium bg-white focus:outline-none pr-10"
                  >
                    <option value="libre">Montant libre</option>
                    <option value="minimum">Montant minimum</option>
                    <option value="fixe">Montant fixe</option>
                  </select>
                  <ChevronLeft className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF9F1C] rotate-[-90deg] pointer-events-none" />
                </div>

                {poolMode !== 'libre' && (
                  <>
                    <label className="text-[13px] font-semibold text-gray-700 mb-2 block">
                      {poolMode === 'minimum' ? 'Montant minimum (F CFA)' : 'Montant fixe par participant (F CFA)'}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={1}
                        value={poolMinAmount}
                        onChange={e => setPoolMinAmount(e.target.value)}
                        placeholder="Ex: 5 000"
                        className="flex-1 px-4 py-3.5 border border-gray-200 rounded-2xl text-[15px] font-medium text-gray-900 focus:outline-none focus:border-[#FF9F1C] transition-colors"
                      />
                      <div className="px-4 py-3.5 border border-gray-200 rounded-2xl text-[13px] font-semibold text-gray-500 bg-gray-50 flex-shrink-0">
                        F CFA
                      </div>
                    </div>
                  </>
                )}

                {poolMode === 'libre' && (
                  <div className="p-4 bg-[#FFF8F1] border border-[#FF9F1C]/20 rounded-2xl">
                    <p className="text-[13px] text-[#FF9F1C] font-medium">
                      ✅ Mode libre sélectionné — aucun montant minimum requis.
                    </p>
                  </div>
                )}

                {/* Récapitulatif cagnotte */}
                {poolTarget && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-2xl space-y-2">
                    <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-3">Récapitulatif</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-gray-500">Objectif</span>
                      <span className="text-[13px] font-bold text-gray-900">{parseInt(poolTarget).toLocaleString()} F CFA</span>
                    </div>
                    {poolDeadline && (
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-gray-500">Date limite</span>
                        <span className="text-[13px] font-bold text-gray-900">
                          {new Date(poolDeadline + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-gray-500">Mode</span>
                      <span className="text-[13px] font-bold text-gray-900 capitalize">
                        {poolMode === 'libre' ? 'Montant libre' : poolMode === 'minimum' ? 'Montant minimum' : 'Montant fixe'}
                      </span>
                    </div>
                    {poolMode !== 'libre' && poolMinAmount && (
                      <div className="flex justify-between items-center">
                        <span className="text-[13px] text-gray-500">{poolMode === 'minimum' ? 'Minimum' : 'Montant'}</span>
                        <span className="text-[13px] font-bold text-[#FF9F1C]">{parseInt(poolMinAmount).toLocaleString()} F CFA</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom CTA */}
          <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
            <button
              onClick={() => {
                if (poolStep < 4) {
                  // Step 3 → si mode libre, on saute step 4 et on valide directement
                  if (poolStep === 3 && poolMode === 'libre') {
                    setEnablePool(true)
                    setShowPoolModal(false)
                    savePoolToEvent().then(() => toast.success('Cagnotte configurée !')).catch(() => toast.error('Erreur lors de l\'enregistrement de la cagnotte'))
                  } else {
                    setPoolStep(s => s + 1)
                  }
                } else {
                  setEnablePool(true)
                  setShowPoolModal(false)
                  savePoolToEvent().then(() => toast.success('Cagnotte configurée !')).catch(() => toast.error('Erreur lors de l\'enregistrement de la cagnotte'))
                }
              }}
              disabled={
                (poolStep === 1 && poolDescription.trim().length < 5) ||
                (poolStep === 2 && !poolTarget)
              }
              className={`w-full py-4 rounded-full font-bold text-[15px] text-white transition-all active:scale-[0.98] ${
                (poolStep === 1 && poolDescription.trim().length < 5) ||
                (poolStep === 2 && !poolTarget)
                  ? 'bg-[#FF9F1C]/30'
                  : 'bg-[#FF9F1C]'
              }`}
            >
              {poolStep === 4 || (poolStep === 3 && poolMode === 'libre')
                ? '✓ Confirmer la cagnotte'
                : 'Suivant'}
            </button>
            <div className="flex justify-center mt-3">
              <div className="w-32 h-[5px] bg-black rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* ── Search co-organizer modal ── */}
      {showSearchModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="px-5 pt-16 pb-3">
            <div className="flex items-center justify-center relative mb-4">
              <button onClick={() => setShowSearchModal(false)} className="absolute left-0">
                <ChevronLeft className="w-6 h-6 text-gray-800" />
              </button>
              <span className="text-[15px] font-semibold text-gray-900">Rechercher un ami</span>
            </div>
            <div className="flex items-center gap-2 border border-[#FF9F1C] rounded-xl px-3 py-2.5">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input autoFocus value={coOrgSearch} onChange={e => setCoOrgSearch(e.target.value)}
                placeholder="Le|" className="flex-1 text-[14px] outline-none text-gray-900" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5">
            {/* Selected */}
            {selectedCoOrgs.length > 0 && (
              <div className="mb-4">
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Sélectionnés</p>
                {selectedCoOrgs.map(org => (
                  <div key={org.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                        <SafeImage 
                          src={org.avatarUrl} 
                          alt={org.name} 
                          className="w-full h-full object-cover" 
                          fallback={
                            <div className="w-full h-full bg-orange-400 flex items-center justify-center text-white font-bold text-sm">
                              {org.name.charAt(0).toUpperCase()}
                            </div>
                          }
                        />
                      </div>
                      <span className="text-[14px] font-medium text-gray-900">{org.name}</span>
                    </div>
                    <button onClick={() => setSelectedCoOrgs(p => p.filter(o => o.id !== org.id))}
                      className="text-[12px] font-bold text-gray-500 border border-gray-200 rounded-full px-3 py-1">
                      Retirer
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {friends.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Recherche</p>
                {friends.filter(f => !selectedCoOrgs.find(o => o.id === (f.userId || f.id))).map((f: any) => {
                  const name = f.displayName || f.username || 'Utilisateur'
                  const uid = f.userId || f.id
                  return (
                    <div key={uid} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        {f.avatarUrl ? (
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                            <SafeImage src={f.avatarUrl} alt={name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-orange-300 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[14px] font-medium text-gray-900">{name}</span>
                      </div>
                      <button onClick={() => setSelectedCoOrgs(p => [...p, { id: uid, name, avatarUrl: f.avatarUrl }])}
                        className="text-[12px] font-bold text-[#FF9F1C] border border-[#FF9F1C]/30 rounded-full px-3 py-1">
                        Ajouter
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={() => setShowSearchModal(false)}
              className="w-full py-4 rounded-full bg-[#FF9F1C] font-bold text-[15px] text-white">
              Confirmer la sélection
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive Map Modal ── */}
      {showMapModal && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="absolute top-0 left-0 right-0 z-[110] bg-white/90 backdrop-blur-md px-5 pt-16 pb-4 shadow-sm border-b border-gray-100 flex items-center justify-between">
            <button onClick={() => setShowMapModal(false)} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full active:scale-95 transition-transform">
              <ChevronLeft className="w-6 h-6 text-gray-800" />
            </button>
            <span className="text-[16px] font-bold text-gray-900">Placer le repère</span>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
          
          <div className="flex-1 relative z-0">
            <MapContainer 
              key={`${mapCenter[0]}-${mapCenter[1]}`}
              center={mapCenter} 
              zoom={14} 
              scrollWheelZoom={true} 
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapInteractionHandler onMapClick={(coords) => {
                setTempLat(coords.lat)
                setTempLon(coords.lng)
              }} />
              <Marker 
                position={[tempLat, tempLon]} 
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    setTempLat(position.lat);
                    setTempLon(position.lng);
                  }
                }}
              />
            </MapContainer>

            {/* Premium Search overlay inside Map */}
            <div className="absolute top-24 left-4 right-4 z-[1000] flex flex-col gap-2">
              <div className="bg-white/95 backdrop-blur-xl rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 flex items-center px-4 py-3.5 transition-all focus-within:ring-4 focus-within:ring-[#FF9F1C]/20">
                <Search className="w-[18px] h-[18px] text-[#FF9F1C] mr-3 shrink-0" strokeWidth={2.5} />
                <input 
                  value={mapSearchQuery} 
                  onChange={e => handleMapSearch(e.target.value)} 
                  placeholder={city ? `Rechercher dans ${city}...` : "Rechercher un lieu précis..."} 
                  className="flex-1 outline-none text-[15px] bg-transparent text-gray-900 placeholder:text-gray-400 font-medium"
                />
                {mapSearchQuery && (
                  <button onClick={() => { setMapSearchQuery(''); setMapSearchSuggestions([]) }} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors ml-2">
                    <X className="w-4 h-4 text-gray-500" strokeWidth={2.5} />
                  </button>
                )}
              </div>
              
              {mapSearchSuggestions.length > 0 && (
                <div className="bg-white/95 backdrop-blur-xl rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 overflow-hidden max-h-60 overflow-y-auto divide-y divide-gray-100/50">
                  {mapSearchSuggestions.map((s, i) => {
                    // Highlight the first part of the address
                    const parts = s.label.split(',');
                    const mainText = parts[0];
                    const subText = parts.slice(1).join(',').trim();
                    
                    return (
                      <button key={i} onClick={() => selectMapSuggestion(s)} 
                        className="w-full text-left px-5 py-3.5 hover:bg-orange-50/50 flex items-start gap-3 transition-colors active:bg-orange-100/50">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-4 h-4 text-[#FF9F1C]" strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="text-[14px] font-bold text-gray-900 truncate">{mainText}</span>
                          {subText && <span className="text-[12px] text-gray-500 truncate">{subText}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Crosshair instruction overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-gray-900/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-[12px] font-medium shadow-lg pointer-events-none flex items-center gap-2">
              Appuyez ou glissez le pin pour ajuster
            </div>
          </div>

          <div className="bg-white border-t border-gray-100 px-5 pt-4 pb-8 z-[110] shadow-[0_-8px_20px_rgba(0,0,0,0.05)] relative">
            <button onClick={confirmMapLocation} disabled={isReverseGeocoding}
              className={`w-full py-4 rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${!isReverseGeocoding ? 'bg-[#FF9F1C]' : 'bg-[#FF9F1C]/50'}`}>
              {isReverseGeocoding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              {isReverseGeocoding ? 'Traduction de l\'adresse...' : 'Valider cette position'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Map helper component to handle clicks
function MapInteractionHandler({ onMapClick }: { onMapClick: (coords: {lat: number, lng: number}) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  
  // Center map when props change is usually handled by keeping MapContainer center stable or using map.flyTo
  // For simplicity, we just listen to clicks.
  return null;
}
