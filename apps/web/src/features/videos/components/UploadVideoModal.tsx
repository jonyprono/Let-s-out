import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Film, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { videosApi } from '@/features/videos/api'
import { toast } from 'sonner'

const CATEGORY_LABELS: Record<string, string> = {
  MUSIC: '🎵 Musique',
  NIGHTLIFE: '🎉 Soirées',
  SPORT: '⚽ Sport',
  CULTURE: '🎭 Culture',
  FOOD: '🍽️ Gastronomie',
  ART: '🎨 Art',
  TECH: '💻 Tech',
  GAMING: '🎮 Gaming',
  WELLNESS: '🧘 Bien-être',
  TRAVEL: '✈️ Voyage',
  SOCIAL: '👥 Social',
  SCIENCE: '🔬 Science',
  LIFESTYLE: '🌟 Lifestyle',
  TOURISM: '🗺️ Tourisme',
  OTHER: '📌 Autre',
}

interface UploadVideoModalProps {
  eventId?: string  // Si fourni, prÃ©-sÃ©lectionne l'Ã©vÃ©nement (depuis EventDetails)
  eventTitle?: string
  eventCategory?: string
  onClose: () => void
  onSuccess: () => void
}

export function UploadVideoModal({ eventId: presetEventId, eventTitle, eventCategory, onClose, onSuccess }: UploadVideoModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state â€” jamais effacÃ© en cas d'erreur d'upload
  const [title, setTitle] = useState('')
  const [selectedEventId, setSelectedEventId] = useState(presetEventId ?? '')
  const [category, setCategory] = useState(eventCategory ?? '')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(0)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PARTICIPANTS' | 'PRIVATE'>('PUBLIC')

  // Recupere uniquement les evenements ou l'utilisateur est organisateur ou co-organisateur
  const { data: pastEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['my-organized-past-events'],
    queryFn: async () => {
      const res = await apiClient.get('/events/me')
      const { createdEvents = [], joinedEvents = [] } = res.data?.data ?? {}
      const currentUserId = res.data?.data?.id
      // Uniquement les evenements crees ou co-organises
      const organizedMap = new Map()
      createdEvents.forEach((e: any) => organizedMap.set(e.id, e))
      joinedEvents.forEach((e: any) => {
        if ((e.coHostIds || []).includes(currentUserId)) {
          organizedMap.set(e.id, e)
        }
      })
      const now = new Date()
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      const past = Array.from(organizedMap.values()).filter((e: any) => {
        if (!e.endAt && !e.startAt) return false;
        const eventDate = new Date(e.endAt || e.startAt);
        return eventDate < now && eventDate > sixtyDaysAgo;
      })
      return past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    },
    enabled: !presetEventId,
  })


  const selectedEvent = presetEventId
    ? { id: presetEventId, title: eventTitle ?? '', category: eventCategory ?? '' }
    : pastEvents.find((e: any) => e.id === selectedEventId)


  // Auto-sync category when event is selected
  useEffect(() => {
    if (selectedEvent?.category && !presetEventId) {
      setCategory(selectedEvent.category);
    }
  }, [selectedEventId]);

  // Upload vers Cloudinary (direct depuis le browser)
  const handleFileSelect = async (file: File) => {
    // VÃ©rification du type
    if (!file.type.startsWith('video/')) {
      setUploadError('Seuls les fichiers vidÃ©o sont acceptÃ©s.')
      return
    }
    // Limite : 200 Mo
    if (file.size > 200 * 1024 * 1024) {
      setUploadError('La vidÃ©o est trop volumineuse (max 200 Mo).')
      return
    }

    setUploadError(null)
    setUploadProgress(0)
    setFileName(file.name)

    // Récupérer la durée
    const videoEl = document.createElement('video')
    videoEl.src = URL.createObjectURL(file)
    const isValid = await new Promise<boolean>(resolve => {
      videoEl.onloadedmetadata = () => {
        const d = Math.round(videoEl.duration)
        if (d > 30) {
          toast.error('La vidéo ne doit pas dépasser 30 secondes.')
          resolve(false)
        } else {
          setDuration(d)
          resolve(true)
        }
      }
    })
    URL.revokeObjectURL(videoEl.src)
    if (!isValid) return


    // PrÃ©-remplir le titre avec le nom du fichier sans extension
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    }

    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_VIDEO_UPLOAD_PRESET

      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', uploadPreset)
      formData.append('folder', 'event_videos')
      formData.append('resource_type', 'video')

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText)
            setUploadedUrl(result.secure_url)
            setUploadProgress(100)
            resolve()
          } else {
            console.error('Cloudinary error response:', xhr.responseText)
            let errorMessage = 'Ã‰chec de l\'envoi vers Cloudinary'
            try {
              const result = JSON.parse(xhr.responseText)
              if (result.error && result.error.message) {
                errorMessage = result.error.message
              }
            } catch (e) {}
            reject(new Error(errorMessage))
          }
        }
        xhr.onerror = () => reject(new Error('Erreur rÃ©seau lors de l\'upload'))
        xhr.send(formData)
      })
    } catch (err: any) {
      console.error('Upload Error:', err)
      setUploadProgress(null)
      setUploadError(err.message ?? 'Ã‰chec de l\'upload. RÃ©essayez sans quitter ce formulaire.')
    }
  }

  const submitMutation = useMutation({
    mutationFn: () => videosApi.create({
      eventId: selectedEventId || presetEventId!,
      url: uploadedUrl!,
      title: title.trim(),
      category: category || selectedEvent?.category || 'OTHER',
      duration,
      privacy,
    }),
    onSuccess: () => {
      toast.success('Moments forts publiÃ©s avec succÃ¨s ðŸŽ¬')
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la publication. Vos donnÃ©es sont conservÃ©es.')
    },
  })

  const canSubmit = uploadedUrl && title.trim() && (selectedEventId || presetEventId) && !submitMutation.isPending

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mt-auto bg-white dark:bg-[#111] rounded-t-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pt-6 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <div>
                <h2 className="font-bold text-[16px] text-gray-900 dark:text-white">Ajouter des moments forts</h2>
                <p className="text-[12px] text-gray-400">Partagez vos meilleurs souvenirs</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600 dark:text-white" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Sélection de l'événement — caché si pré-sélectionné */}
            {!presetEventId && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Événement *
                </label>
                {isLoadingEvents ? (
                  <div className="flex items-center gap-2 text-gray-400 text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                  </div>
                ) : pastEvents.length === 0 ? (
                  <p className="text-[12px] text-gray-400 italic">Aucun événement passé disponible.</p>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedEventId}
                      onChange={e => {
                        setSelectedEventId(e.target.value)
                        const ev = pastEvents.find((ev: any) => ev.id === e.target.value)
                        if (ev && !category) setCategory(ev.category)
                      }}
                      className="w-full appearance-none bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] text-gray-800 dark:text-white pr-10"
                    >
                      <option value="">Choisir un événement...</option>
                      {pastEvents.map((ev: any) => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* Événement pré-sélectionné (depuis EventDetails) */}
            {presetEventId && eventTitle && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-[11px] font-medium text-[#FF7A00] uppercase tracking-wide">Événement</p>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white mt-0.5">{eventTitle}</p>
              </div>
            )}

            {/* Titre */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Titre de la vidéo *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Aftermovie incroyable, Meilleurs moments..."
                maxLength={100}
                className="w-full bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/30"
              />
            </div>

            {/* Catégorie */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Catégorie *
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] text-gray-800 dark:text-white pr-10"
                >
                  <option value="">Choisir une catégorie...</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Confidentialité de la vidéo */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Confidentialité
              </label>
              <div className="flex gap-2">
                {[{ v: 'PUBLIC', label: '🌍 Public', desc: 'Tout le monde' }, { v: 'PARTICIPANTS', label: '🎟️ OUTSTERS', desc: 'OUTSTERS uniquement' }, { v: 'PRIVATE', label: '🔒 Privé', desc: 'Seulement moi' }].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setPrivacy(opt.v as any)}
                    className={`flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2 px-1 border-2 text-[11px] transition-all ${
                      privacy === opt.v
                        ? 'border-[#FF7A00] bg-orange-50 dark:bg-orange-900/20 text-[#FF7A00] font-semibold'
                        : 'border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className="text-base">{opt.label.split(' ')[0]}</span>
                    <span>{opt.label.split(' ').slice(1).join(' ')}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Zone d'upload */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Vidéo * <span className="font-normal text-gray-400">(max 200 Mo, formats mp4/mov/webm)</span>
              </label>

              {/* Upload réussi */}
              {uploadedUrl && (
                <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 rounded-xl px-4 py-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-green-800 dark:text-green-300">Upload réussi !</p>
                    <p className="text-[11px] text-green-600 dark:text-green-400 truncate">{fileName}</p>
                  </div>
                </div>
              )}

              {/* Erreur upload */}
              {uploadError && (
                <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-700 dark:text-red-300">{uploadError}</p>
                </div>
              )}

              {/* Barre de progression */}
              {uploadProgress !== null && uploadProgress < 100 && (
                <div className="mb-2">
                  <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                    <span>Envoi en cours...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF7A00] to-[#FFA755] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bouton de sélection */}
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/avi"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadProgress !== null && uploadProgress < 100}
                className="w-full border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-[#FF7A00]/50 hover:text-[#FF7A00] transition-colors disabled:opacity-50"
              >
                {uploadProgress !== null && uploadProgress < 100 ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7" />
                )}
                <span className="text-[13px] font-medium">
                  {uploadedUrl ? 'Remplacer la vidéo' : 'Choisir une vidéo'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky submit button — always visible */}
        <div
          className="px-6 pt-3 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 16px))' }}
        >
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit}
            className="w-full py-4 bg-gradient-to-r from-[#FF7A00] to-[#FFA755] text-white font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Publication...</>
            ) : (
              '🎬 Publier les moments forts'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
