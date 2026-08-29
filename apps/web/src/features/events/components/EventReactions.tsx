import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface ReactionData {
  count: number;
  users: Array<{ id: string; profile?: { displayName: string } }>;
}

export function EventReactions({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null);

  const { data: reactions, isLoading } = useQuery({
    queryKey: ['events', eventId, 'reactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Record<string, ReactionData> }>(`/events/${eventId}/reactions`);
      return res.data;
    }
  });

  const mutation = useMutation({
    mutationFn: async (emoji: string) => {
      const res = await apiClient.post<{ success: boolean; action: string }>(`/events/${eventId}/reactions`, { emoji });
      return { emoji, action: res.action };
    },
    onMutate: async (emoji) => {
      setAnimatingEmoji(emoji);
      setTimeout(() => setAnimatingEmoji(null), 1000);
      
      // Optimsitic update
      await queryClient.cancelQueries({ queryKey: ['events', eventId, 'reactions'] });
      const previousReactions = queryClient.getQueryData(['events', eventId, 'reactions']);
      
      queryClient.setQueryData(['events', eventId, 'reactions'], (old: Record<string, ReactionData> | undefined) => {
        const newData = { ...(old || {}) };
        if (!newData[emoji]) newData[emoji] = { count: 0, users: [] };
        // We blindly increment for optimistic update (actual sync happens onSettled)
        newData[emoji].count += 1;
        return newData;
      });

      return { previousReactions };
    },
    onError: (_err, _emoji, context) => {
      if (context?.previousReactions) {
        queryClient.setQueryData(['events', eventId, 'reactions'], context.previousReactions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'reactions'] });
    }
  });

  const emojis = ['❤️', '🔥', '😍', '👀', '🎉'];

  if (isLoading) return <div className="h-8 animate-pulse bg-gray-200 dark:bg-gray-800 rounded-full w-48" />;

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {emojis.map((emoji) => {
        const count = reactions?.[emoji]?.count || 0;
        return (
          <button
            key={emoji}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); mutation.mutate(emoji); }}
            disabled={mutation.isPending && animatingEmoji === emoji}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium
              transition-all duration-200 
              ${count > 0 ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white' : 'bg-transparent text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'}
            `}
          >
            <span className={`text-[15px] ${animatingEmoji === emoji ? 'animate-bounce' : ''}`}>{emoji}</span>
            {count > 0 && <span>{count}</span>}
            
            {animatingEmoji === emoji && (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-ping opacity-0">
                {emoji}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
