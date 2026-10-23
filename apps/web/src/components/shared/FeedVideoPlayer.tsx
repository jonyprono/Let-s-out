import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface FeedVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  maxHeight?: string;
  objectFit?: 'cover' | 'contain';
  onExpand?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function FeedVideoPlayer({
  src,
  poster,
  className = '',
  maxHeight = '280px',
  objectFit = 'cover',
  onExpand,
}: FeedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef<any>(null);

  // Auto-generate Cloudinary poster if available and poster not explicitly provided
  const derivedPoster =
    poster ||
    (src.includes('cloudinary.com') && src.includes('/video/upload/')
      ? src.replace(/\.(mp4|webm|mov|avi)$/i, '.jpg')
      : 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

  // Pause all other videos on the page when this video starts playing
  const pauseOtherVideos = useCallback(() => {
    document.querySelectorAll('video').forEach((v) => {
      if (v !== videoRef.current && !v.paused) {
        v.pause();
      }
    });
  }, []);

  const handlePlay = () => {
    setIsPlaying(true);
    pauseOtherVideos();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const triggerControlsVisibility = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2800);
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      pauseOtherVideos();
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    triggerControlsVisibility();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    triggerControlsVisibility();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
    triggerControlsVisibility();
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      if (container.requestFullscreen) {
        container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Pause automatically when scrolled away (IntersectionObserver)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.25) {
            if (videoRef.current && !videoRef.current.paused) {
              videoRef.current.pause();
            }
          }
        });
      },
      { threshold: [0, 0.25] }
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Listen for fullscreen change
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-black overflow-hidden select-none group cursor-pointer ${className}`}
      style={{ maxHeight: isFullscreen ? '100vh' : maxHeight }}
      onClick={(e) => {
        e.stopPropagation();
        togglePlay(e);
      }}
      onMouseMove={triggerControlsVisibility}
      onTouchStart={triggerControlsVisibility}
    >
      <video
        ref={videoRef}
        src={src}
        poster={derivedPoster}
        controls={false}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        disablePictureInPicture
        preload="metadata"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className={`w-full h-full pointer-events-none transition-all ${
          objectFit === 'cover' ? 'object-cover' : 'object-contain'
        }`}
        style={{ maxHeight: isFullscreen ? '100vh' : maxHeight }}
      />

      {/* Center Play Button Overlay — supprimé pour éviter l'icône grand noir natif/flicker sur mobile */}

      {/* Bottom Controls Bar (Visible when paused, or temporarily on tap/hover when playing) */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-6 pb-2.5 flex flex-col gap-1.5 transition-opacity duration-200 z-10 ${
          !isPlaying || showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber track */}
        <div className="relative w-full flex items-center h-3 cursor-pointer group/bar">
          <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF7A00] rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Action icons row */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1 hover:text-[#FF7A00] transition-colors active:scale-90"
              title={isPlaying ? 'Pause' : 'Lecture'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-white text-white" />
              ) : (
                <Play className="w-4 h-4 fill-white text-white ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleMute}
              className="p-1 hover:text-[#FF7A00] transition-colors active:scale-90"
              title={isMuted ? 'Activer le son' : 'Couper le son'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <span className="text-[11px] font-medium text-white/90 font-mono tracking-tight select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                if (onExpand) {
                  e.stopPropagation();
                  if (videoRef.current && !videoRef.current.paused) {
                    videoRef.current.pause();
                  }
                  onExpand();
                } else {
                  toggleFullscreen(e);
                }
              }}
              className="p-1 hover:text-[#FF7A00] transition-colors active:scale-90 flex items-center gap-1"
              title={onExpand ? 'Agrandir (plein écran)' : isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Agrandir Button (when onExpand provided) */}
      {onExpand && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="absolute top-2.5 right-2.5 z-20 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-md hover:bg-black/80"
        >
          <Maximize className="w-3 h-3" />
          <span>Agrandir</span>
        </button>
      )}
    </div>
  );
}
