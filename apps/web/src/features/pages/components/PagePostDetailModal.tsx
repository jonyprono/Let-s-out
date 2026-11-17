import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MoreVertical,
  Copy, 
  Pencil, 
  Trash2,
  Maximize2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { pagesApi } from '../api';
import { countComments, pagePostCommentSource } from '@/features/social/api';
import { CommentThreadPanel } from '@/features/social/components/CommentThreadPanel';
import { PostActionBar } from '@/features/social/components/PostActionBar';
import { usePostLike } from '@/features/social/usePostLike';
import { shareContent } from '@/lib/share-links';
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
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'

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
  if (m < 1) return i18n.t('pagePostDetailModal.aLInstant');
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
  const { t } = useTranslation()
  const me = useAuthStore((s) => (s as any).user);
  const confirm = useConfirm();

  const isCreator = me?.id === post.page.creatorId || post.isOwner;
  const [following, setFollowing] = useState(Boolean(post.isFollowing));
  const [followLoading, setFollowLoading] = useState(false);
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

  // Commentaires (fil partagé) — même clé que le panneau : compteur lu en cache
  const commentSource = useMemo(() => pagePostCommentSource(post.page.id, post.id), [post.page.id, post.id]);
  const { data: commentThreads } = useQuery({
    queryKey: commentSource.queryKey,
    queryFn: commentSource.list,
    enabled: open && Boolean(post.page?.id && post.id),
  });
  const commentsTotal = commentThreads ? countComments(commentThreads) : (post._count?.comments || 0);

  // « J'aime » enregistré (optimiste + retour haptique)
  const postLike = usePostLike({ pageId: post.page.id, postId: post.id, liked: Boolean(post.hasLiked), likesCount: post.likesCount ?? 0 });

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
      toast.success(t('pagePostDetailModal.texteCopieDansLePresse'));
    }
    setShowMenu(false);
  };

  const handleSaveEdit = async () => {
    setIsSavingEdit(true);
    try {
      await pagesApi.updatePost(post.page.id, post.id, { content: editInput });
      setPostContent(editInput);
      toast.success(t('pagePostDetailModal.publicationModifieeAvecSucces'));
      setShowEditModal(false);
    } catch {
      toast.error(t('pagePostDetailModal.erreurLorsDeLaModification'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const confirmed = await confirm({
      title: t('pagePostDetailModal.supprimerCettePublication'),
      description: t('pagePostDetailModal.voulezVousVraimentSupprimerCette'),
      confirmText: t('pagePostDetailModal.ouiSupprimer'),
      cancelText: t('pagePostDetailModal.nonAnnuler'),
      cancelMessage: t('pagePostDetailModal.suppressionAnnulee'),
    });
    if (!confirmed) return;
    try {
      await pagesApi.deletePost(post.page.id, post.id);
      toast.success(t('pagePostDetailModal.publicationSupprimeeAvecSucces'));
      onClose();
      onPostDeleted?.(post.id);
    } catch {
      toast.error(t('pagePostDetailModal.erreurLorsDeLaSuppression'));
    }
  };

  const handleNavigateToPage = () => {
    onClose();
    onNavigate('page-view', post.page.id);
  };

  if (!open) return null;

  // Portal sur <body> (iOS : un `fixed` rendu dans le fil est rogné par le défilement composité)
  return createPortal(
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
                title={t('pagePostDetailModal.voirLaPageDe', { v0: post.page.name })}
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
                  <span>{t('pagePostDetailModal.maPage')}</span>
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
                          <Copy className="w-3.5 h-3.5 text-gray-500" /> <span>{t('pagePostDetailModal.copierLeTexte')}</span>
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
                          <Pencil className="w-3.5 h-3.5 text-gray-500" /> <span>{t('pagePostDetailModal.modifier')}</span>
                        </button>
                      )}
                      {isCreator && (
                        <button
                          onClick={handleDelete}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" /> <span>{t('pagePostDetailModal.supprimer')}</span>
                        </button>
                      )}
                      {!isCreator && (
                        <button
                          onClick={() => {
                            toast.success(t('pagePostDetailModal.publicationSignalee'));
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex items-center gap-2.5 transition-colors"
                        >
                          <span>{t('pagePostDetailModal.signaler')}</span>
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
                      alt={t('pagePostDetailModal.publication')}
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
                          alt={t('pagePostDetailModal.photo', { v0: idx + 1 })}
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
                                alt={t('pagePostDetailModal.photo', { v0: idx + 1 })}
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
                        title={t('pagePostDetailModal.agrandirEnPleinEcran')}
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
            <PostActionBar
              className="py-2 bg-white dark:bg-[#121212]"
              liked={postLike.liked}
              likesCount={postLike.likesCount}
              onLike={postLike.toggle}
              commentsCount={commentsTotal}
              onShare={() => shareContent({ kind: 'post', id: post.id }, { title: post.page.name, text: postContent })}
            />

            {/* Commentaires : fil (likes, réponses @mention) qui suit le défilement, saisie collée en bas */}
            <div className="bg-gray-50/50 dark:bg-[#0A0A0A]">
              <h4 className="px-4 pt-4 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                <span>{t('social.title', { count: commentsTotal })}</span>
              </h4>
              <CommentThreadPanel
                source={commentSource}
                enabled={open}
                layout="inline"
                authorUserId={post.page.creatorId}
                moderatorUserId={post.page.creatorId}
                composerClassName="bg-white dark:bg-[#121212]"
              />
            </div>
          </div>
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
              <h3 className="font-bold text-base text-gray-900 dark:text-white"><span>{t('pagePostDetailModal.modifierLaPublication')}</span></h3>
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
              className="w-full p-3 rounded-2xl bg-gray-50 dark:bg-[#262626] border border-gray-200 dark:border-gray-700 text-[16px] text-gray-900 dark:text-white outline-none focus:border-[#FF7A00] resize-none mb-4"
              placeholder={t('pagePostDetailModal.exprimezVous')}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-[#262626]"
              >
                <span>{t('pagePostDetailModal.annuler')}</span>
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#FF7A00] text-white hover:bg-[#E06C00] disabled:opacity-50"
              >
                <span>{isSavingEdit ? i18n.t('common.saving') : i18n.t('pagePostDetailModal.save')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
