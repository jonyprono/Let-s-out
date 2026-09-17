import { useState, useRef, useEffect, UIEvent } from 'react';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { App } from '@capacitor/app';
import { EventVideo } from '../api';
import { VideoPlayerItem } from './VideoPlayerItem';

interface Props {
  videos: EventVideo[];
  initialVideoId: string;
  onClose: () => void;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
}

export function VideoPlayerModal({ videos, initialVideoId, onClose, onEndReached, isLoadingMore }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Find the initial index based on the ID passed
  const initialIdx = videos.findIndex(v => v.id === initialVideoId);
  const [activeIndex, setActiveIndex] = useState(initialIdx >= 0 ? initialIdx : 0);

  // Initialize scroll position on mount
  const [hasScrolledToInitial, setHasScrolledToInitial] = useState(false);

  useEffect(() => {
    // Intercept native back button using Capacitor App
    let backButtonListener: any = null;
    
    const setupListener = async () => {
      backButtonListener = await App.addListener('backButton', () => {
        onClose();
      });
    };
    
    setupListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [onClose]);

  useEffect(() => {
    if (containerRef.current && !hasScrolledToInitial && videos.length > 0) {
      const idx = initialIdx >= 0 ? initialIdx : 0;
      // Use offsetHeight which represents the height of one item (100vh)
      containerRef.current.scrollTop = idx * containerRef.current.offsetHeight;
      setHasScrolledToInitial(true);
    }
  }, [hasScrolledToInitial, initialIdx, videos.length]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const itemHeight = container.clientHeight;
    
    // Ensure itemHeight is valid to avoid division by zero
    if (itemHeight === 0) return;
    
    const scrollTop = container.scrollTop;
    
    // Calculate which item is currently most visible
    const index = Math.round(scrollTop / itemHeight);
    
    if (index !== activeIndex && index >= 0 && index < videos.length) {
      setActiveIndex(index);
    }

    // Trigger onEndReached if we are near the bottom (e.g. within 2 items of the end)
    if (onEndReached && !isLoadingMore) {
      if (scrollTop + itemHeight >= container.scrollHeight - itemHeight * 1.5) {
        onEndReached();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Global Close Button */}
      <button
        onClick={onClose}
        className="absolute top-safe-4 left-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10"
      >
        <ChevronLeft className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>

      {/* Snap Scroll Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videos.map((video, index) => (
          <VideoPlayerItem
            key={video.id}
            video={video}
            isActive={index === activeIndex}
          />
        ))}

        {/* Loading Indicator at the end */}
        {isLoadingMore && (
          <div className="w-full h-24 shrink-0 flex items-center justify-center snap-start">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        )}
      </div>
    </div>
  );
}
