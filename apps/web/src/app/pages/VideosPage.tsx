import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Film, X, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { videosApi, EventVideo } from '@/features/videos/api'
import { VideoCard } from '@/features/videos/components/VideoCard'
import { UploadVideoModal } from '@/features/videos/components/UploadVideoModal'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'

const CATEGORIES = [
  { key: '', label: 'Tout' },
  { key: 'MUSIC', label: '🎵 Musique' },
  { key: 'NIGHTLIFE', label: '🎉 Soirées' },
  { key: 'SPORT', label: '⚽ Sport' },
  { key: 'CULTURE', label: '🎭 Culture' },
  { key: 'ART', label: '🎨 Art' },
  { key: 'TECH', label: '💻 Tech' },
  { key: 'OTHER', label: '📌 Autre' },
]

export function VideosPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const [activeCategory, setActiveCategory] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [playingVideo, setPlayingVideo] = useState<EventVideo | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['videos', activeCategory],
    queryFn: () => videosApi.list({ category: activeCategory || undefined, timeline: 'past' }),
  })

  const videos = data?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: string) => videosApi.delete(id),
    onSuccess: () => {
      toast.success('Vidéo supprimée')
      qc.invalidateQueries({ queryKey: ['videos'] })
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  })

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-[#111]" id="videos-page">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-6 pb-3 border-b border-gray-100 dark:border-white/5 flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-white" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-[17px] text-gray-900 dark:text-white">Moments Forts</h1>
          <p className="text-[12px] text-gray-400">Vidéos de vos événements</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 bg-[#FF7A00] text-white text-[12px] font-semibold px-3 py-2 rounded-full"
        >
          <Film className="w-4 h-4" />
          Publier
        </button>
      </div>

      {/* Filtres catégorie */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto hide-scrollbar flex-shrink-0 border-b border-gray-100 dark:border-white/5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-[#FF7A00] text-white'
                : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center mb-4">
              <Film className="w-9 h-9 text-[#FF7A00]" />
            </div>
            <p className="font-bold text-[16px] text-gray-800 dark:text-white">Aucune vidéo</p>
            <p className="text-[13px] text-gray-400 mt-1 max-w-[240px]">
              Publiez vos moments forts depuis vos événements passés !
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 px-6 py-3 bg-[#FF7A00] text-white font-semibold rounded-2xl"
            >
              Publier ma première vidéo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {videos.map(v => (
              <div key={v.id} className="relative">
                <VideoCard video={v} onClick={setPlayingVideo} />
                {v.userId === currentUser?.id && (
                  <button
                    onClick={() => {
                      if (window.confirm('Supprimer cette vidéo ?')) deleteMutation.mutate(v.id)
                    }}
                    className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setPlayingVideo(null)}
        >
          <button
            onClick={() => setPlayingVideo(null)}
            className="absolute top-safe-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <video
            src={playingVideo.url}
            autoPlay
            controls
            className="max-w-full max-h-full"
            onClick={e => e.stopPropagation()}
          />
          <div className="absolute bottom-safe-4 left-4 right-4 text-center">
            <p className="text-white font-semibold text-[15px] drop-shadow">{playingVideo.title}</p>
            <p className="text-white/70 text-[12px]">{playingVideo.event.title}</p>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadVideoModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['videos'] })}
        />
      )}
    </div>
  )
}
