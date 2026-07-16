import { useState, useEffect, useRef } from 'react';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { Search01Icon } from 'hugeicons-react';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type Event } from '@/features/events/api';
import { useNotifications } from '@/features/notifications/api';
import { usersApi } from '@/features/users/api';
import { hapticFeedback } from '@/lib/haptics';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useIsOnline } from '@/hooks/useIsOnline';
import { PermissionsRequest } from './PermissionsRequest';
import { FeaturedEventCard, RowEventCard } from '@/components/ui/event-cards-v2';
import { sortFeaturedEvents, sortPopularEvents } from '@/utils/event-ranking';
import { useAuthStore } from '@/stores/auth.store';
import { apiClient } from '@/lib/api-client';

interface HomeProps {
  userData: any;
  onNavigate: (screen: string, id?: string) => void;
}

// Filter chips matching the design exactly
const TIME_FILTERS = [
  { key: 'discover', label: 'Découvrir', icon: '✦' },
  { key: 'ongoing',  label: 'En cours',  icon: '●' },
  { key: 'tonight',  label: 'Ce soir',   icon: '🌙' },
  { key: 'tomorrow', label: 'Demain',    icon: '📅' },
  { key: 'weekend',  label: 'Weekend',   icon: '🎉' },
];

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

// ── Stats Banner with real data ─────────────────────────────────────────────────
function StatsBanner({ eventsThisWeek, friendsCount, joinedCount, rating }: {
  eventsThisWeek: number;
  friendsCount: number;
  joinedCount: number;
  rating: number;
}) {
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
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight">Événements<br/>cette semaine</span>
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
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight">Participants<br/>avec vous</span>
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
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight">Événements<br/>rejoints</span>
      </div>

      <div className="w-px h-8 bg-white/25" />

      {/* Rating */}
      <div className="flex flex-col items-center gap-0.5 flex-1">
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center mb-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-white font-bold text-[16px] leading-none">{rating > 0 ? rating.toFixed(1) : '—'}</span>
        <span className="text-white/90 text-[8.5px] text-center font-medium leading-tight">Note moyenne<br/>reçue</span>
      </div>
    </div>
  );
}

