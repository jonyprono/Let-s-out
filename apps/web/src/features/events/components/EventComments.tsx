import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Send, Loader2, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    profile?: {
      displayName: string;
      avatarUrl?: string;
    };
  };
}

export function EventComments({ eventId, organizerId }: { eventId: string, organizerId?: string }) {
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();
  const currentUser = useAuthStore(s => s.user);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['events', eventId, 'comments'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Comment[] }>(`/events/${eventId}/comments`);
      return res.data.data;
    }
  });

  const postMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiClient.post<{ data: Comment }>(`/events/${eventId}/comments`, { content: text });
      return res.data;
    },
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'comments'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiClient.delete(`/events/${eventId}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events', eventId, 'comments'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    postMutation.mutate(content);
  };

  if (isLoading) return (
    <div className="py-6 flex justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-white/5">
        <MessageCircle className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold text-[15px]">Commentaires ({comments.length})</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Aucun commentaire pour l'instant. Soyez le premier !
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                {comment.user.profile?.avatarUrl ? (
                  <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500 bg-gray-100">
                    {comment.user.profile?.displayName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[13px]">{comment.user.profile?.displayName || 'Utilisateur'}</span>
                  <span className="text-[11px] text-gray-400">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[14px] text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
                  {comment.content}
                </p>
                <div className="flex gap-3 mt-1">
                  {(currentUser?.id === comment.userId || currentUser?.id === organizerId) ? (
                    <button 
                      onClick={() => deleteMutation.mutate(comment.id)}
                      className="text-[11px] text-red-500 font-medium hover:underline"
                    >
                      Supprimer
                    </button>
                  ) : (
                    <button 
                      onClick={() => alert("Signalement envoyé (fonctionnalité à connecter à l'API)")}
                      className="text-[11px] text-gray-500 font-medium hover:underline"
                    >
                      Signaler
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-[#1A1A1A]">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ajouter un commentaire..."
            className="flex-1 bg-gray-100 dark:bg-white/5 rounded-full px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
          />
          <button
            type="submit"
            disabled={!content.trim() || postMutation.isPending}
            className="w-10 h-10 rounded-full bg-[#FF7A00] text-white flex items-center justify-center disabled:opacity-50 flex-shrink-0"
          >
            {postMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
