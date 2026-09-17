import { useState, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Film, ChevronDown } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { videosApi } from '@/features/videos/api'
import { toast } from 'sonner'

const CATEGORY_LABELS: Record<string, string> = {
  MUSIC: 'ðŸŽµ Musique',
  NIGHTLIFE: 'ðŸŽ‰ SoirÃ©es',
  SPORT: 'âš½ Sport',
  CULTURE: 'ðŸŽ­ Culture',
  FOOD: 'ðŸ½ï¸ Gastronomie',
  ART: 'ðŸŽ¨ Art',
  TECH: 'ðŸ’» Tech',
  GAMING: 'ðŸŽ® Gaming',
  WELLNESS: 'ðŸ§˜ Bien-Ãªtre',
  TRAVEL: 'âœˆï¸ Voyage',
  SOCIAL: 'ðŸ‘¥ Social',
  SCIENCE: 'ðŸ”¬ Science',
  LIFESTYLE: 'ðŸŒŸ Lifestyle',
  TOURISM: 'ðŸ—ºï¸ Tourisme',
  OTHER: 'ðŸ“Œ Autre',
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

  // RÃ©cupÃ¨re les Ã©vÃ©nements crÃ©Ã©s et rejoints par l'utilisateur
  const { data: pastEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['my-past-participated-events'],
    queryFn: async () => {
      const res = await apiClient.get('/events/me')
      const { createdEvents = [], joinedEvents = [] } = res.data?.data ?? {}
      
      // Combiner sans doublons
      const allEventsMap = new Map()
      createdEvents.forEach((e: any) => allEventsMap.set(e.id, e))
      joinedEvents.forEach((e: any) => allEventsMap.set(e.id, e))
      
      const now = new Date()
      // Filtrer les Ã©vÃ©nements passÃ©s (mais pas trop, ex: depuis moins de 60 jours)
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
      
      const past = Array.from(allEventsMap.values()).filter((e: any) => {
        if (!e.endAt && !e.startAt) return false;
        const eventDate = new Date(e.endAt || e.startAt);
        return eventDate < now && eventDate > sixtyDaysAgo;
      })
      
      // Trier par date la plus rÃ©cente
      return past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    },
    enabled: !presetEventId,
  })

  const selectedEvent = presetEventId
    ? { id: presetEventId, title: eventTitle ?? '', category: eventCategory ?? '' }
    : pastEvents.find((e: any) => e.id === selectedEventId)

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

    // RÃ©cupÃ©rer la durÃ©e
    const videoEl = document.createElement('video')
    videoEl.src = URL.createObjectURL(file)
    await new Promise<void>(resolve => {
      videoEl.onloadedmetadata = () => {
        setDuration(Math.round(videoEl.duration))
        resolve()
      }
    })
    URL.revokeObjectURL(videoEl.src)

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
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
            {/* SÃ©lection de l'Ã©vÃ©nement â€” cachÃ© si prÃ©-sÃ©lectionnÃ© */}
            {!presetEventId && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Ã‰vÃ©nement *
                </label>
                {isLoadingEvents ? (
                  <div className="flex items-center gap-2 text-gray-400 text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                  </div>
                ) : pastEvents.length === 0 ? (
                  <p className="text-[12px] text-gray-400 italic">Aucun Ã©vÃ©nement passÃ© disponible.</p>
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
                      <option value="">Choisir un Ã©vÃ©nement...</option>
                      {pastEvents.map((ev: any) => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>
            )}

            {/* Ã‰vÃ©nement prÃ©-sÃ©lectionnÃ© (depuis EventDetails) */}
            {presetEventId && eventTitle && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-[11px] font-medium text-[#FF7A00] uppercase tracking-wide">Ã‰vÃ©nement</p>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white mt-0.5">{eventTitle}</p>
              </div>
            )}

            {/* Titre */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Titre de la vidÃ©o *
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

            {/* CatÃ©gorie */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                CatÃ©gorie *
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-[14px] text-gray-800 dark:text-white pr-10"
                >
                  <option value="">Choisir une catÃ©gorie...</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Zone d'upload */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                VidÃ©o * <span className="font-normal text-gray-400">(max 200 Mo, formats mp4/mov/webm)</span>
              </label>

              {/* Upload rÃ©ussi */}
              {uploadedUrl && (
                <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 rounded-xl px-4 py-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-green-800 dark:text-green-300">Upload rÃ©ussi !</p>
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
                  <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF7A00] to-[#FFA755] rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bouton de sÃ©lection */}
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
                  {uploadedUrl ? 'Remplacer la vidÃ©o' : 'Choisir une vidÃ©o'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky submit button â€” always visible */}
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
              'ðŸŽ¬ Publier les moments forts'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