// ── Main Home component ─────────────────────────────────────────────────────────
export function Home({ userData, onNavigate }: HomeProps) {
  const [activeFilter, setActiveFilter] = useState('discover');
  const [showPermissions, setShowPermissions] = useState(false);
  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
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

  // Real user activity data
  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', user?.id],
    queryFn: () => usersApi.getActivity(user!.id),
    enabled: !!user?.id,
  });

  // Friends count for stats
  const { data: friends } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
  });

  let rawEvents: Event[] = eventsData?.pages.flatMap(page => page.data) || [];

  // Local filter layer to guarantee accuracy
  if (activeFilter && activeFilter !== 'discover') {
    const now = new Date();
    rawEvents = rawEvents.filter(ev => {
      const start = ev.startAt ? new Date(ev.startAt) : null;
      const end = (ev as any).endAt ? new Date((ev as any).endAt) : null;
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
        return start >= sat && start <= sun;
      }
      return true;
    });
  }

  const events: Event[] = rawEvents;
  // "À ne pas manquer" = top 6 by featured score
  const featuredEvents = sortFeaturedEvents(events).slice(0, 6);
  // "Populaires" = sorted by attendee count (independent list, no deduplication)
  const popularEvents = sortPopularEvents(events);

  // Real stats
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
  const allJoined: any[] = activity?.joinedEvents || [];
  const eventsThisWeek = events.filter(e => {
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
  });

  const ratingStr = myProfile?.detailedStats?.rating?.toFixed(1) ?? '0.0';
  const rating = parseFloat(ratingStr);
  const showSpinner = isLoading && rawEvents.length === 0 && !isOffline;

  const emptyStateLabel = (() => {
    switch (activeFilter) {
      case 'ongoing':  return 'Aucun événement en cours pour le moment.';
      case 'tonight':  return 'Aucun événement ce soir.';
      case 'tomorrow': return 'Aucun événement demain.';
      case 'weekend':  return 'Aucun événement ce week-end.';
      default:         return 'Aucun événement disponible.';
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
    if (!isOffline) await qc.invalidateQueries({ queryKey: ['events'] });
  };

  if (viewAll) {
    const listEvents = viewAll === 'featured' ? featuredEvents : popularEvents;
    const title = viewAll === 'featured' ? 'À ne pas manquer' : 'Événements populaires';
    
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
            <p className="text-center text-gray-500 py-10">Aucun événement disponible.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black overflow-hidden">
      {/* ── Fixed Header ── */}
      <div className="bg-white dark:bg-black z-20 flex-shrink-0 pt-safe-4">
        {/* Row 1: Avatar + greeting + notif + scan */}
        <div className="flex items-center gap-3 mb-4 px-4 pt-4">
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
            <h1 className="text-[17px] font-bold text-gray-900 dark:text-white leading-tight">
              Bienvenue, {displayName} 👋
            </h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">
              Prêt pour de <span className="text-[#FF7A00] font-semibold">nouvelles expériences</span> ?
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
        <div className="px-4 pb-3">
          <button
            onClick={() => onNavigate('explorer')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-[#1A1A1A] rounded-full text-left active:opacity-70 transition-opacity mb-4"
          >
            <Search01Icon className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
            <span className="flex-1 text-sm text-gray-400">Concerts, artistes, lieux, événements...</span>
            <div className="w-7 h-7 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M7 12h10M10 18h4" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </button>

          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {TIME_FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => { hapticFeedback.impact(); setActiveFilter(f.key); }}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all active:scale-95 whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FF7A00] text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400'
                  }`}
                >
                  <span className="text-[12px]">{f.icon}</span>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <PullToRefresh onRefresh={handleRefresh} isPullable={!isOffline}>
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
                  <p className="font-bold text-gray-800 dark:text-gray-200 text-base mb-1">Vous êtes hors ligne</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Connectez-vous à internet pour voir les événements.</p>
                </div>
                <button
                  onClick={() => qc.refetchQueries({ queryKey: ['events'] })}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF7A00] text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
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
                    <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">À ne pas manquer</h2>
                    <button onClick={() => setViewAll('featured')} className="text-[13px] font-semibold text-[#FF7A00]">Voir tout &gt;</button>
                  </div>

                  {isLoading ? (
                    <div className="flex gap-4 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: 'none' }}>
                      {[1, 2, 3].map(i => <FeaturedSkeleton key={i} />)}
                    </div>
                  ) : featuredEvents.length > 0 ? (
                    <>
                      <div
                        className="flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory"
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

                {/* ── Événements populaires ── */}
                <div className="pt-1 pb-1">
                  <div className="flex items-center justify-between px-4 mb-3">
                    <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Événements populaires</h2>
                    <button onClick={() => setViewAll('popular')} className="text-[13px] font-semibold text-[#FF7A00]">Voir tout &gt;</button>
                  </div>

                  {isLoading && popularEvents.length === 0 ? (
                    <div className="px-4 space-y-3">
                      {[1, 2, 3].map(i => <EventCardSkeleton key={i} />)}
                    </div>
                  ) : popularEvents.length === 0 ? (
                    <div className="flex flex-col items-center py-14 gap-3 text-center px-8">
                      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#2a2a2a] flex items-center justify-center text-2xl">📭</div>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{emptyStateLabel}</p>
                      <p className="text-xs text-gray-400">Essayez un autre créneau ou revenez plus tard.</p>
                    </div>
                  ) : (
                    <div className="px-4 space-y-3">
                      {popularEvents.map(event => (
                        <RowEventCard
                          key={event.id}
                          event={event}
                          onClick={() => onNavigate('event-details', event.id)}
                        />
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
    </div>
  );
}
