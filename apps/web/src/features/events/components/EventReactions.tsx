import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

interface ReactionData {
  count: number;
  users: Array<{ id: string; profile?: { displayName: string } }>;
}

export function EventReactions({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s: any) => s.user);
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null);

  const { data: reactions, isLoading } = useQuery({
    queryKey: ['events', eventId, 'reactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Record<string, ReactionData> }>(`/events/${eventId}/reactions`);
      return res.data.data;
    },
    staleTime: 15_000,
  });

  // Identifie quel emoji l'utilisateur courant a choisi
  const myEmoji = currentUser && reactions
    ? Object.entries(reactions).find(([_, data]) => data?.users?.some(u => u.id === currentUser.id))?.[0] ?? null
    : null;

  const mutation = useMutation({
    mutationFn: async (emoji: string) => {
      const res = await apiClient.post<{ success: boolean; action: string; data?: unknown }>(
        `/events/${eventId}/reactions`,
        { emoji }
      );
      return { emoji, action: res.data.action || 'added' };
    },
    onMutate: async (emoji) => {
      setAnimatingEmoji(emoji);
      setTimeout(() => setAnimatingEmoji(null), 800);

      // Annuler les requêtes en cours pour éviter d'écraser l'update optimiste
      await queryClient.cancelQueries({ queryKey: ['events', eventId, 'reactions'] });
      const previousReactions = queryClient.getQueryData<Record<string, ReactionData>>(['events', eventId, 'reactions']);

      queryClient.setQueryData<Record<string, ReactionData>>(['events', eventId, 'reactions'], (old) => {
        const next: Record<string, ReactionData> = {};
        if (old) {
          for (const [key, val] of Object.entries(old)) {
            next[key] = { count: val.count, users: [...(val.users || [])] };
          }
        }

        const isRemoving = myEmoji === emoji;

        if (isRemoving) {
          // Clique sur la même réaction déjà active → suppression (toggle off)
          if (next[emoji]) {
            next[emoji].count = Math.max(0, next[emoji].count - 1);
            if (currentUser) {
              next[emoji].users = next[emoji].users.filter(u => u.id !== currentUser.id);
            }
          }
        } else {
          // Si l'utilisateur avait déjà une autre réaction, on la retire d'abord
          if (myEmoji && next[myEmoji]) {
            next[myEmoji].count = Math.max(0, next[myEmoji].count - 1);
            if (currentUser) {
              next[myEmoji].users = next[myEmoji].users.filter(u => u.id !== currentUser.id);
            }
          }
          // On ajoute la nouvelle réaction
          if (!next[emoji]) next[emoji] = { count: 0, users: [] };
          next[emoji].count += 1;
          if (currentUser) {
            next[emoji].users = [...next[emoji].users, { id: currentUser.id, profile: currentUser.profile }];
          }
        }

        return next;
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

  const handleReactionClick = (emoji: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
      toast.info('Connectez-vous pour réagir à cet événement');
      return;
    }

    if (mutation.isPending) return;
    mutation.mutate(emoji);
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {emojis.map((emoji) => {
        const count = reactions?.[emoji]?.count || 0;
        const isSelected = myEmoji === emoji;

        return (
          <button
            key={emoji}
            onClick={(e) => handleReactionClick(emoji, e)}
            disabled={mutation.isPending}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium
              transition-all duration-200 active:scale-95
              ${mutation.isPending ? 'pointer-events-none' : ''}
              ${
                isSelected
                  ? 'bg-[#FF7A00]/15 dark:bg-[#FF7A00]/25 text-[#FF7A00] ring-1.5 ring-[#FF7A00]/40 font-semibold shadow-xs'
                  : count > 0
                    ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-white hover:bg-black/10 dark:hover:bg-white/15'
                    : 'bg-transparent text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
              }
            `}
            aria-pressed={isSelected}
            title={isSelected ? 'Cliquez pour retirer votre réaction' : `Réagir avec ${emoji}`}
          >
            <span
              className={`text-[15px] transition-transform duration-200 ${
                animatingEmoji === emoji ? 'animate-bounce scale-125' : isSelected ? 'scale-110' : ''
              }`}
            >
              {emoji}
            </span>
            {count > 0 && <span className="font-semibold">{count}</span>}

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
