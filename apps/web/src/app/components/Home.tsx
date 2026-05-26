import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Loader2, SlidersHorizontal, QrCode, WifiOff, RefreshCw } from 'lucide-react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type Event } from '@/features/events/api';
import { useNotifications } from '@/features/notifications/api';
import { usersApi } from '@/features/users/api';
import { hapticFeedback } from '@/lib/haptics';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useIsOnline } from '@/hooks/useIsOnline';
import { PermissionsRequest } from './PermissionsRequest';
import { EventCard } from '@/components/shared/EventCard';

interface HomeProps {
  userData: any;
  onNavigate: (screen: string, id?: string) => void;
}

// Time-based filter chips matching the design
const TIME_FILTERS = [
  { key: 'ongoing', label: 'En cours' },
  { key: 'tonight', label: 'Ce soir' },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'weekend', label: 'Ce week-end' },
];

function getTimeFilter(key: string): { upcoming?: boolean; status?: string; date?: string; time?: string; ongoing?: string } {
  switch (key) {
    case 'ongoing': return { status: 'PUBLISHED', ongoing: 'true' };
    case 'tonight': return { status: 'PUBLISHED', upcoming: true, date: 'today', time: 'evening' };
    case 'tomorrow': return { status: 'PUBLISHED', upcoming: true, date: 'tomorrow' };
    case 'weekend': return { status: 'PUBLISHED', upcoming: true, date: 'weekend' };
    default: return { status: 'PUBLISHED', upcoming: true };
  }
}


// ── Skeleton loaders ───────────────────────────────────────────────────────────
function EventCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse mb-4">
      <div className="h-44 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        <div className="h-6 bg-gray-100 rounded-full w-full mt-2" />
      </div>
    </div>
  );
}

function EventCardSkeletonHorizontal() {
  return (
    <div className="flex-shrink-0 w-[280px] bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
      </div>
    </div>
  );
}



// ── Section title ──────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[17px] font-bold text-gray-900 px-5 mb-3">{children}</h2>
  );
}

