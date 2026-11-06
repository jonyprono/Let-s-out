import { useState, useRef, useEffect, useLayoutEffect, UIEvent } from 'react';
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
  const isReadyRef = useRef(false);
  
  // Find the initial index based on the ID passed
  const initialIdx = Math.max(0, videos.findIndex(v => v.id === initialVideoId));
  const [activeIndex, setActiveIndex] = useState(initialIdx);
  const [snapEnabled, setSnapEnabled] = useState(false);

  // Position immediately on the clicked video without black scroll void or snap jump
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || videos.length === 0) return;

    const itemHeight = container.clientHeight || window.innerHeight;
    container.scrollTop = initialIdx * itemHeight;

    const targetChild = container.children[initialIdx] as HTMLElement;
    if (targetChild && typeof targetChild.scrollIntoView === 'function') {
      targetChild.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    // Enable scroll snap and active tracking only after initial scroll has settled
    const timer = setTimeout(() => {
      isReadyRef.current = true;
      setSnapEnabled(true);
    }, 40);

    return () => clearTimeout(timer);
  }, [initialIdx, videos.length]);

  useEffect(() => {
    // Intercept native back button using Capacitor App
    let backButtonListener: any = null;
    
    const setupListener = async () => {
      try {
        backButtonListener = await App.addListener('backButton', () => {
          onClose();
        });
      } catch {
        // Not native
      }
    };
    
    setupListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [onClose]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    // Ignore false scroll events during initial mount
    if (!isReadyRef.current) return;

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
    <div className="fixed inset-0 z-[100] bg-black flex flex-col h-[100dvh] w-full overflow-hidden select-none">
      {/* Global Close Button — placed high to avoid Android nav bar overlap */}
      <button
        onClick={onClose}
        className="absolute top-10 left-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 active:scale-95 transition-transform"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 40px)' }}
        aria-label="Fermer"
      >
        <ChevronLeft className="w-7 h-7 text-white" strokeWidth={2.5} />
      </button>

      {/* Snap Scroll Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 w-full h-full overflow-y-scroll ${snapEnabled ? 'snap-y snap-mandatory' : ''}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {videos.map((video, index) => (
          <VideoPlayerItem
            key={video.id}
            video={video}
            isActive={index === activeIndex}
            isNear={Math.abs(index - activeIndex) <= 1}
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
