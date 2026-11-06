import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  MessageCircle, 
  Share2, 
  Send, 
  Loader2, 
  MoreVertical, 
  Copy, 
  Pencil, 
  Trash2,
  Maximize2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { pagesApi, PagePostComment } from '../api';
import { useConfirm } from '@/components/shared/ConfirmContext';
import { toast } from 'sonner';
import { SafeImage } from '@/components/shared/SafeImage';
import { FeedVideoPlayer } from '@/components/shared/FeedVideoPlayer';
import { PhotoLightboxModal } from '@/components/shared/PhotoLightboxModal';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/app/components/ui/carousel';

interface PagePostDetailModalProps {
  post: any;
  open: boolean;
  onClose: () => void;
  onNavigate: (screen: string, id?: string) => void;
  onPostDeleted?: (postId: string) => void;
  onOpenVideo?: (postId: string) => void;
}

function getRelativeTime(dateString?: string) {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

export function PagePostDetailModal({
  post,
  open,
  onClose,
  onNavigate,
  onPostDeleted,
  onOpenVideo,
}: PagePostDetailModalProps) {
  const me = useAuthStore((s) => (s as any).user);
  const confirm = useConfirm();
  const qc = useQueryClient();

  const isCreator = me?.id === post.page.creatorId || post.isOwner;
  const [following, setFollowing] = useState(Boolean(post.isFollowing));
  const [followLoading, setFollowLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post._count?.likes || 0);
  const [postContent, setPostContent] = useState(post.content || '');
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInput, setEditInput] = useState(post.content || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Carousel & Image Lightbox state
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);

  // Comments state
  const [commentText, setCommentText] = useState('');

  const pageAvatarUrl = post.page.avatarUrl || null;
  const isVideo =
    post.mediaUrls?.length > 0 &&
    (post.mediaUrls[0].match(/\.(mp4|webm|mov|avi)$/i) || post.mediaUrls[0].includes('/video/'));

  useEffect(() => {
    if (typeof post.isFollowing === 'boolean') {
      setFollowing(post.isFollowing);
    }
  }, [post.isFollowing]);

  useEffect(() => {
    setPostContent(post.content || '');
  }, [post.content]);

  // Sync Carousel slide
  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setCurrentSlide(api.selectedScrollSnap());
    };
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  // Query comments
  const { data: comments = [], isLoading: isCommentsLoading } = useQuery<PagePostComment[]>({
    queryKey: ['pages', post.page.id, 'posts', post.id, 'comments'],
    queryFn: () => pagesApi.getComments(post.page.id, post.id),
    enabled: open && Boolean(post.page?.id && post.id),
  });

  // Add comment mutation
  const postMutation = useMutation({
    mutationFn: (text: string) => pagesApi.addComment(post.page.id, post.id, text),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['pages', post.page.id, 'posts', post.id, 'comments'] });
      qc.invalidateQueries({ queryKey: ['feed', 'pages'] });
      qc.invalidateQueries({ queryKey: ['pages', post.page.id, 'posts'] });
    },
  });

  // Delete comment mutation
  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => pagesApi.deleteComment(post.page.id, post.id, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages', post.page.id, 'posts', post.id, 'comments'] });
      qc.invalidateQueries({ queryKey: ['feed', 'pages'] });
      qc.invalidateQueries({ queryKey: ['pages', post.page.id, 'posts'] });
    },
  });

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCreator || followLoading) return;
    const previous = following;
    setFollowing(!previous);
    setFollowLoading(true);
    try {
      const res = await pagesApi.follow(post.page.id);
      setFollowing(res.followed);
    } catch {
      setFollowing(previous);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCopyText = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (postContent) {
      navigator.clipboard?.writeText(postContent);
      toast.success('Texte copié dans le presse-papier');
    }
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      await pagesApi.updatePost(post.page.id, post.id, { content: editInput });
      setPostContent(editInput);
      toast.success('Publication modifiée avec succès');
      setShowEditModal(false);
    } catch {
      toast.error('Erreur lors de la modification');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const confirmed = await confirm({
      title: 'Supprimer cette publication ?',
      description: 'Voulez-vous vraiment supprimer cette publication définitivement ?',
      confirmText: 'Oui, supprimer',
      cancelText: 'Non, annuler',
      cancelMessage: 'Suppression annulée',
    });
    if (!confirmed) return;
    try {
      await pagesApi.deletePost(post.page.id, post.id);
      toast.success('Publication supprimée avec succès');
      onClose();
      onPostDeleted?.(post.id);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSendComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || postMutation.isPending) return;
    postMutation.mutate(commentText.trim());
  };

  const handleNavigateToPage = () => {
    onClose();
    onNavigate('page-view', post.page.id);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex justify-center items-end sm:items-center sm:p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-xl bg-white dark:bg-[#121212] sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] shadow-2xl border border-gray-100 dark:border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Top Header ── */}
          <div className="p-3.5 sm:p-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between shrink-0 bg-white dark:bg-[#121212]">
            <div className="flex items-center gap-3 min-w-0">
              {/* Clicking avatar or page name navigates to the entire page profile */}
              <div
                className="flex items-center gap-2.5 min-w-0 cursor-pointer active:opacity-75 transition-opacity group"
                onClick={handleNavigateToPage}
                title={`Voir la page de ${post.page.name}`}
              >
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500 text-xs overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 group-hover:ring-2 ring-[#FF7A00]/50 transition-all">
                  {pageAvatarUrl ? (
                    <img src={pageAvatarUrl} alt={post.page.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#FF7A00] font-bold">{post.page.name[0]?.toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate group-hover:text-[#FF7A00] transition-colors">
                      {post.page.name}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {getRelativeTime(post.createdAt) || 'Publication'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isCreator ? (
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 shrink-0 ${
                    following
                      ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20'
                      : 'bg-[#FF7A00] text-white hover:bg-[#E06C00]'
                  }`}
                >
                  {following ? 'Suivi' : 'Suivre'}
                </button>
              ) : (
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#262626] px-2.5 py-1 rounded-full shrink-0">
                  Ma page
                </span>
              )}

              {/* Menu options */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-9 bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl py-1 z-40 min-w-[150px] overflow-hidden">
                      {postContent && (
                        <button
                          onClick={handleCopyText}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex items-center gap-2.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5 text-gray-500" /> Copier le texte
                        </button>
                      )}
                      {isCreator && (
                        <button
                          onClick={() => {
                            setEditInput(postContent);
                            setShowEditModal(true);
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex items-center gap-2.5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-500" /> Modifier
                        </button>
                      )}
                      {isCreator && (
                        <button
                          onClick={handleDelete}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" /> Supprimer
                        </button>
                      )}
                      {!isCreator && (
                        <button
                          onClick={() => {
                            toast.success('Publication signalée');
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex items-center gap-2.5 transition-colors"
                        >
                          Signaler
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/10">
            {/* Description Text */}
            {postContent && (
              <div className="p-4 bg-white dark:bg-[#121212]">
                <p className="text-[14px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed select-text">
                  {postContent}
                </p>
              </div>
            )}

            {/* Media (Video or Multi-Photo Carousel) */}
            {post.mediaUrls?.length > 0 && (
              <div className="w-full bg-black relative overflow-hidden">
                {isVideo ? (
                  <FeedVideoPlayer
                    src={post.mediaUrls[0]}
                    maxHeight="420px"
                    onExpand={() => {
                      onClose();
                      onOpenVideo?.(post.id);
                    }}
                  />
                ) : post.mediaUrls.length === 1 ? (
                  <div
                    className="relative w-full flex items-center justify-center cursor-pointer group bg-black"
                    onClick={() => {
                      setLightboxInitialIndex(0);
                      setLightboxOpen(true);
                    }}
                  >
                    <SafeImage
                      src={post.mediaUrls[0]}
                      alt="Publication"
                      className="w-full max-h-[460px] object-contain"
                    />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white p-2 rounded-full opacity-80 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                ) : post.mediaUrls.length === 2 ? (
                  /* Grille 2 photos côte à côte (style Twitter / X) */
                  <div className="grid grid-cols-2 gap-1 w-full bg-black h-[320px] sm:h-[400px] overflow-hidden">
                    {post.mediaUrls.map((url: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative w-full h-full cursor-pointer overflow-hidden group bg-neutral-900"
                        onClick={() => {
                          setLightboxInitialIndex(idx);
                          setLightboxOpen(true);
                        }}
                      >
                        <SafeImage
                          src={url}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Multi-Photo Carousel with swipe & click to zoom (> 2 photos) */
                  <div className="relative w-full bg-black group">
                    <Carousel setApi={setApi} className="w-full">
                      <CarouselContent>
                        {post.mediaUrls.map((url: string, idx: number) => (
                          <CarouselItem key={idx} className="pl-0">
                            <div
                              className="relative w-full h-[320px] sm:h-[400px] flex items-center justify-center cursor-pointer bg-black/90"
                              onClick={() => {
                                setLightboxInitialIndex(idx);
                                setLightboxOpen(true);
                              }}
                            >
                              <SafeImage
                                src={url}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>

                    {/* Counter & Fullscreen button */}
                    <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
                      <span className="bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/10">
                        {currentSlide + 1} / {post.mediaUrls.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxInitialIndex(currentSlide);
                          setLightboxOpen(true);
                        }}
                        className="pointer-events-auto bg-black/60 backdrop-blur-sm text-white p-2 rounded-full border border-white/10 hover:bg-black/80 transition-colors"
                        title="Agrandir en plein écran"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Dot indicators */}
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none z-10">
                      {post.mediaUrls.map((_: any, idx: number) => (
                        <span
                          key={idx}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === currentSlide
                              ? 'w-5 bg-[#FF7A00]'
                              : 'w-1.5 bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interaction Row (Heart, Comments Count, Share) */}
            <div className="grid grid-cols-3 text-gray-500 dark:text-gray-400 py-3 bg-white dark:bg-[#121212]">
              <button
                onClick={() => {
                  setLiked(!liked);
                  setLikesCount((prev: number) => (liked ? Math.max(0, prev - 1) : prev + 1));
                }}
                className="flex items-center justify-center gap-2 p-1 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                <span className="text-xs font-semibold">{likesCount > 0 ? likesCount : 'J\'aime'}</span>
              </button>

              <div className="flex items-center justify-center gap-2 p-1 border-l border-gray-100 dark:border-white/10 text-xs font-semibold">
                <MessageCircle className="w-5 h-5" />
                <span>{comments.length} commentaire{comments.length > 1 ? 's' : ''}</span>
              </div>

              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: post.page.name, text: postContent || '' });
                  } else {
                    navigator.clipboard?.writeText(window.location.href);
                    toast.success('Lien copié');
                  }
                }}
                className="flex items-center justify-center gap-2 p-1 border-l border-gray-100 dark:border-white/10 hover:text-gray-900 dark:hover:text-white transition-colors text-xs font-semibold"
              >
                <Share2 className="w-5 h-5" />
                <span>Partager</span>
              </button>
            </div>

            {/* Comments List */}
            <div className="p-4 space-y-4 bg-gray-50/50 dark:bg-[#0A0A0A]">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Commentaires ({comments.length})
              </h4>

              {isCommentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  Aucun commentaire pour le moment. Soyez le premier à commenter !
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const isCommentCreator = comment.userId === post.page.creatorId;
                    const isMyComment = me?.id === comment.userId;
                    const avatar = comment.user?.profile?.avatarUrl;
                    const name =
                      comment.user?.profile?.displayName ||
                      (comment.user as any)?.username ||
                      'Utilisateur';

                    return (
                      <div key={comment.id} className="flex gap-2.5 items-start">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-[#FF7A00]">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            name[0]?.toUpperCase()
                          )}
                        </div>

                        <div className="flex-1 bg-white dark:bg-[#1A1A1A] p-2.5 rounded-2xl border border-gray-100 dark:border-white/5 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {name}
                              {isCommentCreator && (
                                <span className="ml-1.5 text-[10px] bg-[#FFF2D3] dark:bg-[#FF7A00]/20 text-[#FF7A00] px-1.5 py-0.5 rounded-full font-medium">
                                  Auteur
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {getRelativeTime(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                            {comment.text}
                          </p>
                        </div>

                        {(isMyComment || isCreator) && (
                          <button
                            onClick={() => deleteMutation.mutate(comment.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors self-center"
                            title="Supprimer le commentaire"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Direct Comment Input Bar ── */}
          <form
            onSubmit={handleSendComment}
            className="p-3 bg-white dark:bg-[#121212] border-t border-gray-100 dark:border-white/10 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Écrire un commentaire..."
              className="flex-1 bg-gray-100 dark:bg-[#1F1F1F] text-gray-900 dark:text-white text-xs rounded-full px-4 py-2.5 outline-none focus:ring-1 focus:ring-[#FF7A00] transition-all"
            />
            <button
              type="submit"
              disabled={!commentText.trim() || postMutation.isPending}
              className="w-9 h-9 rounded-full bg-[#FF7A00] text-white flex items-center justify-center hover:bg-[#E06C00] disabled:opacity-40 disabled:hover:bg-[#FF7A00] transition-colors shrink-0 shadow-sm"
            >
              {postMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-0.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── Facebook-Style Fullscreen Photo Lightbox ── */}
      <PhotoLightboxModal
        images={post.mediaUrls || []}
        initialIndex={lightboxInitialIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={post.page?.name}
      />

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Modifier la publication</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-[#262626] border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white outline-none focus:border-[#FF7A00] resize-none mb-4"
              placeholder="Exprimez-vous..."
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-[#262626]"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF7A00] text-white hover:bg-[#E06C00] disabled:opacity-50"
              >
                {isSavingEdit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
