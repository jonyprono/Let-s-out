import React, { useState, useRef, useEffect, UIEvent } from 'react'
import { ChevronLeft, Heart, MessageCircle, Share2, Volume2, VolumeX } from 'lucide-react'
import { App } from '@capacitor/app'
import { useNavigate } from 'react-router'
import { PagePostCommentsModal } from './PagePostCommentsModal'
import { toast } from 'sonner'

export interface PageVideoItem {
  id: string // post ID
  pageId: string
  videoUrl: string
  content?: string | null
  createdAt?: string
  page: {
    id: string
    name: string
    avatarUrl?: string | null
    creatorId?: string
  }
  likesCount?: number
  commentsCount?: number
  hasLiked?: boolean
}

interface PageVideoPlayerModalProps {
  videos: PageVideoItem[]
  initialVideoId: string
  onClose: () => void
}

export function PageVideoPlayerModal({ videos, initialVideoId, onClose }: PageVideoPlayerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialIdx = videos.findIndex((v) => v.id === initialVideoId)
  const [activeIndex, setActiveIndex] = useState(initialIdx >= 0 ? initialIdx : 0)
  const [hasScrolledToInitial, setHasScrolledToInitial] = useState(false)
  const [commentPost, setCommentPost] = useState<PageVideoItem | null>(null)

  // Capacitor & browser back button support
  useEffect(() => {
    let backButtonListener: any = null
    const setupListener = async () => {
      try {
        backButtonListener = await App.addListener('backButton', () => {
          if (commentPost) {
            setCommentPost(null)
          } else {
            onClose()
          }
        })
      } catch {
        // Not in capacitor
      }
    }
    setupListener()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (commentPost) setCommentPost(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (backButtonListener) backButtonListener.remove()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, commentPost])

  // Scroll to selected video on mount
  useEffect(() => {
    if (containerRef.current && !hasScrolledToInitial && videos.length > 0) {
      const idx = initialIdx >= 0 ? initialIdx : 0
      containerRef.current.scrollTop = idx * containerRef.current.offsetHeight
      setHasScrolledToInitial(true)
    }
  }, [hasScrolledToInitial, initialIdx, videos.length])

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const itemHeight = container.clientHeight
    if (itemHeight === 0) return
    const index = Math.round(container.scrollTop / itemHeight)
    if (index !== activeIndex && index >= 0 && index < videos.length) {
      setActiveIndex(index)
    }
  }

  if (videos.length === 0) return null

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col select-none overflow-hidden">
      {/* Top Navigation Bar */}
      <div
        className="absolute top-0 inset-x-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/15 text-white active:scale-95 transition-transform pointer-events-auto shadow-lg"
          aria-label="Retour"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>

        <div className="px-3.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 text-xs font-semibold">
          {activeIndex + 1} / {videos.length}
        </div>
      </div>

      {/* Vertical Snap Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videos.map((item, index) => (
          <PageVideoPlayerItem
            key={item.id}
            item={item}
            isActive={index === activeIndex}
            onOpenComments={() => setCommentPost(item)}
            onCloseParent={onClose}
          />
        ))}
      </div>

      {/* Comments sheet */}
      {commentPost && (
        <PagePostCommentsModal
          pageId={commentPost.pageId}
          postId={commentPost.id}
          pageName={commentPost.page.name}
          pageCreatorId={commentPost.page.creatorId}
          open={Boolean(commentPost)}
          onClose={() => setCommentPost(null)}
          onCommentAdded={() => {
            commentPost.commentsCount = (commentPost.commentsCount || 0) + 1
          }}
        />
      )}
    </div>
  )
}

