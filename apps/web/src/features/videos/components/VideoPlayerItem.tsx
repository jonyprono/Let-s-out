import { useState, useRef, useEffect } from 'react';
import { X, Heart, MessageCircle, Share2, Send, Loader2, Trash2, Play, CalendarPlus } from 'lucide-react';
import { EventVideo, videosApi } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useUserProfile } from '@/features/users/UserProfileContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

interface Props {
  video: EventVideo;
  isActive: boolean;
}

export function VideoPlayerItem({ video, isActive }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { openUserProfile } = useUserProfile();
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [commentText, setCommentText] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      videoRef.current?.pause();
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.currentTime = 0; // Reset when not active
      }
      setShowComments(false);
      setShowShareSheet(false);
    }
  }, [isActive]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(isNaN(p) ? 0 : p);
    }
  };
  
  // React query for comments
  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['videos', video.id, 'comments'],
    queryFn: () => videosApi.getComments(video.id),
    enabled: showComments,
  });

  // Local state for optimistic updates
  const [hasLiked, setHasLiked] = useState(
    video.reactions && video.reactions.length > 0
  );
  const [likesCount, setLikesCount] = useState(video._count?.reactions || 0);

  const toggleLikeMut = useMutation({
    mutationFn: () => videosApi.toggleReaction(video.id, '❤️'),
    onMutate: async () => {
      const wasLiked = hasLiked;
      setHasLiked(!wasLiked);
      setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));
      return { wasLiked };
    },
    onError: (_err, _variables, context) => {
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

  const videoLink = `https://letsout.app/videos/${video.id}`;

  const handleShareNative = async () => {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: video.title,
        text: `Découvre "${video.title}" de l'événement "${video.event.title}" sur Let's Out !`,
        url: videoLink,
        dialogTitle: 'Partager cette vidéo',
      });
    } catch {
      if (navigator.share) {
        try {
          await navigator.share({ title: video.title, url: videoLink });
        } catch {
          copyLink();
        }
      } else {
        copyLink();
      }
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(videoLink);
      } else {
        const el = document.createElement('textarea');
        el.value = videoLink;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast.success('Lien copié !');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  return (
    <div className="relative w-full h-full snap-start shrink-0 flex items-center justify-center bg-black">
      {/* Main Video */}
      <video
        ref={videoRef}
        src={video.url}
        loop
        playsInline
        onTimeUpdate={handleTimeUpdate}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => {
          e.stopPropagation();
          if (videoRef.current?.paused) {
            videoRef.current.play();
            setIsPlaying(true);
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        }}
      />

      {/* Center Play Button Overlay */}
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1 fill-white" />
          </div>
        </div>
      )}

      {/* Overlay Information & Interactions (TikTok style) */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end">
        {/* Gradient shadow for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />


        <div className="relative z-10 flex items-end justify-between p-4 pb-safe-6 pointer-events-auto">
          {/* Info */}
          <div className="flex-1 pr-12 text-white">
            <h2 className="text-[16px] font-bold mb-1 shadow-sm">{video.title}</h2>
            <p 
              className="text-[14px] text-white/90 mb-2 cursor-pointer active:opacity-70"
              onClick={() => openUserProfile(video.userId, undefined, { title: video.event.title })}
            >
              @{(video.user as any).profile?.displayName || (video.user as any).username || 'Utilisateur'}
            </p>
            <div 
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[12px] font-medium cursor-pointer active:scale-95 transition-transform"
              onClick={() => navigate(`/events/${video.eventId}`)}
            >
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
              onClick={() => setShowShareSheet(true)}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[12px] font-medium drop-shadow-md">Partager</span>
            </button>

            {/* Delete button — author or event organizer */}
            {user && (video.userId === user.id || (video.event as any)?.creatorId === user.id || ((video.event as any)?.coHostIds || []).includes(user.id)) && (
              <button 
                onClick={async () => {
                  if (!confirm('Supprimer cette vidéo ?')) return;
                  try {
                    await videosApi.delete(video.id);
                    toast.success('Vidéo supprimée');
                    qc.invalidateQueries({ queryKey: ['videos'] });
                    qc.invalidateQueries({ queryKey: ['feed', 'videos'] });
                  } catch {
                    toast.error('Erreur lors de la suppression');
                  }
                }}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-red-400 text-[12px] font-medium drop-shadow-md">Supprimer</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Persistent "Create Similar Event" Button */}
        <div className="relative z-10 w-full px-4 mb-3 pointer-events-auto">
          <button 
            onClick={() => {
              const tagsQuery = (video.event as any).tags?.length ? `&tags=${(video.event as any).tags.join(',')}` : '';
              navigate(`/create-event?category=${video.event.category}${tagsQuery}`);
            }}
            className="w-full py-2.5 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white font-medium text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg"
          >
            <CalendarPlus className="w-5 h-5" />
            Créer un événement similaire
          </button>
        </div>
        
        {/* Custom Progress Bar at the very bottom */}
        <div className="w-full h-1 bg-white/20">
          <div 
            className="h-full bg-white transition-all duration-100 ease-linear" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      {/* Comments Bottom Sheet */}
      {showComments && (
        <>
          <div 
            className="absolute inset-0 bg-black/50 z-20 pointer-events-auto" 
            onClick={() => setShowComments(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-white dark:bg-[#1A1A1A] z-30 rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300 pointer-events-auto">
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
                    <div 
                      className="w-8 h-8 rounded-full bg-gray-200 shrink-0 overflow-hidden cursor-pointer"
                      onClick={() => openUserProfile(comment.userId)}
                    >
                      {comment.user.profile?.avatarUrl ? (
                        <img src={comment.user.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span 
                          className="text-[13px] font-semibold text-gray-900 dark:text-white cursor-pointer hover:underline"
                          onClick={() => openUserProfile(comment.userId)}
                        >
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

            <div
              className="border-t border-gray-100 dark:border-white/10 flex items-center gap-2 px-4 pt-3"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 16px))' }}
            >
              <input
                type="text"
                placeholder="Ajouter un commentaire..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 h-10 bg-gray-100 dark:bg-white/10 rounded-full px-4 text-[14px] outline-none border border-transparent focus:border-orange-500/50 min-w-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && commentText.trim() && !postCommentMut.isPending) {
                    postCommentMut.mutate();
                  }
                }}
              />
              <button
                onClick={() => postCommentMut.mutate()}
                disabled={!commentText.trim() || postCommentMut.isPending}
                className="w-10 h-10 shrink-0 rounded-full bg-orange-500 flex items-center justify-center text-white disabled:opacity-40"
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

      {/* Share Sheet */}
      {showShareSheet && (
        <>
          <div
            className="absolute inset-0 bg-black/60 z-40 pointer-events-auto"
            onClick={() => setShowShareSheet(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1A1A1A] rounded-t-3xl animate-in slide-in-from-bottom duration-300 pointer-events-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="px-6 pt-3 pb-2">
              <h3 className="font-bold text-[17px] text-gray-900 dark:text-white mb-1">{video.title}</h3>
              <p className="text-[13px] text-gray-500">{video.event.title}</p>
            </div>
            <div className="px-4 pb-4 space-y-2" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 16px))' }}>
              <button
                onClick={() => { setShowShareSheet(false); handleShareNative(); }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl"
              >
                <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-[15px] text-gray-900 dark:text-white">Partager en dehors</p>
                  <p className="text-[12px] text-gray-500">WhatsApp, Instagram, SMS…</p>
                </div>
              </button>
              <button
                onClick={() => { setShowShareSheet(false); copyLink(); }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl"
              >
                <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-[15px] text-gray-900 dark:text-white">Copier le lien</p>
                  <p className="text-[12px] text-gray-500">Copiez l'adresse de la vidéo</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
