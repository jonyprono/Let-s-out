import { useState } from 'react';
import { Loader2, Calendar, Star } from 'lucide-react';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/features/users/api';
import { hapticFeedback } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth.store';
import { useNotifications } from '@/features/notifications/api';
import { EventCard } from '@/components/shared/EventCard';
import { useFavoritesStore } from '@/stores/favorites.store';
import { getEventParticipationMode } from '@/lib/utils';
import { ToggleButton } from '@/components/ui/toggle-button';

import { useLocation } from 'react-router';

interface MyEventsProps {
  onNavigate: (screen: string, id?: string) => void;
}

type TabKey = 'upcoming' | 'favorites' | 'past';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'favorites', label: 'Favoris' },
  { key: 'past', label: 'Passés' },
];

function formatPrice(event: any): string {
  const mode = getEventParticipationMode(event);
  if (mode !== 'Gratuit') return mode;
  if (event.price === 0) return 'Gratuit';
  const currency = event.currency || 'XOF';
  if (currency === 'XOF' || currency === 'CFA') return `${Number(event.price).toLocaleString('fr-FR')} F`;
  if (currency === 'EUR') return `${event.price} €`;
  return `${event.price} ${currency}`;
}

export function MyEvents({ onNavigate }: MyEventsProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabKey>(location.state?.tab || 'upcoming');
  const user = useAuthStore(state => state.user);

  const { data: notifData } = useNotifications();
  const unreadCount = (notifData as any)?.unreadCount ?? 0;

  const { data: activity, isLoading } = useQuery({
    queryKey: ['users', 'activity', user?.id],
    queryFn: () => usersApi.getActivity(user!.id),
    enabled: !!user?.id,
  });

  const now = new Date();
  const allJoined: any[] = activity?.joinedEvents || [];
  const allPast: any[] = activity?.pastEvents || [];
  const upcomingEvents = allJoined.filter((e: any) => e?.startAt && new Date(e.startAt) >= now);
  
  const { favorites } = useFavoritesStore();
  const favoriteEvents: any[] = Object.values(favorites).sort((a, b) => {
    if (!a?.startAt || !b?.startAt) return 0;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  const currentList = (() => {
    switch (activeTab) {
      case 'upcoming': return upcomingEvents;
      case 'favorites': return favoriteEvents;
      case 'past': return allPast;
    }
  })();

  const isCurrentLoading = isLoading;

  /** Render badge per tab */
  const renderBadge = (event: any) => {
    switch (activeTab) {
      case 'upcoming':
        return (
          <span className="px-3 py-1 rounded-lg bg-[#E6F9F1] text-[#00A859] text-[12px] font-bold whitespace-nowrap">
            Vous participez
          </span>
        );
      case 'favorites':
        return (
          <span className="px-3 py-1 rounded-lg text-[12px] font-bold whitespace-nowrap text-action-primary">
            {formatPrice(event)}
          </span>
        );
      case 'past':
        return (
          <span className="flex items-center gap-1 text-[12px] font-bold text-gray-700 whitespace-nowrap">
            <Star className="w-4 h-4 text-action-primary fill-action-primary" />
            {event.rating ? `${event.rating}` : '4,5'} · {event.reviewCount ?? 60} avis
          </span>
        );
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">

      {/* ── Header ── */}
      <div className="px-5 pt-6 pt-safe-6 pb-4 flex-shrink-0 flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-gray-900 dark:text-white">Mes événements</h1>
          <button
            onClick={() => onNavigate('notifications')}
            className="w-10 h-10 flex items-center justify-center -mr-2"
          >
            <NotificationIconWithBadge unreadCount={unreadCount} className="w-8 h-8 text-gray-900 dark:text-white" />
          </button>
      </div>

      {/* ── Tabs (pill style) ── */}
      <div className="px-5 pb-4 flex-shrink-0">
        <ToggleButton
          options={TABS.map(t => ({ label: t.label, value: t.key }))}
          value={activeTab}
          onChange={(val) => { hapticFeedback.impact(); setActiveTab(val as TabKey); }}
          className="w-full flex-wrap sm:flex-nowrap"
        />
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
        {isCurrentLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-action-primary" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-[#2a2a2a] rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Aucun événement</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-[250px]">
              {activeTab === 'upcoming' && "Vous n'avez pas d'événement prévu prochainement."}
              {activeTab === 'favorites' && "Vous n'avez aucun événement en favori."}
              {activeTab === 'past' && "Vous n'avez pas encore participé à des événements."}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => onNavigate('explorer')}
                className="mt-6 px-6 py-3 bg-action-primary text-white rounded-full font-bold text-sm"
              >
                Explorer les événements
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {currentList.map((event: any) => (
              <EventCard
                key={event.id}
                event={event}
                badge={renderBadge(event)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
