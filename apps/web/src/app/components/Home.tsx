import { useState, useEffect, useRef, useMemo } from 'react';
import { Loader2, WifiOff, RefreshCw, Heart, MessageCircle, Share2, MoreVertical, Copy, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { EventMediaFeed } from '@/features/events/components/EventMediaFeed';
import { Search01Icon } from 'hugeicons-react';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, Event as AppEvent } from '@/features/events/api';
import { useNotifications } from '@/features/notifications/api';
import { usersApi } from '@/features/users/api';
import { hapticFeedback } from '@/lib/haptics';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useIsOnline } from '@/hooks/useIsOnline';
import { PermissionsRequest } from './PermissionsRequest';
import { pagesApi, PagePost } from '@/features/pages/api';
import { useConfirm } from '@/components/shared/ConfirmContext';
import { PagePostCommentsModal } from '@/features/pages/components/PagePostCommentsModal';
import { PageVideoPlayerModal, PageVideoItem } from '@/features/pages/components/PageVideoPlayerModal';
import { FeaturedEventCard, RowEventCard } from '@/components/ui/event-cards-v2';
import { SafeImage } from '@/components/shared/SafeImage';
import { FeedVideoPlayer } from '@/components/shared/FeedVideoPlayer';
import { sortFeaturedEvents, sortPopularEvents } from '@/utils/event-ranking';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';
import { useTranslation } from 'react-i18next';

interface HomeProps {
  userData: any;
  onNavigate: (screen: string, id?: string) => void;
}

// Filter chips matching the design exactly
// Will be translated dynamically inside component using the keys

function getTimeFilter(key: string): { upcoming?: boolean; status?: string; date?: string; time?: string; ongoing?: string } {
  switch (key) {
    case 'ongoing':  return { status: 'PUBLISHED', ongoing: 'true' };
    case 'tonight':  return { status: 'PUBLISHED', upcoming: true, date: 'today', time: 'evening' };
    case 'tomorrow': return { status: 'PUBLISHED', upcoming: true, date: 'tomorrow' };
    case 'weekend':  return { status: 'PUBLISHED', upcoming: true, date: 'weekend' };
    default:         return { status: 'PUBLISHED', upcoming: true };
  }
}

// ── Skeleton loaders ────────────────────────────────────────────────────────────
function EventCardSkeleton() {
  return (
    <div className="flex w-full h-[110px] bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10 animate-pulse mb-4">
      <div className="w-[110px] h-full bg-gray-200 dark:bg-gray-700" />
      <div className="flex-1 p-3 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/3" />
      </div>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-3xl overflow-hidden animate-pulse" style={{ width: 'min(82vw, 290px)', height: 'clamp(140px, 20vh, 180px)' }} />
  );
}

