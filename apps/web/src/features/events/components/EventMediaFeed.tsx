import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Media {
  id: string;
  type: string;
  url: string;
  thumbnail?: string;
  user: { profile?: { displayName: string; avatarUrl?: string } };
  event: { id: string; title: string; coverUrl?: string };
}

export function EventMediaFeed() {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: medias = [], isLoading } = useQuery({
    queryKey: ['feed', 'media'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Media[] }>('/feed/media');
      return res.data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-hidden px-4 py-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-[100px] h-[160px] bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse shrink-0" />
        ))}
      </div>
    );
  }

  if (medias.length === 0) return null;

  return (
    <div className="py-2">
      <div className="px-4 mb-2 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-gray-900 dark:text-white font-poppins">Moments forts 📹</h2>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {medias.map((media) => (
          <div 
            key={media.id} 
            onClick={() => navigate(`/events/${media.event.id}`)}
            className="relative w-[110px] h-[180px] rounded-[18px] overflow-hidden shrink-0 snap-start bg-gray-900 cursor-pointer shadow-sm border border-gray-100 dark:border-white/10"
          >
            {media.type === 'video' ? (
              <>
                <video 
                  src={media.url} 
                  poster={media.thumbnail || media.event.coverUrl}
                  className="w-full h-full object-cover opacity-90"
                  muted
                  loop
                  autoPlay
                  playsInline
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white/80 drop-shadow-md" fill="currentColor" />
                </div>
              </>
            ) : (
              <img src={media.url} alt="" className="w-full h-full object-cover" />
            )}
            
            {/* Overlay gradient */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
            
            {/* User info */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-white/50 bg-gray-500 shrink-0">
                {media.user.profile?.avatarUrl ? (
                  <img src={media.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white">
                    {media.user.profile?.displayName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <p className="text-[11px] font-medium text-white truncate drop-shadow-md">
                {media.event.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
