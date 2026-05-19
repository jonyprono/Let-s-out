import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { ChevronLeft, Calendar, Clock, MapPin, Search, X, Loader2, Image as ImageIcon, Navigation, Megaphone, Map as MapIcon, Check } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { SafeImage } from '@/components/shared/SafeImage'
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
  { label: 'Sport', value: 'SPORT' },
  { label: 'Culture & Art', value: 'CULTURE' },
  { label: 'Gastronomie', value: 'FOOD' },
  { label: 'Soirées', value: 'NIGHTLIFE' },
  { label: 'Voyages', value: 'TRAVEL' },
  { label: 'Gaming', value: 'GAMING' },
  { label: 'Bien-être', value: 'WELLNESS' },
  { label: 'Musique', value: 'MUSIC' },
  { label: 'Autre', value: 'OTHER' },
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
    if (title || categories.length > 0 || city) {
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
  const handleCitySearch = async (q: string) => {
    setCityInput(q)
    if (q.length < 2) { setCitySuggestions([]); return }
    try {
      const results = await searchCities(q)
      setCitySuggestions(results)
    } catch { setCitySuggestions([]) }
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

  const handleSubmit = async (targetStatus: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') => {
    setLoading(true)
    const editEventId = location.state?.editEventId
    try {
      let coverUrl: string | undefined
      if (coverFile) {
        const fd = new FormData(); fd.append('file', coverFile)
        const { data } = await apiClient.post('/chat/upload', fd)
        coverUrl = data.url
      } else if (location.state?.eventData?.coverUrl) {
        // Keep existing cover if no new file selected
        coverUrl = location.state.eventData.coverUrl
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
        status: targetStatus,
        coHostIds: selectedCoOrgs.map(o => o.id)
      }

      let res
      if (editEventId) {
        // Update existing draft
        res = await apiClient.patch(`/events/${editEventId}`, payload)
      } else {
        // Create new event
        res = await apiClient.post('/events', payload)
      }

      localStorage.removeItem('create_event_draft')
      toast.success(targetStatus === 'DRAFT' ? 'Brouillon enregistré !' : 'Événement publié avec succès !')
      const eventId = editEventId || res.data?.id
      if (eventId) {
        navigate(`/events/${eventId}`)
      } else {
        navigate('/home')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erreur lors de la création")
    } finally { setLoading(false) }
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
    <div className="w-full h-full bg-white flex flex-col">

      {/* Header */}
      <div className="px-5 pt-4 pb-0">
        <div className="flex items-center justify-center relative mb-3">
          <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)}
            className="absolute left-0 w-8 h-8 flex items-center justify-center">
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
          <span className="text-[15px] font-semibold text-gray-900">Créer un événement</span>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#FF9F1C] rounded-full transition-all duration-300"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-28">
        <h2 className="text-[20px] font-bold text-[#FF9F1C] mb-1">{stepTitles[step - 1]}</h2>
        <p className="text-[13px] text-gray-400 mb-6">{stepSubs[step - 1]}</p>

        {/* ── STEP 1: Informations ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Nom</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Nom de l'événement..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C]"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-3 block">Catégories</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const sel = categories.includes(cat.value)
                  return (
                    <button key={cat.value} onClick={() => toggleCategory(cat.value)}
                      className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all ${sel ? 'bg-[#FF9F1C] text-white border-[#FF9F1C]' : 'bg-white text-gray-700 border-gray-200'
                        }`}>
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Date & lieu ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                {date ? (
                  <div className="flex items-center w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-[15px]">
                    <span className="flex-1 text-gray-900">{formattedDate}</span>
                    <button onClick={() => setDate('')}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                ) : (
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-400 focus:outline-none focus:border-[#FF9F1C]"
                  />
                )}
              </div>
            </div>

            {/* Heure */}
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Heure</label>
              {startTime && endTime ? (
                <div className="flex items-center w-full px-3 py-3 border border-gray-200 rounded-xl text-[15px]">
                  <Clock className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="flex-1 text-gray-900">{startTime} h – {endTime} h</span>
                  <button onClick={() => { setStartTime(''); setEndTime('') }}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                      placeholder="Début"
                      className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                  <div className="relative flex-1">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                      placeholder="Fin"
                      className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Ville avec autocomplete Nominatim */}
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Ville</label>
              {city && !citySuggestions.length ? (
                <div className="flex items-center w-full pl-3 pr-3 py-3 border border-gray-200 rounded-xl text-[15px]">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="flex-1 text-gray-900">{city}</span>
                  <button onClick={() => { setCity(''); setCityInput('') }}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
              ) : (
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                  <input value={cityInput} onChange={e => handleCitySearch(e.target.value)}
                    placeholder="Sélectionnez une ville"
                    className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-500 focus:outline-none focus:border-[#FF9F1C]"
                  />
                  {citySuggestions.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
                      {citySuggestions.map((s, i) => (
                        <button key={i} onClick={() => selectCity(s)}
                          className="w-full text-left px-4 py-3 text-[13px] text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
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
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Localisation</label>
              {address && !citySuggestions.length ? (
                <div className="flex items-center w-full pl-3 pr-3 py-3 border border-gray-200 rounded-xl text-[15px]">
                  <MapPin className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="flex-1 text-gray-900 text-[13px] truncate">{address}</span>
                  <button onClick={() => setAddress('')}><X className="w-4 h-4 text-gray-400" /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleGeolocate} disabled={geoLoading}
                    className="flex-[1.2] flex items-center justify-center gap-2 px-3 py-3 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-700 bg-white active:scale-95 transition-transform">
                    {geoLoading
                      ? <Loader2 className="w-4 h-4 text-[#FF9F1C] animate-spin" />
                      : <Navigation className="w-4 h-4 text-gray-700" />}
                    <span>{geoLoading ? 'Recherche...' : 'Ma position'}</span>
                  </button>
                  <button onClick={openMap}
                    className="flex-[0.8] flex items-center justify-center gap-2 px-3 py-3 border border-gray-200 rounded-xl text-[13px] font-bold text-gray-700 bg-white active:scale-95 transition-transform">
                    <MapIcon className="w-4 h-4 text-gray-700" />
                    <span>Ouvrir la carte</span>
                  </button>
                </div>
              )}
              {/* Ou saisir manuellement */}
              {!address && (
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                  <input value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Ou saisir une adresse manuellement"
                    className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-500 focus:outline-none focus:border-[#FF9F1C]"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: Participation ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Nombre de places</label>
              <input type="number" min={1} value={maxPlaces} onChange={e => setMaxPlaces(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C]"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Montant de participation</label>
              <div className="flex gap-2 items-center">
                <input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0 (gratuit)"
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-[15px] focus:outline-none focus:border-[#FF9F1C]"
                />
                <div className="px-3 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-600 bg-gray-50 flex-shrink-0">
                  F CFA ▾
                </div>
              </div>
            </div>

            {/* Cagnotte toggle */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold text-gray-800">Activer une cagnotte</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Collectez des fonds pour votre événement</p>
                </div>
                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => setEnablePool(p => !p)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    enablePool ? 'bg-[#FF9F1C]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      enablePool ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {enablePool && (
                <div className="mt-4">
                  <label className="text-[13px] font-medium text-gray-700 mb-2 block">Objectif de collecte</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={1}
                      value={poolTarget}
                      onChange={e => setPoolTarget(e.target.value)}
                      placeholder="Ex: 100000"
                      className="flex-1 px-4 py-3 border border-[#FF9F1C] rounded-xl text-[15px] focus:outline-none"
                    />
                    <div className="px-3 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-600 bg-gray-50 flex-shrink-0">
                      F CFA
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    ⚠️ Une vérification d'identité (KYC) sera requise pour effectuer le retrait.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-3 block">Confidentialité</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setIsPrivate(false)}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!isPrivate ? 'border-[#FF9F1C]' : 'border-gray-300'}`}>
                    {!isPrivate && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]" />}
                  </div>
                  <span className="text-[14px] text-gray-700">Public</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer" onClick={() => setIsPrivate(true)}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isPrivate ? 'border-[#FF9F1C]' : 'border-gray-300'}`}>
                    {isPrivate && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9F1C]" />}
                  </div>
                  <span className="text-[14px] text-gray-700">Privé</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Présentation ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="À propos de votre événement..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-[14px] resize-none focus:outline-none focus:border-[#FF9F1C]"
              />
            </div>
            <div>
              <label className="text-[13px] font-medium text-gray-700 mb-2 block">Couverture</label>
              <button onClick={() => fileRef.current?.click()}
                className="w-full h-40 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 overflow-hidden relative bg-gray-50">
                {coverPreview ? (
                  <>
                    <img src={coverPreview} className="absolute inset-0 w-full h-full object-cover" />
                    <button onClick={e => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null) }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8 text-gray-300" />
                    <span className="text-[13px] text-gray-400">Sélectionner une image</span>
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
            <button onClick={() => setShowSearchModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl text-[14px] text-gray-400 bg-white">
              <Search className="w-4 h-4 text-gray-400" />
              Rechercher un ami
            </button>

            {selectedCoOrgs.length > 0 && (
              <div className="space-y-3">
                {selectedCoOrgs.map(org => (
                  <div key={org.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                        <SafeImage 
                          src={org.avatarUrl} 
                          alt={org.name} 
                          className="w-full h-full object-cover" 
                          fallback={
                            <div className="w-full h-full bg-orange-300 flex items-center justify-center text-white font-bold text-[13px]">
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
          </div>
        )}

        {/* ── STEP 6: Rendu après publication ── */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="bg-[#FFF8F1] border border-[#FFE8D6] rounded-lg py-2 text-center text-[#FF9F1C] text-[12px] font-bold uppercase tracking-wider mb-2">
              Rendu après publication
            </div>

            {/* Cover */}
            <div className="w-full h-48 rounded-2xl overflow-hidden bg-gray-100 relative">
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  {categories[0] === 'SPORT' ? '⚽️' : categories[0] === 'MUSIC' ? '🎸' : '✨'}
                </div>
              )}
            </div>

            {/* Title & Tags */}
            <div>
              <h1 className="text-2xl font-black text-gray-900 mb-3">{title || 'Titre de l\'événement'}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-full text-[12px] font-bold">
                  {CATEGORIES.find(c => c.value === categories[0])?.label || 'Catégorie'}
                </span>
                <span className="px-3 py-1 bg-blue-50 text-blue-500 rounded-full text-[12px] font-bold">
                  Social
                </span>
              </div>
            </div>

            {/* Info lines */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-bold text-gray-900">{city || 'Ville'}</p>
                  <p className="text-[13px] text-gray-500">{address || 'Adresse'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Calendar className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[14px] font-bold text-gray-900 capitalize">
                    {date ? format(new Date(date), "EEE dd MMM yyyy", { locale: fr }) : 'Date'}
                  </p>
                  <p className="text-[13px] text-gray-500">
                    {startTime || '00:00'} — {endTime || '00:00'} (GMT)
                  </p>
                </div>
              </div>
            </div>

            {/* À propos */}
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-2">À propos</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed whitespace-pre-wrap">
                {description || "Aucune description fournie."}
              </p>
            </div>

            {/* Organisateurs */}
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-3">Organisateurs</h3>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-3">
                    {me?.profile?.avatarUrl ? (
                      <img src={me.profile.avatarUrl} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold">
                        {me?.profile?.displayName?.charAt(0) || 'M'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-bold text-gray-900">{me?.profile?.displayName || 'Moi'}</p>
                        <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      </div>
                      <p className="text-[11px] text-gray-500">{me?.profile?.followersCount || 0} followers • {me?.profile?.eventsCount || 0} événement{(me?.profile?.eventsCount || 0) > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-400 opacity-50 cursor-not-allowed">Contacter</button>
                    <button disabled className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-400 opacity-50 cursor-not-allowed">Suivre</button>
                  </div>
                </div>

                {selectedCoOrgs.map(org => (
                  <div key={org.id} className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
                    <div className="flex items-center gap-3">
                      {org.avatarUrl ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                          <SafeImage src={org.avatarUrl} alt={org.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-orange-300 flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-bold text-gray-900">{org.name}</p>
                        </div>
                        <p className="text-[11px] text-gray-500">Co-organisateur</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button disabled className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-400 opacity-50 cursor-not-allowed">Contacter</button>
                      <button disabled className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-400 opacity-50 cursor-not-allowed">Suivre</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Participation */}
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-3">Participation</h3>
              <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center border border-gray-100">
                <span className="text-[14px] text-gray-900 font-medium">Montant</span>
                <span className="text-[14px] font-bold text-blue-600">
                  {amount === '0' || !amount ? 'Gratuit' : `${parseInt(amount).toLocaleString()} F CFA`}
                </span>
              </div>
            </div>

            {/* Participants */}
            <div>
              <h3 className="text-[15px] font-bold text-gray-900 mb-3">Participants</h3>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 border-2 border-white z-20" />
                    <div className="w-9 h-9 rounded-full bg-gray-300 border-2 border-white z-10" />
                    <div className="w-9 h-9 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-[10px] text-white z-0">
                      +0
                    </div>
                  </div>
                  <span className="text-[14px] font-bold text-gray-600 ml-2">
                    0/{maxPlaces || '∞'}
                  </span>
                </div>
                <button disabled className="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-[12px] font-bold text-gray-400 opacity-50 cursor-not-allowed">
                  Voir tous
                </button>
              </div>
            </div>

            <div className="h-6" /> {/* spacer for bottom nav */}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        <div className="flex gap-3">
          {step < TOTAL_STEPS ? (
            <>
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="flex-1 py-4 rounded-full border border-gray-200 font-bold text-[15px] text-gray-700">
                  Précédent
                </button>
              )}
              <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()}
                className={`flex-1 py-4 rounded-full font-bold text-[15px] text-white transition-all ${canNext() ? 'bg-[#FF9F1C]' : 'bg-[#FF9F1C]/30'
                  }`}>
                Suivant
              </button>
            </>
          ) : (
            <>
              <button onClick={() => handleSubmit('DRAFT')} disabled={loading}
                className="flex-[0.8] py-4 rounded-full border border-gray-200 font-bold text-[15px] text-gray-700 flex items-center justify-center gap-2 transition-all active:scale-95 bg-white shadow-sm text-center px-2">
                Enregistrer au brouillon
              </button>
              <button onClick={() => handleSubmit('PUBLISHED')} disabled={loading}
                className={`flex-[1.2] py-4 rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${!loading ? 'bg-[#FF9F1C]' : 'bg-[#FF9F1C]/50'
                  }`}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
                {loading ? 'Publication...' : 'Publier'}
              </button>
            </>
          )}
        </div>
        <div className="flex justify-center mt-3 pb-1">
          <div className="w-32 h-[5px] bg-black rounded-full" />
        </div>
      </div>

      {/* ── Search co-organizer modal ── */}
      {showSearchModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col">
          <div className="px-5 pt-5 pb-3">
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
          <div className="absolute top-0 left-0 right-0 z-[110] bg-white/90 backdrop-blur-md px-5 pt-12 pb-4 shadow-sm border-b border-gray-100 flex items-center justify-between">
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
