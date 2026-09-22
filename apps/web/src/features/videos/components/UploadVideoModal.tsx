import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Film, ChevronDown, Images, Music, Trash2, Plus } from 'lucide-react'
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
  eventId?: string
  eventTitle?: string
  eventCategory?: string
  onClose: () => void
  onSuccess: () => void
}

export function UploadVideoModal({ eventId: presetEventId, eventTitle, eventCategory, onClose, onSuccess }: UploadVideoModalProps) {
  const videoFileRef = useRef<HTMLInputElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)
  const audioFileRef = useRef<HTMLInputElement>(null)

  // Mode: 'video' | 'slideshow'
  const [mode, setMode] = useState<'video' | 'slideshow'>('video')

  // Form state
  const [title, setTitle] = useState('')
  const [selectedEventId, setSelectedEventId] = useState(presetEventId ?? '')
  const [category, setCategory] = useState(eventCategory ?? '')
  const [privacy, setPrivacy] = useState<'PUBLIC' | 'PARTICIPANTS' | 'PRIVATE'>('PUBLIC')

  // Video upload state
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number>(0)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // Slideshow state
  const [slidePhotos, setSlidePhotos] = useState<{ file: File; previewUrl: string }[]>([])
  const [slideAudioFile, setSlideAudioFile] = useState<File | null>(null)
  const [slideAudioName, setSlideAudioName] = useState<string | null>(null)
  const [slideDurationPerPhoto, setSlideDurationPerPhoto] = useState(3)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [slideUploadProgress, setSlideUploadProgress] = useState<number | null>(null)

  const { data: pastEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['my-organized-past-events'],
    queryFn: async () => {
      const res = await apiClient.get('/events/me')
      const { createdEvents = [], joinedEvents = [] } = res.data?.data ?? {}
      const currentUserId = res.data?.data?.id
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
        if (!e.endAt && !e.startAt) return false
        const eventDate = new Date(e.endAt || e.startAt)
        return eventDate < now && eventDate > sixtyDaysAgo
      })
      return past.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    },
    enabled: !presetEventId,
  })

  const selectedEvent = presetEventId
    ? { id: presetEventId, title: eventTitle ?? '', category: eventCategory ?? '' }
    : pastEvents.find((e: any) => e.id === selectedEventId)

  useEffect(() => {
    if (selectedEvent?.category && !presetEventId) {
      setCategory(selectedEvent.category)
    }
  }, [selectedEventId])

  // ───────────────────────────────── VIDEO MODE ─────────────────────────────────
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setUploadError('Seuls les fichiers vidéo sont acceptés.')
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      setUploadError('La vidéo est trop volumineuse (max 200 Mo).')
      return
    }

    setUploadError(null)
    setUploadProgress(0)  // Affiche immédiatement la barre à 0%
    setFileName(file.name)
    setUploadedUrl(null)

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
    if (!isValid) {
      setUploadProgress(null)
      return
    }

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
            let errorMessage = 'Échec de l\'envoi vers Cloudinary'
            try {
              const result = JSON.parse(xhr.responseText)
              if (result.error?.message) errorMessage = result.error.message
            } catch {}
            reject(new Error(errorMessage))
          }
        }
        xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload'))
        xhr.send(formData)
      })
    } catch (err: any) {
      setUploadProgress(null)
      setUploadError(err.message ?? 'Échec de l\'upload. Réessayez sans quitter ce formulaire.')
    }
  }

  // ────────────────────────────── SLIDESHOW MODE ────────────────────────────────
  const handlePhotosSelect = (files: FileList) => {
    const newPhotos = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }))
    setSlidePhotos(prev => [...prev, ...newPhotos].slice(0, 12)) // max 12 photos
  }

  const removePhoto = (idx: number) => {
    setSlidePhotos(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // Generate slideshow video using Canvas + MediaRecorder
  const generateSlideshow = useCallback(async (): Promise<File | null> => {
    if (slidePhotos.length === 0) {
      toast.error('Ajoutez au moins une photo.')
      return null
    }

    setIsGenerating(true)
    setGenerationProgress(0)

    const W = 1080, H = 1080
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!

    const stream = canvas.captureStream(30)

    // Add audio track if provided
    let audioContext: AudioContext | null = null
    let audioSource: MediaElementAudioSourceNode | null = null
    let audioDestination: MediaStreamAudioDestinationNode | null = null
    let audioEl: HTMLAudioElement | null = null

    if (slideAudioFile) {
      try {
        audioContext = new AudioContext()
        audioEl = new Audio(URL.createObjectURL(slideAudioFile))
        audioEl.loop = true
        audioSource = audioContext.createMediaElementSource(audioEl)
        audioDestination = audioContext.createMediaStreamDestination()
        audioSource.connect(audioDestination)
        audioSource.connect(audioContext.destination)
        audioDestination.stream.getAudioTracks().forEach(track => stream.addTrack(track))
        await audioEl.play()
      } catch (e) {
        console.warn('Audio not available:', e)
      }
    }

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4'

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

    recorder.start(100)

    // Load all images
    const images = await Promise.all(
      slidePhotos.map(p => new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = rej
        img.src = p.previewUrl
      }))
    )

    // Draw each photo for `slideDurationPerPhoto` seconds
    const totalDuration = Math.min(slidePhotos.length * slideDurationPerPhoto, 30)
    const fps = 30
    const framesPerPhoto = slideDurationPerPhoto * fps

    let frame = 0
    const totalFrames = Math.round(totalDuration * fps)

    await new Promise<void>(resolve => {
      const drawFrame = () => {
        const photoIndex = Math.min(Math.floor(frame / framesPerPhoto), images.length - 1)
        const img = images[photoIndex]

        // Fill black background
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, W, H)

        // Draw image cover-fit
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
        const sw = img.naturalWidth * scale
        const sh = img.naturalHeight * scale
        ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh)

        // Subtle slide transition (fade at borders)
        const localFrame = frame % framesPerPhoto
        if (localFrame < fps * 0.4) {
          const alpha = 1 - localFrame / (fps * 0.4)
          ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`
          ctx.fillRect(0, 0, W, H)
        }

        frame++
        setGenerationProgress(Math.round((frame / totalFrames) * 80))

        if (frame < totalFrames) {
          requestAnimationFrame(drawFrame)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(drawFrame)
    })

    recorder.stop()
    if (audioEl) { audioEl.pause(); URL.revokeObjectURL(audioEl.src) }
    if (audioContext) audioContext.close()

    await new Promise<void>(resolve => { recorder.onstop = () => resolve() })

    setGenerationProgress(90)
    const blob = new Blob(chunks, { type: mimeType })
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const file = new File([blob], `diaporama_${Date.now()}.${ext}`, { type: mimeType })
    setIsGenerating(false)
    return file
  }, [slidePhotos, slideAudioFile, slideDurationPerPhoto])

  const handleSlideshowUpload = async () => {
    if (!title.trim()) { toast.error('Ajoutez un titre.'); return }
    if (!(selectedEventId || presetEventId)) { toast.error('Choisissez un événement.'); return }

    const videoFile = await generateSlideshow()
    if (!videoFile) return

    setSlideUploadProgress(0)
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_VIDEO_UPLOAD_PRESET
      const formData = new FormData()
      formData.append('file', videoFile)
      formData.append('upload_preset', uploadPreset)
      formData.append('folder', 'event_videos')
      formData.append('resource_type', 'video')

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setSlideUploadProgress(Math.round((e.loaded / e.total) * 100))
      }
      const result = await new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText))
          else reject(new Error('Échec de l\'upload Cloudinary'))
        }
        xhr.onerror = () => reject(new Error('Erreur réseau'))
        xhr.send(formData)
      })
      setSlideUploadProgress(100)

      // Save to backend
      await videosApi.create({
        eventId: selectedEventId || presetEventId!,
        url: result.secure_url,
        title: title.trim(),
        category: category || selectedEvent?.category || 'OTHER',
        duration: Math.min(slidePhotos.length * slideDurationPerPhoto, 30),
        privacy,
      })
      toast.success('Diaporama publié avec succès 🎬')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la publication du diaporama.')
      setSlideUploadProgress(null)
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
      toast.success('Moments forts publiés avec succès 🎬')
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'Erreur lors de la publication.')
    },
  })

  const canSubmitVideo = uploadedUrl && title.trim() && (selectedEventId || presetEventId) && !submitMutation.isPending
  const canSubmitSlideshow = slidePhotos.length > 0 && title.trim() && (selectedEventId || presetEventId) && !isGenerating && slideUploadProgress === null

  const isUploading = uploadProgress !== null && uploadProgress < 100

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mt-auto bg-white dark:bg-[#111] rounded-t-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pt-6 pb-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
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

          {/* Mode Tabs */}
          <div className="flex bg-gray-100 dark:bg-white/10 rounded-xl p-1 mb-5">
            <button
              onClick={() => setMode('video')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${mode === 'video' ? 'bg-white dark:bg-[#222] text-[#FF7A00] shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Film className="w-4 h-4" />
              Vidéo
            </button>
            <button
              onClick={() => setMode('slideshow')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-semibold transition-all ${mode === 'slideshow' ? 'bg-white dark:bg-[#222] text-[#FF7A00] shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <Images className="w-4 h-4" />
              Diaporama
            </button>
          </div>

          <div className="space-y-4">
            {/* Event selector */}
            {!presetEventId && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Événement *</label>
                {isLoadingEvents ? (
                  <div className="flex items-center gap-2 text-gray-400 text-[13px]"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</div>
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

            {presetEventId && eventTitle && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-500/20 rounded-xl px-4 py-3">
                <p className="text-[11px] font-medium text-[#FF7A00] uppercase tracking-wide">Événement</p>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white mt-0.5">{eventTitle}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                {mode === 'video' ? 'Titre de la vidéo *' : 'Titre du diaporama *'}
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

            {/* Category */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Catégorie *</label>
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

            {/* Privacy */}
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Confidentialité</label>
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

            {/* ─────────── VIDEO MODE ─────────── */}
            {mode === 'video' && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Vidéo * <span className="font-normal text-gray-400">(max 30s, formats mp4/mov/webm)</span>
                </label>

                {/* Success */}
                {uploadedUrl && !isUploading && (
                  <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/20 rounded-xl px-4 py-3 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-green-800 dark:text-green-300">Upload réussi !</p>
                      <p className="text-[11px] text-green-600 dark:text-green-400 truncate">{fileName}</p>
                    </div>
                  </div>
                )}

                {/* Error */}
                {uploadError && (
                  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-red-700 dark:text-red-300">{uploadError}</p>
                  </div>
                )}

                {/* Progress bar — visible as soon as file is selected */}
                {uploadProgress !== null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span className="font-medium">{uploadProgress < 100 ? 'Envoi en cours...' : 'Envoi terminé ✓'}</span>
                      <span className="font-bold text-[#FF7A00]">{uploadProgress}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(uploadProgress, 3)}%`,
                          background: uploadProgress === 100
                            ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                            : 'linear-gradient(90deg, #FF7A00, #FFA755)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* File input */}
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/avi"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <button
                  onClick={() => videoFileRef.current?.click()}
                  disabled={isUploading}
                  className="w-full border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-[#FF7A00]/50 hover:text-[#FF7A00] transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                  <span className="text-[13px] font-medium">
                    {uploadedUrl ? 'Remplacer la vidéo' : isUploading ? 'Envoi en cours...' : 'Choisir une vidéo'}
                  </span>
                </button>
              </div>
            )}

            {/* ─────────── SLIDESHOW MODE ─────────── */}
            {mode === 'slideshow' && (
              <div className="space-y-4">
                {/* Photos grid */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">
                      Photos * <span className="font-normal text-gray-400">({slidePhotos.length}/12)</span>
                    </label>
                    {slidePhotos.length > 0 && (
                      <span className="text-[11px] text-gray-400">Appui long pour réordonner</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {slidePhotos.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                        <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                          <span className="text-[10px] text-white font-bold">{i + 1}</span>
                        </div>
                      </div>
                    ))}
                    {slidePhotos.length < 12 && (
                      <button
                        onClick={() => photoFileRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-gray-400 hover:border-[#FF7A00]/50 hover:text-[#FF7A00] transition-colors"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                  <input
                    ref={photoFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => e.target.files && handlePhotosSelect(e.target.files)}
                  />
                </div>

                {/* Duration per photo */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Durée par photo : <span className="text-[#FF7A00]">{slideDurationPerPhoto}s</span>
                    <span className="ml-2 font-normal text-gray-400">(total : {Math.min(slidePhotos.length * slideDurationPerPhoto, 30)}s)</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, Math.floor(30 / Math.max(slidePhotos.length, 1)))}
                    value={slideDurationPerPhoto}
                    onChange={e => setSlideDurationPerPhoto(Number(e.target.value))}
                    className="w-full accent-[#FF7A00]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>1s</span>
                    <span>{Math.max(1, Math.floor(30 / Math.max(slidePhotos.length, 1)))}s max</span>
                  </div>
                </div>

                {/* Audio */}
                <div>
                  <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Son de fond <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    ref={audioFileRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setSlideAudioFile(f); setSlideAudioName(f.name) }
                    }}
                  />
                  {slideAudioName ? (
                    <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3">
                      <Music className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      <p className="text-[13px] text-blue-700 dark:text-blue-300 flex-1 truncate">{slideAudioName}</p>
                      <button onClick={() => { setSlideAudioFile(null); setSlideAudioName(null) }}>
                        <Trash2 className="w-4 h-4 text-blue-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => audioFileRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl py-4 flex items-center justify-center gap-2 text-gray-400 hover:border-[#FF7A00]/50 hover:text-[#FF7A00] transition-colors"
                    >
                      <Music className="w-5 h-5" />
                      <span className="text-[13px] font-medium">Ajouter une musique</span>
                    </button>
                  )}
                </div>

                {/* Generation progress */}
                {isGenerating && (
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span className="font-medium">Génération du diaporama...</span>
                      <span className="font-bold text-[#FF7A00]">{generationProgress}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(generationProgress, 3)}%`, background: 'linear-gradient(90deg, #9747FF, #FF7A00)' }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1 text-center">Veuillez patienter, ne fermez pas cette fenêtre</p>
                  </div>
                )}

                {/* Upload progress for slideshow */}
                {!isGenerating && slideUploadProgress !== null && (
                  <div>
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span className="font-medium">{slideUploadProgress < 100 ? 'Envoi en cours...' : 'Envoi terminé ✓'}</span>
                      <span className="font-bold text-[#FF7A00]">{slideUploadProgress}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(slideUploadProgress, 3)}%`,
                          background: slideUploadProgress === 100
                            ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                            : 'linear-gradient(90deg, #FF7A00, #FFA755)',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sticky submit button */}
        <div
          className="px-6 pt-3 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#111] shrink-0"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 16px))' }}
        >
          {mode === 'video' ? (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmitVideo}
              className="w-full py-4 bg-gradient-to-r from-[#FF7A00] to-[#FFA755] text-white font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
            >
              {submitMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Publication...</>
              ) : (
                '🎬 Publier les moments forts'
              )}
            </button>
          ) : (
            <button
              onClick={handleSlideshowUpload}
              disabled={!canSubmitSlideshow}
              className="w-full py-4 bg-gradient-to-r from-[#9747FF] to-[#FF7A00] text-white font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
            >
              {isGenerating || slideUploadProgress !== null ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {isGenerating ? 'Génération...' : 'Publication...'}</>
              ) : (
                '🖼️ Créer et publier le diaporama'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