// ── Main Home component ────────────────────────────────────────────────────────
export function Home({ userData, onNavigate }: HomeProps) {
  const [activeFilter, setActiveFilter] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);
  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);
  const qc = useQueryClient();
  const isOffline = !useIsOnline();

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
      eventsApi.list({ limit: 20, offset: pageParam, ...queryParams }).then(r => r.data),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, page) => acc + page.data.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const { data: recommendedData, isLoading: isRecommendedLoading } = useQuery({
    queryKey: ['events', 'recommended'],
    queryFn: () => eventsApi.getRecommended().then(r => r.data),
  });

  // My upcoming events
  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', userData?.id],
    queryFn: () => usersApi.getActivity(userData!.id),
    enabled: !!userData?.id,
  });
  const now = new Date();
  const myOngoingEvents: any[] = (activity?.createdEvents || []).filter((e: any) => new Date(e.startAt) >= now);

  const rawEvents: Event[] = eventsData?.pages.flatMap(page => page.data) || [];
  const events: Event[] = rawEvents;
  const recommendedEvents: Event[] = recommendedData?.data || events.slice(0, 5);

  // Split feed: first 3 as vertical, rest as "Les plus populaires" horizontal
  const feedEvents = events.slice(0, 3);
  const popularEvents = events.slice(3);

  const showSpinner = isLoading && rawEvents.length === 0 && !isOffline;

  const emptyStateLabel = (() => {
    switch (activeFilter) {
      case 'ongoing': return 'Aucun événement en cours pour le moment.';
      case 'tonight': return 'Aucun événement ce soir.';
      case 'tomorrow': return 'Aucun événement demain.';
      case 'weekend': return 'Aucun événement ce week-end.';
      default: return 'Aucun événement pour ce créneau.';
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

  const displayName = (userData?.firstName || 'vous').split(' ')[0];

  const handleRefresh = async () => {
    if (!isOffline) await qc.invalidateQueries({ queryKey: ['events'] });
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">

      {/* ── Header ── */}
      <div className="px-5 pt-5 pt-safe-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Bienvenue, {displayName}</h1>
          <button
            onClick={() => onNavigate('notifications')}
            className="relative w-10 h-10 flex items-center justify-center"
          >
            <Bell className="w-6 h-6 text-gray-700" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#FF9F1C] text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => onNavigate('explorer')}
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-full text-left"
          >
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-400">Concerts à proximité...</span>
          </button>
          <button
            onClick={() => onNavigate('explorer-filter')}
            className="w-11 h-11 flex items-center justify-center bg-gray-100 rounded-full flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => onNavigate('scan-qr')}
            className="w-11 h-11 flex items-center justify-center bg-[#FFF8F1] rounded-full flex-shrink-0 ml-1"
          >
            <QrCode className="w-4 h-4 text-[#FF9F1C]" />
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {TIME_FILTERS.map((f, idx) => (
            <button
              key={`${f.key}-${idx}`}
              onClick={() => { hapticFeedback.impact(); setActiveFilter(f.key); }}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap font-medium transition-colors flex-shrink-0 ${
                activeFilter === f.key
                  ? 'bg-action-primary text-text-inverse border border-action-primary'
                  : 'text-gray-600 border border-gray-200 bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <PullToRefresh onRefresh={handleRefresh} isPullable={!isOffline}>
          <div className="pb-28">

            {showSpinner && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-gray-400" />
              </div>
            )}

            {/* Offline state */}
            {isOffline && rawEvents.length === 0 && !showSpinner && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center">
                  <WifiOff className="w-8 h-8 text-[#FF9F1C]" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-base mb-1">Vous êtes hors ligne</p>
                  <p className="text-sm text-gray-500">Connectez-vous à internet pour voir les événements.</p>
                </div>
                <button
                  onClick={() => qc.refetchQueries({ queryKey: ['events'] })}
                  className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
                </button>
              </div>
            )}

            {!showSpinner && !isOffline && (
              <>
                {/* ── 1. Vos événements en cours ── */}
                {myOngoingEvents.length > 0 && (
                  <div className="pt-5 pb-2">
                    <SectionTitle>Vos événements en cours</SectionTitle>
                    <div className="px-5 space-y-4">
                      {myOngoingEvents.slice(0, 1).map((event: any) => (
                        <EventCard key={event.id} event={event} onNavigate={onNavigate} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── 2. Recommandé pour vous (horizontal scroll) ── */}
                {(recommendedEvents.length > 0 || isRecommendedLoading) && (
                  <div className="pt-5 pb-2">
                    <SectionTitle>Recommandé pour vous</SectionTitle>
                    {isRecommendedLoading ? (
                      <div className="flex gap-4 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
                        {Array.from({ length: 3 }).map((_, i) => <EventCardSkeletonHorizontal key={i} />)}
                      </div>
                    ) : (
                      <div className="flex gap-4 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
                        {recommendedEvents.map(event => (
                          <EventCard key={event.id} event={event} horizontal onNavigate={onNavigate} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 3. Vertical event feed ── */}
                {isLoading && events.length === 0 ? (
                  <div className="px-5 pt-5 space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => <EventCardSkeleton key={i} />)}
                  </div>
                ) : events.length === 0 ? (
                  <div className="flex flex-col items-center py-14 gap-3 text-center px-8">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">📭</div>
                    <p className="text-sm font-semibold text-gray-600">{emptyStateLabel}</p>
                    <p className="text-xs text-gray-400">Essayez un autre créneau ou revenez plus tard.</p>
                  </div>
                ) : (
                  <>
                    {feedEvents.length > 0 && (
                      <div className="px-5 pt-2 space-y-4">
                        {feedEvents.map(event => (
                          <EventCard key={event.id} event={event} onNavigate={onNavigate} />
                        ))}
                      </div>
                    )}

                    {/* ── 4. Les plus populaires (horizontal scroll) ── */}
                    {popularEvents.length > 0 && (
                      <div className="pt-6 pb-2">
                        <SectionTitle>Les plus populaires</SectionTitle>
                        <div className="flex gap-4 overflow-x-auto px-5 pb-3" style={{ scrollbarWidth: 'none' }}>
                          {popularEvents.map(event => (
                            <EventCard key={event.id} event={event} horizontal onNavigate={onNavigate} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Infinite scroll trigger */}
                    <div ref={bottomRef} className="h-10 mt-4 flex items-center justify-center">
                      {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-gray-400" />}
                    </div>
                  </>
                )}
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
