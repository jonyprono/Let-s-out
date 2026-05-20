import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { ChevronLeft, Calendar, Clock, MapPin, Search, X, Loader2, Image as ImageIcon, Navigation, Megaphone, Map as MapIcon, Check, Edit3 } from 'lucide-react'
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
      <div className={`px-5 pt-4 ${step === 6 ? 'pb-4 bg-gray-50' : 'pb-0'}`}>
        <div className="flex items-center justify-center relative mb-3">
          <button onClick={step === 1 ? onBack : () => setStep(s => s - 1)}
            className={`absolute left-0 w-8 h-8 flex items-center justify-center ${step === 6 ? 'bg-gray-100 rounded-full' : ''}`}>
            <ChevronLeft className={`w-6 h-6 text-gray-800 ${step === 6 ? 'w-5 h-5' : ''}`} />
          </button>
          <span className="text-[15px] font-semibold text-gray-900">{step === 6 ? 'Détails événement' : 'Créer un événement'}</span>
        </div>
        {/* Progress bar */}
        {step < 6 && (
          <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#FF9F1C] rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Step content */}
      <div className={`flex-1 overflow-y-auto px-5 pt-6 pb-28 ${step === 6 ? 'bg-gray-50 pt-2 pb-40' : ''}`}>
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
                    <SafeImage src={coverPreview} alt="Aperçu couverture" className="absolute inset-0 w-full h-full object-cover" />
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
          <div className="space-y-4 min-h-full">
            <h1 className="text-[26px] font-bold text-gray-900 leading-tight mb-4">{title || 'Titre de l\'événement'}</h1>
            
            <div className="bg-[#EBF3FA] mb-6 p-4 rounded-xl text-gray-600 text-[13px] leading-relaxed">
              Cet événement n'est pas encore visible sur Let's Out.<br/>
              Publiez-le pour le rendre accessible publiquement.<br/>
              Ou ajoutez une cagnotte pour partager les frais.
            </div>

            {/* Organisateurs Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900 text-[15px]">Organisateurs</h3>
                 <button onClick={() => setStep(5)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
               </div>
               <div className="flex items-center gap-3 mb-3">
                 {me?.profile?.avatarUrl ? (
                    <SafeImage src={me.profile.avatarUrl} alt={me.profile.displayName || 'Vous'} className="w-8 h-8 rounded-full object-cover" />
                 ) : (
                   <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-sm">
                     {me?.profile?.displayName?.charAt(0) || 'M'}
                   </div>
                 )}
                 <span className="text-[14px] text-gray-700 font-medium">{me?.profile?.displayName || 'Vous'}</span>
               </div>
               {selectedCoOrgs.map(org => (
                 <div key={org.id} className="flex items-center gap-3 mt-3">
                   {org.avatarUrl ? (
                     <SafeImage src={org.avatarUrl} alt={org.name} className="w-8 h-8 rounded-full object-cover" />
                   ) : (
                     <div className="w-8 h-8 rounded-full bg-orange-300 flex items-center justify-center text-white font-bold text-sm">
                       {org.name.charAt(0).toUpperCase()}
                     </div>
                   )}
                   <span className="text-[14px] text-gray-700 font-medium">{org.name}</span>
                 </div>
               ))}
            </div>

            {/* Informations Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900 text-[15px]">Informations</h3>
                 <button onClick={() => setStep(1)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
               </div>
               <div className="flex justify-between items-center mb-3">
                 <span className="text-[14px] text-gray-500">Nom</span>
                 <span className="text-[14px] font-medium text-gray-900 truncate max-w-[180px]">{title || '—'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[14px] text-gray-500">Catégories</span>
                 <div className="flex gap-1">
                   {categories.length > 0 ? categories.map(cat => (
                     <span key={cat} className="text-[12px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{CATEGORIES.find(c => c.value === cat)?.label}</span>
                   )) : (
                     <span className="text-[12px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">—</span>
                   )}
                 </div>
               </div>
            </div>

            {/* Date & Lieu Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900 text-[15px]">Date & lieu</h3>
                 <button onClick={() => setStep(2)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
               </div>
               <div className="flex justify-between items-center mb-3">
                 <span className="text-[14px] text-gray-500">Date</span>
                 <span className="text-[14px] font-medium text-gray-900 capitalize">{formattedDate || '—'}</span>
               </div>
               <div className="flex justify-between items-center mb-3">
                 <span className="text-[14px] text-gray-500">Heure</span>
                 <span className="text-[14px] font-medium text-gray-900">{startTime ? `${startTime} – ${endTime} (GMT)` : '—'}</span>
               </div>
               <div className="flex justify-between items-center mb-3">
                 <span className="text-[14px] text-gray-500">Ville</span>
                 <span className="text-[14px] font-medium text-gray-900">{city || '—'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[14px] text-gray-500">Localisation</span>
                 <span className="text-[14px] font-medium text-gray-900 truncate max-w-[150px]">{address || '—'}</span>
               </div>
            </div>

            {/* Participation Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900 text-[15px]">Participation</h3>
                 <button onClick={() => setStep(3)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
               </div>
               <div className="flex justify-between items-center mb-3">
                 <span className="text-[14px] text-gray-500">Places</span>
                 <span className="text-[14px] font-medium text-gray-900">{maxPlaces || 'Illimitées'}</span>
               </div>
               <div className="flex justify-between items-center mb-3">
                 <span className="text-[14px] text-gray-500">Ticket</span>
                 <span className="text-[14px] font-medium text-gray-900">{amount && amount !== '0' ? `${parseInt(amount).toLocaleString()} F CFA` : 'Gratuit'}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-[14px] text-gray-500">Confidentialité</span>
                 <span className="text-[14px] font-medium text-gray-900">{isPrivate ? 'Privée' : 'Publique'}</span>
               </div>
            </div>

            {/* Description Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900 text-[15px]">Description</h3>
                 <button onClick={() => setStep(4)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
               </div>
               <p className="text-[13px] text-gray-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">{description || 'Aucune description'}</p>
               {description && description.length > 100 && (
                 <span className="text-[13px] text-gray-400 underline mt-1 block">Voir plus</span>
               )}
            </div>

            {/* Couverture Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900 text-[15px]">Couverture</h3>
                 <button onClick={() => setStep(4)} className="text-[12px] text-gray-500 flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full font-medium active:scale-95 transition-transform"><Edit3 className="w-3.5 h-3.5"/> Modifier</button>
               </div>
               <div className="w-full h-40 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 shadow-sm relative">
                  {coverPreview ? (
                     <SafeImage src={coverPreview} alt="Aperçu couverture" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="text-3xl">{categories[0] === 'SPORT' ? '⚽️' : categories[0] === 'MUSIC' ? '🎸' : '✨'}</div>
                      <span className="text-[12px] text-gray-400 font-medium">Image par défaut</span>
                    </div>
                  )}
               </div>
            </div>

          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className={`absolute bottom-0 left-0 right-0 border-t border-gray-100 px-5 pt-4 pb-6 ${step === 6 ? 'bg-white' : 'bg-white'}`}>
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
            <div className="w-full space-y-3">
              <button
                onClick={() => { setPoolStep(1); setShowPoolModal(true) }}
                className="w-full py-4 rounded-full border border-gray-200 font-bold text-[15px] text-[#FF9F1C] flex items-center justify-center gap-2 bg-white active:scale-95 transition-transform"
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 flex items-center justify-center"><span className="text-[16px] leading-none">🪙</span></div>
                  Ajouter cagnotte
                </div>
              </button>
              <button
                onClick={() => handleSubmit('PUBLISHED')}
                disabled={loading}
                className={`w-full py-4 rounded-full font-bold text-[15px] text-white flex items-center justify-center gap-2 active:scale-95 transition-transform ${
                  !loading ? 'bg-[#FF9F1C]' : 'bg-[#FF9F1C]/50'
                }`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
                {loading ? 'Publication...' : 'Publier l\'événement'}
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
          <div className="px-5 pt-4 pb-0 flex-shrink-0">
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
                    toast.success('Cagnotte configurée !')
                  } else {
                    setPoolStep(s => s + 1)
                  }
                } else {
                  // Confirmer
                  setEnablePool(true)
                  setShowPoolModal(false)
                  toast.success('Cagnotte configurée !')
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
