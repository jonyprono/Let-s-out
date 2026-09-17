import { useState } from 'react';
import { X, Heart, MessageCircle, Share2, Send, Loader2, Trash2 } from 'lucide-react';
import { EventVideo, videosApi } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

interface Props {
  video: EventVideo;
  onClose: () => void;
}

export function VideoPlayerModal({ video, onClose }: Props) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  // React query for comments
  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['videos', video.id, 'comments'],
    queryFn: () => videosApi.getComments(video.id),
    enabled: showComments, // fetch only when drawer is open
  });

  // Local state for optimistic updates
  const [hasLiked, setHasLiked] = useState(
    video.reactions && video.reactions.length > 0
  );
  const [likesCount, setLikesCount] = useState(video._count?.reactions || 0);

  const toggleLikeMut = useMutation({
    mutationFn: () => videosApi.toggleReaction(video.id, '❤️'),
    onMutate: async () => {
      // Optimistic update
      const wasLiked = hasLiked;
      setHasLiked(!wasLiked);
      setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));
      return { wasLiked };
    },
    onError: (_err, _variables, context) => {
      // Revert on error
      if (context) {
        setHasLiked(context.wasLiked);
        setLikesCount((prev) => (context.wasLiked ? prev + 1 : prev - 1));
      }
      toast.error('Erreur lors de la réaction');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['feed', 'videos'] });
    }
  });

  const postCommentMut = useMutation({
    mutationFn: () => videosApi.postComment(video.id, commentText),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['videos', video.id, 'comments'] });
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['feed', 'videos'] });
    },
    onError: () => {
      toast.error('Erreur lors de l\'envoi du commentaire');
    }
  });

  const deleteCommentMut = useMutation({
    mutationFn: (commentId: string) => videosApi.deleteComment(video.id, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos', video.id, 'comments'] });
    },
    onError: () => toast.error('Erreur lors de la suppression du commentaire')
  });

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: `Découvre cette vidéo de ${video.event.title} sur Let's Out !`,
          url: window.location.href, // Or a specific deep link
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Lien copié dans le presse-papier !');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-safe-4 left-4 z-10 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Main Video */}
      <video
        src={video.url}
        autoPlay
        controls={!showComments} // Hide controls when comments are open to prevent overlap
        playsInline
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Overlay Information & Interactions (TikTok style) */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end">
        {/* Gradient shadow for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        <div className="relative z-10 flex items-end justify-between p-4 pb-safe-6 pointer-events-auto">
          {/* Info */}
          <div className="flex-1 pr-12 text-white">
            <h2 className="text-[16px] font-bold mb-1 shadow-sm">{video.title}</h2>
            <p className="text-[14px] text-white/90 mb-2">@{(video.user as any).profile?.displayName}</p>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[12px] font-medium">
              <span>📍 {video.event.title}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={() => toggleLikeMut.mutate()}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Heart 
                  className={`w-6 h-6 transition-colors ${hasLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} 
                />
              </div>
              <span className="text-white text-[12px] font-medium drop-shadow-md">{likesCount}</span>
            </button>

            <button 
              onClick={() => setShowComments(true)}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[12px] font-medium drop-shadow-md">{video._count?.comments || 0}</span>
            </button>

            <button 
              onClick={handleShare}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[12px] font-medium drop-shadow-md">Partager</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comments Bottom Sheet */}
      {showComments && (
        <>
          <div 
            className="absolute inset-0 bg-black/50 z-20" 
            onClick={() => setShowComments(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-white dark:bg-[#1A1A1A] z-30 rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-[16px]">Commentaires ({video._count?.comments || 0})</h3>
              <button onClick={() => setShowComments(false)} className="p-2">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Aucun commentaire. Soyez le premier !
                </div>
              ) : (
                comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0 overflow-hidden">
                      {comment.user.profile?.avatarUrl ? (
                        <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
                          {comment.user.profile?.displayName || 'Utilisateur'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-[14px] text-gray-700 dark:text-gray-300 mt-0.5">{comment.content}</p>
                    </div>
                    {user?.id === comment.userId && (
                      <button 
                        onClick={() => deleteCommentMut.mutate(comment.id)}
                        className="p-1 text-red-500/70 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-white/10 flex gap-2 pb-safe-4">
              <input
                type="text"
                placeholder="Ajouter un commentaire..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-gray-100 dark:bg-white/5 rounded-full px-4 text-[14px] outline-none border border-transparent focus:border-orange-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentText.trim() && !postCommentMut.isPending) {
                    postCommentMut.mutate();
                  }
                }}
              />
              <button
                onClick={() => postCommentMut.mutate()}
                disabled={!commentText.trim() || postCommentMut.isPending}
                className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white disabled:opacity-50"
              >
                {postCommentMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
