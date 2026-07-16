import { useState, useEffect, useRef } from 'react';
import { Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { Search01Icon } from 'hugeicons-react';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type Event } from '@/features/events/api';
import { useNotifications } from '@/features/notifications/api';
import { hapticFeedback } from '@/lib/haptics';
import PullToRefresh from 'react-simple-pull-to-refresh';
import { useIsOnline } from '@/hooks/useIsOnline';
import { PermissionsRequest } from './PermissionsRequest';
import { FeaturedEventCard, RowEventCard } from '@/components/ui/event-cards-v2';
import { sortFeaturedEvents, sortPopularEvents } from '@/utils/event-ranking';
import { Calendar01Icon, UserMultiple02Icon, FavouriteIcon, StarIcon } from 'hugeicons-react';

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
    <div className="flex w-full h-[110px] bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10 animate-pulse mb-4">
      <div className="w-[110px] h-full bg-gray-200" />
      <div className="flex-1 p-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 dark:bg-[#2a2a2a] rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 dark:bg-[#2a2a2a] rounded-full w-1/3" />
      </div>
    </div>
  );
}

function FeaturedEventCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[320px] sm:w-[350px] h-[200px] bg-white dark:bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-white/10 animate-pulse">
      <div className="h-full bg-gray-200" />
    </div>
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
      const loaded = allPages.reduce((acc, page) => acc + (page?.data?.length || 0), 0);
      return loaded < (lastPage?.total || 0) ? loaded : undefined;
    },
    initialPageParam: 0,
  });



  let rawEvents: Event[] = eventsData?.pages.flatMap(page => page.data) || [];
  
  // Appliquer le filtrage local pour garantir le bon fonctionnement
  if (activeFilter) {
    const now = new Date();
    rawEvents = rawEvents.filter(ev => {
      const start = ev.startAt ? new Date(ev.startAt) : null;
      const end = (ev as any).endAt ? new Date((ev as any).endAt) : null;
      if (!start) return false;
      
      if (activeFilter === 'ongoing') {
        return start <= now && (!end || end >= now);
      } else if (activeFilter === 'tonight') {
        const today = new Date(now); today.setHours(18,0,0,0);
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(6,0,0,0);
        return start >= today && start <= tomorrow;
      } else if (activeFilter === 'tomorrow') {
        const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
        const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
        return start >= tomorrow && start <= dayAfter;
      } else if (activeFilter === 'weekend') {
        const dayOfWeek = now.getDay();
        const daysToSat = (6 - dayOfWeek + 7) % 7 || 7;
        const sat = new Date(now); sat.setDate(now.getDate() + daysToSat); sat.setHours(0,0,0,0);
        const sun = new Date(sat); sun.setDate(sat.getDate() + 1); sun.setHours(23,59,59,999);
        return start >= sat && start <= sun;
      }
      return true;
    });
  }

  const events: Event[] = rawEvents;
  
  // Sort events based on the new ranking utility
  const featuredEvents = sortFeaturedEvents(events).slice(0, 5); // À ne pas manquer
  const popularEvents = sortPopularEvents(events).filter(e => !featuredEvents.find(f => f.id === e.id)); // Événements populaires (excluding featured)

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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bienvenue, {displayName}</h1>
          <button
            onClick={() => onNavigate('notifications')}
            className="w-10 h-10 flex items-center justify-center -mr-2"
          >
            <NotificationIconWithBadge unreadCount={unreadCount} className="w-8 h-8 text-gray-900 dark:text-white" />
          </button>
        </div>

        {/* Search bar */}
        <div className="flex items-center mb-4">
          <button
            onClick={() => onNavigate('explorer')}
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-[#2a2a2a] rounded-full text-left active:opacity-70 transition-opacity"
          >
            <Search01Icon className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
            <span className="text-sm text-gray-400">Concerts à proximité...</span>
          </button>
        </div>

        {/* Filter chips — tous visibles sans scroll, fond gris inactif, orange actif */}
        <div className="flex gap-1.5 pb-1" style={{ overflow: 'hidden' }}>
          {TIME_FILTERS.map((f, idx) => (
            <button
              key={`${f.key}-${idx}`}
              onClick={() => { hapticFeedback.impact(); setActiveFilter(f.key); }}
              className={`flex-1 py-1.5 rounded-full text-center transition-all active:scale-95 ${
                activeFilter === f.key
                  ? 'bg-[#FFF2D3] text-[#FF7A00]'
                  : 'bg-[#F2F2F2] text-[var(--color-text-secondary)]'
              }`}
            >
              <span className={`text-[12px] font-poppins whitespace-nowrap font-medium ${
                activeFilter === f.key ? 'font-semibold' : ''
              }`}>
                {f.label}
              </span>
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
                  <WifiOff className="w-8 h-8 text-action-primary" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 dark:text-gray-200 text-base mb-1">Vous êtes hors ligne</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Connectez-vous à internet pour voir les événements.</p>
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
                {/* ── Orange Stats Banner ── */}
                <div className="px-4 mt-2 mb-6">
                  <div className="w-full bg-gradient-to-br from-[#FF7A00] to-[#E56A00] rounded-[24px] p-5 shadow-lg flex justify-between items-start text-white">
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-1">
                        <Calendar01Icon size={18} strokeWidth={2} />
                      </div>
                      <span className="text-[20px] font-bold leading-none">12</span>
                      <span className="text-[9px] text-center font-medium opacity-90 leading-tight">Événements<br/>cette semaine</span>
                    </div>
                    
                    <div className="w-[1px] h-12 bg-white/20 my-auto mx-1" />
                    
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-1">
                        <UserMultiple02Icon size={18} strokeWidth={2} />
                      </div>
                      <span className="text-[20px] font-bold leading-none">345</span>
                      <span className="text-[9px] text-center font-medium opacity-90 leading-tight">Participants<br/>avec vous</span>
                    </div>
                    
                    <div className="w-[1px] h-12 bg-white/20 my-auto mx-1" />
                    
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-1">
                        <FavouriteIcon size={18} strokeWidth={2} />
                      </div>
                      <span className="text-[20px] font-bold leading-none">8</span>
                      <span className="text-[9px] text-center font-medium opacity-90 leading-tight">Événements<br/>rejoints</span>
                    </div>

                    <div className="w-[1px] h-12 bg-white/20 my-auto mx-1" />
                    
                    <div className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-1">
                        <StarIcon size={18} strokeWidth={2} />
                      </div>
                      <span className="text-[20px] font-bold leading-none">4.8</span>
                      <span className="text-[9px] text-center font-medium opacity-90 leading-tight">Note moyenne<br/>reçue</span>
                    </div>
                  </div>
                </div>

                {/* ── 1. À ne pas manquer (Featured - horizontal scroll) ── */}
                <div className="pt-2 pb-2">
                  <div className="flex items-center justify-between px-5 mb-3">
                    <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">À ne pas manquer</h2>
                    <span className="text-[12px] font-semibold text-[#FF7A00]">Voir tout &gt;</span>
                  </div>
                  {isLoading ? (
                    <div className="flex gap-4 overflow-x-auto px-4 pb-3 snap-x" style={{ scrollbarWidth: 'none' }}>
                      {Array.from({ length: 3 }).map((_, i) => <FeaturedEventCardSkeleton key={i} />)}
                    </div>
                  ) : featuredEvents.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto px-4 pb-3 snap-x" style={{ scrollbarWidth: 'none' }}>
                      {featuredEvents.map(event => (
                        <FeaturedEventCard 
                          key={event.id} 
                          event={event} 
                          onClick={() => onNavigate('event-details', event.id)} 
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 2. Événements populaires (Vertical feed) ── */}
                <div className="pt-6 pb-2">
                  <div className="flex items-center justify-between px-5 mb-3">
                    <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">Événements populaires</h2>
                    <span className="text-[12px] font-semibold text-[#FF7A00]">Voir tout &gt;</span>
                  </div>
                  
                  {isLoading && popularEvents.length === 0 ? (
                    <div className="px-4 space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => <EventCardSkeleton key={i} />)}
                    </div>
                  ) : popularEvents.length === 0 && featuredEvents.length === 0 ? (
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
