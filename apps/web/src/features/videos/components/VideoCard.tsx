import { Play } from 'lucide-react'
import { EventVideo, formatDuration } from '@/features/videos/api'

interface VideoCardProps {
  video: EventVideo
  onClick: (video: EventVideo) => void
  size?: 'sm' | 'md'
}

export function VideoCard({ video, onClick, size = 'md' }: VideoCardProps) {
  const isSmall = size === 'sm'

  return (
    <div
      onClick={() => onClick(video)}
      className={`relative flex-shrink-0 cursor-pointer rounded-2xl overflow-hidden bg-gray-900 group ${
        isSmall ? 'w-[140px]' : 'w-full'
      }`}
    >
      {/* Thumbnail */}
      <div className={`relative w-full ${isSmall ? 'h-[200px]' : 'aspect-video'}`}>
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center">
            <Play className="w-8 h-8 text-white/40" />
          </div>
        )}

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/75 rounded px-1.5 py-0.5 text-white text-[11px] font-mono font-medium">
          {formatDuration(video.duration)}
        </div>
      </div>

      {/* Info */}
      {!isSmall && (
        <div className="p-3">
          <p className="font-semibold text-[13px] text-gray-900 dark:text-white leading-tight line-clamp-2">
            {video.title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">
            {video.event.title} • {video.event.city ?? ''}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {video.user.profile?.avatarUrl ? (
              <img
                src={video.user.profile.avatarUrl}
                alt=""
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-[8px] font-bold text-[#FF7A00]">
                {video.user.profile?.displayName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-[11px] text-gray-400">
              {video.user.profile?.displayName ?? 'Utilisateur'}
            </span>
          </div>
        </div>
      )}

      {/* Small size: title below */}
      {isSmall && (
        <div className="p-2">
          <p className="font-medium text-[11px] text-gray-900 dark:text-white leading-tight line-clamp-2">
            {video.title}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{video.event.title}</p>
        </div>
      )}
    </div>
  )
}

/** Carrousel horizontal de vidéos pour la page d'accueil */
interface VideoCarouselProps {
  videos: EventVideo[]
  onVideoClick: (video: EventVideo) => void
  onSeeAll: () => void
}

export function VideoCarousel({ videos, onVideoClick, onSeeAll }: VideoCarouselProps) {
  if (videos.length === 0) return null

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="font-bold text-[16px] text-gray-900 dark:text-white">
          🎬 Moments forts
        </h2>
        <button
          onClick={onSeeAll}
          className="text-[13px] font-medium text-[#FF7A00]"
        >
          Voir tout
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar px-4 pb-2">
        {videos.map(v => (
          <VideoCard key={v.id} video={v} onClick={onVideoClick} size="sm" />
        ))}
      </div>
    </section>
  )
}