function PageVideoPlayerItem({
  item,
  isActive,
  onOpenComments,
  onCloseParent,
}: {
  item: PageVideoItem
  isActive: boolean
  onOpenComments: () => void
  onCloseParent: () => void
}) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [liked, setLiked] = useState(Boolean(item.hasLiked))
  const [likesCount, setLikesCount] = useState(item.likesCount || 0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isActive) {
      video.currentTime = 0
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isActive])

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video && video.duration) {
      setProgress((video.currentTime / video.duration) * 100)
    }
  }

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLiked((prev) => {
      const next = !prev
      setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)))
      return next
    })
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (navigator.share) {
      navigator.share({
        title: item.page.name,
        text: item.content || `Vidéo publiée par ${item.page.name}`,
        url: window.location.href,
      }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(window.location.href)
      toast.success('Lien copié dans le presse-papier')
    }
  }

  return (
    <div
      className="relative w-full h-full snap-start snap-always flex flex-col justify-between overflow-hidden bg-black"
      onClick={togglePlay}
    >
      {/* Background Video */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={item.videoUrl}
          poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
          loop
          controls={false}
          playsInline
          disablePictureInPicture
          webkit-playsinline="true"
          x5-playsinline="true"
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          className="w-full h-full object-contain pointer-events-none"
        />
      </div>

      {/* Transparent overlay to capture clicks without triggering native video controls */}
      <div 
        className="absolute inset-0 z-10" 
        onClick={(e) => {
          e.stopPropagation()
          togglePlay()
        }}
      />

      {/* Center Play Button Overlay — supprimé : Android/iOS affiche son propre overlay ou flicker noir */}

      {/* Top spacer */}
      <div className="h-16 shrink-0" />

      {/* Bottom overlay with Action buttons (right rail) + Description (bottom area) */}
      <div
        className="relative z-30 w-full flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-12 px-4"
        style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-end justify-between gap-3 mb-3">
          {/* Left Column: Page info & Description right below the video */}
          <div className="flex-1 min-w-0 pr-2">
            {/* Page Header */}
            <div
              className="flex items-center gap-2.5 mb-2.5 cursor-pointer active:opacity-80"
              onClick={() => {
                onCloseParent()
                navigate(`/pages/${item.page.id}`)
              }}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/80 bg-gray-700 shrink-0 shadow-md">
                {item.page.avatarUrl ? (
                  <img src={item.page.avatarUrl} alt={item.page.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-white text-xs bg-[#FF7A00]">
                    {item.page.name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[15px] text-white leading-tight truncate drop-shadow">
                  {item.page.name}
                </p>
                <span className="text-[11px] text-white/70 font-medium">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Publication'}
                </span>
              </div>
            </div>

            {/* Description of the video right below the video */}
            {item.content ? (
              <div className="bg-black/50 backdrop-blur-md rounded-2xl p-3 border border-white/10 max-h-36 overflow-y-auto">
                <p className="text-[13.5px] text-white/95 leading-relaxed whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>
            ) : (
              <div className="bg-black/40 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/5 inline-block">
                <p className="text-xs text-white/80 italic">
                  Vidéo publiée par {item.page.name}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Interaction Action Buttons */}
          <div className="flex flex-col items-center gap-4 shrink-0 pb-1">
            {/* Mute button */}
            <button
              onClick={toggleMute}
              className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center text-white active:scale-95 transition-transform shadow-md"
              title={isMuted ? 'Activer le son' : 'Couper le son'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>

            {/* Like button */}
            <button
              onClick={handleToggleLike}
              className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-md">
                <Heart
                  className={`w-5 h-5 transition-colors ${
                    liked ? 'text-red-500 fill-red-500' : 'text-white'
                  }`}
                />
              </div>
              <span className="text-white text-[11px] font-semibold drop-shadow">
                {likesCount}
              </span>
            </button>

            {/* Comment button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenComments()
              }}
              className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-md text-white">
                <MessageCircle className="w-5 h-5" />
              </div>
              <span className="text-white text-[11px] font-semibold drop-shadow">
                {item.commentsCount || 0}
              </span>
            </button>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1 group active:scale-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-md text-white">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-white text-[11px] font-medium drop-shadow">
                Partager
              </span>
            </button>
          </div>
        </div>

        {/* Video Scrubber bar at bottom */}
        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-[#FF7A00] transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