function PagePostCard({
  post,
  onNavigate,
  onOpenVideo,
  onPostDeleted,
}: {
  post: any;
  onNavigate: (s: string, id?: string) => void;
  onOpenVideo?: (postId: string) => void;
  onPostDeleted?: (postId: string) => void;
}) {
  const me = useAuthStore(s => (s as any).user);
  const confirm = useConfirm();
  const isCreator = me?.id === post.page.creatorId || post.isOwner;
  const [following, setFollowing] = useState(Boolean(post.isFollowing));
  const [followLoading, setFollowLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post._count?.comments || 0);
  const [postContent, setPostContent] = useState(post.content || '');
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInput, setEditInput] = useState(post.content || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  const avatarFallback = isCreator ? me?.profile?.avatarUrl : null;
  const pageAvatarUrl = post.page.avatarUrl || avatarFallback;

  const isVideo = post.mediaUrls?.length > 0 && (
    post.mediaUrls[0].match(/\.(mp4|webm|mov|avi)$/i) || post.mediaUrls[0].includes('/video/')
  );

  useEffect(() => {
    if (typeof post.isFollowing === 'boolean') {
      setFollowing(post.isFollowing);
    }
  }, [post.isFollowing]);

  useEffect(() => {
    setPostContent(post.content || '');
  }, [post.content]);

  if (isDeleted) return null;

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCreator || followLoading) return;
    const previous = following;
    const next = !previous;
    setFollowing(next);
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
      setIsDeleted(true);
      toast.success('Publication supprimée avec succès');
      onPostDeleted?.(post.id);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <>
      <div className="w-full bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10 mb-4">
        {/* Header */}
        <div className="p-3.5 flex items-center justify-between">
          <div
            className="flex items-center gap-3 min-w-0 cursor-pointer active:opacity-80 transition-opacity"
            onClick={() => onNavigate('page-view', post.page.id)}
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500 text-xs overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800">
              {pageAvatarUrl ? (
                <img src={pageAvatarUrl} alt={post.page.name} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center bg-[#F3F4F6] dark:bg-[#262626]"
                  style={{ backgroundImage: 'radial-gradient(#D1D5DB 1px, transparent 1px)', backgroundSize: '6px 6px' }}
                >
                  <span className="text-gray-400 font-bold">{post.page.name[0]?.toUpperCase()}</span>
                </div>
              )}
            </div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white leading-tight truncate hover:underline">{post.page.name}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isCreator ? (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 shrink-0 ${
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

            {/* Menu options button */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                    }}
                  />
                  <div className="absolute right-0 top-9 bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl py-1 z-30 min-w-[150px] overflow-hidden">
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
                        onClick={(e) => {
                          e.stopPropagation();
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
                        onClick={(e) => {
                          e.stopPropagation();
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
          </div>
        </div>

        {/* Content */}
        {postContent && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed select-text">
              {postContent}
            </p>
          </div>
        )}

        {/* Media */}
        {post.mediaUrls?.length > 0 && (
          <div className="w-full bg-black/5 dark:bg-black overflow-hidden relative" style={{ maxHeight: '280px' }}>
            {isVideo ? (
              <FeedVideoPlayer
                src={post.mediaUrls[0]}
                maxHeight="280px"
                onExpand={() => onOpenVideo?.(post.id)}
              />
            ) : (
              <SafeImage src={post.mediaUrls[0]} alt="publication" className="w-full h-full object-cover max-h-[280px]" />
            )}
          </div>
        )}

        {/* Footer 3 columns with vertical dividers */}
        <div className="grid grid-cols-3 border-t border-gray-100 dark:border-gray-800 text-gray-500 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLiked(!liked);
            }}
            className="flex items-center justify-center p-1 transition-colors hover:text-gray-900 dark:hover:text-white"
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            className="flex items-center justify-center p-1 border-l border-gray-100 dark:border-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors gap-1.5"
            title="Commenter"
          >
            <MessageCircle className="w-4 h-4" />
            {commentsCount > 0 && (
              <span className="text-xs font-semibold">{commentsCount}</span>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (navigator.share) {
                navigator.share({ title: post.page.name, text: postContent || '' });
              }
            }}
            className="flex items-center justify-center p-1 border-l border-gray-100 dark:border-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Direct Comment Sheet */}
      <PagePostCommentsModal
        pageId={post.page.id}
        postId={post.id}
        pageName={post.page.name}
        pageCreatorId={post.page.creatorId}
        open={showComments}
        onClose={() => setShowComments(false)}
        onCommentAdded={() => setCommentsCount((c: number) => c + 1)}
      />

      {/* Edit Post Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
              rows={5}
              placeholder="Texte de votre publication..."
              className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] resize-none"
            />

            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-[#FF7A00] hover:bg-[#E06C00] text-white shadow-md shadow-[#FF7A00]/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Stats Banner with real data ─────────────────────────────────────────────────
function StatsBanner({ eventsThisWeek, friendsCount, joinedCount, rating }: {
  eventsThisWeek: number;
  friendsCount: number;
  joinedCount: number;
  rating: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-4 mb-3 bg-[#FF7A00] rounded-[18px] px-4 py-2.5 flex items-center justify-between shadow-md">
      {/* Events this week */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8"/>
            <path d="M16 2v4M8 2v4M3 10h18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-white font-bold text-[16px] leading-none">{eventsThisWeek}</span>
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight whitespace-pre-line">{t('home.stats.eventsThisWeek')}</span>
      </div>

      <div className="w-px h-8 bg-white/25" />

      {/* Friends/Participants */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="1.8"/>
            <path d="M3 20c0-3.866 2.686-7 6-7s6 3.134 6 7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M16 3.5a4 4 0 0 1 0 7M21 20c0-3.866-2.686-7-6-7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>
        <span className="text-white font-bold text-[16px] leading-none">{friendsCount}</span>
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight whitespace-pre-line">{t('home.stats.participants')}</span>
      </div>

      <div className="w-px h-8 bg-white/25" />

      {/* Joined events */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-white font-bold text-[16px] leading-none">{joinedCount}</span>
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight whitespace-pre-line">{t('home.stats.joinedEvents')}</span>
      </div>

      <div className="w-px h-8 bg-white/25" />

      {/* Rating */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-white font-bold text-[16px] leading-none">{rating > 0 ? rating.toFixed(1) : '-'}</span>
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight whitespace-pre-line">{t('home.stats.averageRating')}</span>
      </div>
    </div>
  );
}

// ── Main Home component ─────────────────────────────────────────────────────────
export function Home({ userData, onNavigate }: HomeProps) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('discover');
  const [showPermissions, setShowPermissions] = useState(false);
  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [playingPageVideoId, setPlayingPageVideoId] = useState<string | null>(null);
  const featuredScrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const isOffline = !useIsOnline();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!hasCheckedPermissions) {
      const requested = localStorage.getItem('letsout_permissions_requested');
      if (!requested) setShowPermissions(true);
      setHasCheckedPermissions(true);
    }
  }, [hasCheckedPermissions]);

  const { data: notifData } = useNotifications();
  const unreadCount = (notifData as any)?.unreadCount ?? 0;

  const queryParams = getTimeFilter(activeFilter);

  const {
    data: eventsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['events', 'home', activeFilter],
    queryFn: ({ pageParam = 0 }) =>
      eventsApi.list({ limit: 30, offset: pageParam, ...queryParams }).then(r => r.data),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, page) => acc + (page?.data?.length || 0), 0);
      return loaded < (lastPage?.total || 0) ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const { data: pagePostsData } = useQuery({
    queryKey: ['feed', 'pages', user?.id],
    queryFn: () => pagesApi.getFeed({ limit: 20 }),
  });

  const pageVideos: PageVideoItem[] = useMemo(() => {
    if (!pagePostsData) return [];
    return (pagePostsData as any[])
      .filter((p: any) => p.mediaUrls?.some((url: string) => url.match(/\.(mp4|webm|mov|avi)$/i) || url.includes('/video/')))
      .map((p: any) => ({
        id: p.id,
        pageId: p.page?.id || p.pageId,
        videoUrl: p.mediaUrls.find((url: string) => url.match(/\.(mp4|webm|mov|avi)$/i) || url.includes('/video/')),
        content: p.content,
        createdAt: p.createdAt,
        page: p.page || { id: p.pageId, name: 'Page' },
        likesCount: p._count?.likes || 0,
        commentsCount: p._count?.comments || 0,
        hasLiked: false,
      }));
  }, [pagePostsData]);

  // Real user activity data
  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', user?.id],
    queryFn: () => usersApi.getActivity(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes — données peu volatiles
  });

  // Friends count for stats
  const { data: friends } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
    staleTime: 5 * 60 * 1000, // 5 minutes — liste d'amis peu volatile
  });

  const rawEvents = useMemo(() => {
    if (!eventsData) return [];
    return eventsData.pages.flatMap(p => p.data || []).filter(Boolean);
  }, [eventsData]);

  let events = rawEvents;
  const query = searchQuery.trim().toLowerCase();

  // Local filter layer to guarantee accuracy
  if (query || (activeFilter && activeFilter !== 'discover')) {
    const now = new Date();
    
    events = events.filter((ev: any) => {
      // 1. Text search
      if (query !== '') {
        const matchesTitle = ev?.title?.toLowerCase().includes(query);
        const matchesCity = ev?.city?.toLowerCase().includes(query) ?? false;
        const matchesLocation = (ev as any)?.location?.toLowerCase().includes(query) ?? false;
        if (!matchesTitle && !matchesCity && !matchesLocation) return false;
      }

      // 2. Time filter
      if (activeFilter && activeFilter !== 'discover') {
        const start = ev?.startAt ? new Date(ev.startAt) : null;
        const end = (ev as any)?.endAt ? new Date((ev as any).endAt) : null;
        if (!start) return false;
        
        if (activeFilter === 'ongoing') {
          return start <= now && (!end || end >= now);
        } else if (activeFilter === 'tonight') {
          const todayEvening = new Date(now); todayEvening.setHours(18, 0, 0, 0);
          const tomorrowMorning = new Date(now); tomorrowMorning.setDate(now.getDate() + 1); tomorrowMorning.setHours(6, 0, 0, 0);
          return start >= todayEvening && start <= tomorrowMorning;
        } else if (activeFilter === 'tomorrow') {
          const tom = new Date(now); tom.setDate(now.getDate() + 1); tom.setHours(0, 0, 0, 0);
          const dayAfter = new Date(tom); dayAfter.setDate(tom.getDate() + 1);
          return start >= tom && start <= dayAfter;
        } else if (activeFilter === 'weekend') {
          const dow = now.getDay();
          const daysToSat = (6 - dow + 7) % 7 || 7;
          const sat = new Date(now); sat.setDate(now.getDate() + daysToSat); sat.setHours(0, 0, 0, 0);
          const sun = new Date(sat); sun.setDate(sat.getDate() + 1); sun.setHours(23, 59, 59, 999);
          if (start < sat || start > sun) return false;
        }
      }
      
      return true;
    });
  }

  // "À ne pas manquer" = top 6 by featured score
  const featuredEvents = sortFeaturedEvents(events).slice(0, 6);

  // Auto-scroll pour "À ne pas manquer"
  useEffect(() => {
    if (!featuredScrollRef.current || featuredEvents.length === 0) return;
    
    const interval = setInterval(() => {
      setFeaturedIndex(prev => {
        const next = (prev + 1) % featuredEvents.length;
        const el = featuredScrollRef.current;
        if (el) {
          // Si on est au dernier élément, on scrolle au début (0)
          if (next === 0) {
            el.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            // Sinon on avance d'une carte (environ 85% de la largeur)
            el.scrollTo({ left: next * (el.offsetWidth * 0.85), behavior: 'smooth' });
          }
        }
        return next;
      });
    }, 4500); // Défilement toutes les 4.5 secondes

    return () => clearInterval(interval);
  }, [featuredEvents.length]);
  // "Populaires" = sorted by attendee count (independent list, no deduplication)
  const popularEvents = sortPopularEvents(events);

  // Mix feed items: popular events + page posts
  const mixedFeed: Array<{ type: 'event', data: AppEvent } | { type: 'post', data: PagePost & { page: any } }> = useMemo(() => {
    const mixed = [...popularEvents];
    if (pagePostsData && activeFilter === 'discover' && !query) {
      // Interleave page posts logic: every 3 events, insert a post
      const posts = [...pagePostsData];
      let eventIdx = 0;
      let postIdx = 0;
      const result: Array<{ type: 'event', data: AppEvent } | { type: 'post', data: PagePost & { page: any } }> = [];
      while (eventIdx < mixed.length || postIdx < posts.length) {
        // Add up to 3 events
        for (let i = 0; i < 3 && eventIdx < mixed.length; i++) {
          result.push({ type: 'event', data: mixed[eventIdx++] });
        }
        // Add 1 post
        if (postIdx < posts.length) {
          result.push({ type: 'post', data: posts[postIdx++] });
        }
      }
      return result;
    }
    return mixed.map(e => ({ type: 'event', data: e }));
  }, [popularEvents, pagePostsData, activeFilter, query]);

  // Real stats
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
  const allJoined: any[] = activity?.joinedEvents || [];
  const eventsThisWeek = events.filter((e: any) => {
    if (!e?.startAt) return false;
    const s = new Date(e.startAt);
    return s >= weekStart && s <= weekEnd;
  }).length;
  const joinedCount = allJoined.length;
  const friendsCount = friends?.length ?? (user?.profile?.followersCount ?? 0);
  const { data: myProfile } = useQuery({
    queryKey: ['public-profile', user?.profile?.username],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${user?.profile?.username}`);
      return data;
    },
    enabled: !!user?.profile?.username,
    staleTime: 5 * 60 * 1000, // 5 minutes — profil peu volatile
  });

  const ratingStr = myProfile?.detailedStats?.rating?.toFixed(1) ?? '0.0';
  const rating = parseFloat(ratingStr);
  const showSpinner = isLoading && rawEvents.length === 0 && !isOffline;

  const emptyStateLabel = (() => {
    switch (activeFilter) {
      case 'ongoing':  return t('home.emptyStates.ongoing');
      case 'tonight':  return t('home.emptyStates.tonight');
      case 'tomorrow': return t('home.emptyStates.tomorrow');
      case 'weekend':  return t('home.emptyStates.weekend');
      default:         return t('home.emptyStates.default');
    }
  })();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bottomRef.current) return;
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    });
    observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const displayName = user?.profile?.displayName?.split(' ')[0]
    || userData?.firstName?.split(' ')[0]
    || 'vous';
  const avatarUrl = user?.profile?.avatarUrl;
  const [viewAll, setViewAll] = useState<'featured' | 'popular' | null>(null);

  const handleRefresh = async () => {
    if (!isOffline) {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['events'] }),
        qc.invalidateQueries({ queryKey: ['feed', 'pages'] })
      ]);
    }
  };

  if (viewAll) {
    const listEvents = viewAll === 'featured' ? featuredEvents : popularEvents;
    const title = viewAll === 'featured' ? t('home.sections.featured') : t('home.sections.popular');
    
    return (
      <div className="w-full h-full flex flex-col bg-white dark:bg-black">
        {/* Header */}
        <div className="px-4 pt-safe-4 pt-4 pb-3 flex items-center gap-3 bg-white dark:bg-black z-10 sticky top-0 border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => setViewAll(null)} className="w-10 h-10 bg-gray-100 dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        </div>
        
        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: 'none' }}>
          {listEvents.map(event => (
            <RowEventCard
              key={event.id}
              event={event}
              onClick={() => onNavigate('event-details', event.id)}
            />
          ))}
          {listEvents.length === 0 && (
            <p className="text-center text-gray-500 py-10">{t('home.emptyStates.default')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black overflow-hidden">
      {/* ── Fixed Header ── */}
      <div className="bg-white dark:bg-black z-20 flex-shrink-0">
        {/* Row 1: Avatar + greeting + notif + scan */}
        <div className="flex items-center gap-2.5 mb-2 px-4 pt-safe-3 pt-3">
          <button onClick={() => onNavigate('profile')} className="w-11 h-11 rounded-full overflow-hidden border-2 border-[#FF7A00] shrink-0 active:opacity-70 transition-opacity">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#FF7A00] to-[#E56A00] flex items-center justify-center text-white text-lg font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight truncate">
              {t('home.header.welcome', { name: displayName })}
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">
              {t('home.header.readyFor')} <span className="text-[#FF7A00] font-semibold">{t('home.header.newExperiences')}</span>{t('home.header.readyForEnd')}
            </p>
          </div>

          <button
            onClick={() => onNavigate('notifications')}
            className="w-10 h-10 flex items-center justify-center active:opacity-70 transition-opacity"
          >
            <NotificationIconWithBadge unreadCount={unreadCount} className="w-7 h-7 text-gray-900 dark:text-white" />
          </button>

          <button
            onClick={() => onNavigate('scan-qr')}
            className="w-10 h-10 bg-[#FF7A00] rounded-[12px] flex items-center justify-center active:scale-95 transition-transform shadow-md"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="7" y="7" width="4" height="4" rx="0.5" stroke="white" strokeWidth="2"/>
              <rect x="13" y="7" width="4" height="4" rx="0.5" stroke="white" strokeWidth="2"/>
              <rect x="7" y="13" width="4" height="4" rx="0.5" stroke="white" strokeWidth="2"/>
              <path d="M13 13h1M17 13v1M13 17h4v-2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Search bar + Filter chips */}
        <div className="px-4 pb-2">
          <div
            className="w-full flex items-center gap-3 px-4 bg-gray-100 dark:bg-[#1A1A1A] rounded-full text-left mb-2 transition-colors focus-within:ring-2 focus-within:ring-[#FF7A00]/50"
            style={{ height: 'clamp(36px, 5vh, 44px)' }}
          >
            <Search01Icon className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
            <input
              type="text"
              placeholder={t('home.search.placeholder')}
              className="flex-1 text-[13px] text-gray-900 dark:text-white bg-transparent outline-none truncate placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {[
              { key: 'discover', icon: '✦' },
              { key: 'ongoing',  icon: '●' },
              { key: 'tonight',  icon: '🌙' },
              { key: 'tomorrow', icon: '📅' },
              { key: 'weekend',  icon: '🎉' },
            ].map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => { hapticFeedback.impact(); setActiveFilter(f.key); }}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all active:scale-95 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FF7A00] text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="text-[12px]">{f.icon}</span>
                  {t(`home.timeFilters.${f.key}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <PullToRefresh onRefresh={handleRefresh} isPullable={!isOffline} pullingContent="" refreshingContent={<div className="p-4 text-center text-gray-400 text-sm">{t('home.refreshing')}</div>}>
          <div className="pb-28">

            {showSpinner && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" />
              </div>
            )}

            {/* Offline state */}
            {isOffline && rawEvents.length === 0 && !showSpinner && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-[#FF7A00]" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200 text-base mb-1">{t('home.offline.title')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('home.offline.subtitle')}</p>
                </div>
                <button
                  onClick={() => qc.refetchQueries({ queryKey: ['events'] })}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF7A00] text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('home.offline.retry')}
                </button>
              </div>
            )}

            {!showSpinner && !isOffline && (
              <>
                {/* ── Orange Stats Banner ── */}
                <div className="pt-1">
                  <StatsBanner
                    eventsThisWeek={eventsThisWeek}
                    friendsCount={friendsCount}
                    joinedCount={joinedCount}
                    rating={rating}
                  />
                </div>

                {/* ── À ne pas manquer ── */}
                <div className="mb-3">
                  <div className="flex items-center justify-between px-4 mb-3">
                    <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('home.sections.featured')}</h2>
                    <button onClick={() => setViewAll('featured')} className="text-[13px] font-semibold text-[#FF7A00]">{t('home.sections.seeAll')}</button>
                  </div>

                  {isLoading ? (
                    <div className="flex gap-4 overflow-x-auto px-4 pb-2 after:content-[''] after:w-px after:shrink-0" style={{ scrollbarWidth: 'none' }}>
                      {[1, 2, 3].map(i => <FeaturedSkeleton key={i} />)}
                    </div>
                  ) : featuredEvents.length > 0 ? (
                    <>
                      <div
                        ref={featuredScrollRef}
                        className="flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory after:content-[''] after:w-px after:shrink-0"
                        style={{ scrollbarWidth: 'none' }}
                        onScroll={(e) => {
                          const el = e.currentTarget;
                          const idx = Math.round(el.scrollLeft / (el.offsetWidth * 0.85));
                          setFeaturedIndex(idx);
                        }}
                      >
                        {featuredEvents.map(event => (
                          <FeaturedEventCard
                            key={event.id}
                            event={event}
                            onClick={() => onNavigate('event-details', event.id)}
                          />
                        ))}
                      </div>
                      {/* Pagination dots */}
                      <div className="flex justify-center gap-1.5 mt-2">
                        {featuredEvents.map((_, i) => (
                          <div
                            key={i}
                            className={`rounded-full transition-all ${
                              i === featuredIndex
                                ? 'w-5 h-1.5 bg-[#FF7A00]'
                                : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* ── OUT VLOGS ── */}
                <EventMediaFeed />

                {/* ── Événements populaires ── */}
                <div className="pt-1 pb-1">
                  <div className="flex items-center justify-between px-4 mb-3">
                    <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">{t('home.sections.popular')}</h2>
                    <button onClick={() => setViewAll('popular')} className="text-[13px] font-semibold text-[#FF7A00]">{t('home.sections.seeAll')}</button>
                  </div>

                  {isLoading && mixedFeed.length === 0 ? (
                    <div className="px-4 space-y-3">
                      {[1, 2, 3].map(i => <EventCardSkeleton key={i} />)}
                    </div>
                  ) : mixedFeed.length === 0 ? (
                    <div className="flex flex-col items-center py-14 gap-3 text-center px-8">
                      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-2xl">📭</div>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{emptyStateLabel}</p>
                      <p className="text-xs text-gray-400">{t('home.emptyStates.tryAnother')}</p>
                    </div>
                  ) : (
                    <div className="px-4 space-y-3">
                      {mixedFeed.map((item, idx) => (
                        item.type === 'event' ? (
                          <RowEventCard
                            key={`evt-${item.data.id}-${idx}`}
                            event={item.data as any}
                            onClick={() => onNavigate('event-details', item.data.id)}
                          />
                        ) : (
                          <PagePostCard 
                            key={`post-${item.data.id}-${idx}`} 
                            post={item.data} 
                            onNavigate={onNavigate}
                            onOpenVideo={(postId) => setPlayingPageVideoId(postId)}
                          />
                        )
                      ))}
                    </div>
                  )}

                  {/* Infinite scroll trigger */}
                  <div ref={bottomRef} className="h-10 mt-4 flex items-center justify-center">
                    {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-gray-400" />}
                  </div>
                </div>
              </>
            )}
          </div>
        </PullToRefresh>
      </div>

      {showPermissions && (
        <PermissionsRequest onComplete={() => setShowPermissions(false)} />
      )}

      {playingPageVideoId && (
        <PageVideoPlayerModal
          videos={pageVideos}
          initialVideoId={playingPageVideoId}
          onClose={() => setPlayingPageVideoId(null)}
        />
      )}
    </div>
  );
}
