import { useState } from 'react';
import { Bell, Loader2, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/features/users/api';
import { hapticFeedback } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth.store';
import { useNotifications } from '@/features/notifications/api';
import { EventCard } from '@/components/shared/EventCard';
import { useFavoritesStore } from '@/stores/favorites.store';

interface MyEventsProps {
  onNavigate: (screen: string, id?: string) => void;
}

type TabKey = 'upcoming' | 'favorites' | 'past';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'upcoming', label: 'À venir' },
  { key: 'favorites', label: 'Favoris' },
  { key: 'past', label: 'Passés' },
];


export function MyEvents({ onNavigate }: MyEventsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming');
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
  const upcomingEvents = allJoined.filter((e: any) => new Date(e.startAt) >= now);
  
  const { favorites } = useFavoritesStore();
  const favoriteEvents: any[] = Object.values(favorites).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const currentList = (() => {
    switch (activeTab) {
      case 'upcoming': return upcomingEvents;
      case 'favorites': return favoriteEvents;
      case 'past': return allPast;
    }
  })();

  const isCurrentLoading = isLoading;

  return (
    <div className="w-full h-full flex flex-col bg-background">

      {/* ── Header ── */}
      <div className="px-5 pt-6 pt-safe-6 pb-4 flex-shrink-0 flex items-center justify-between">
        <h1 className="text-[24px] font-bold text-gray-900">Mes événements</h1>
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

      {/* ── Tabs (pill style: active = orange, inactive = plain text) ── */}
      <div className="flex gap-3 px-5 pb-4 flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { hapticFeedback.impact(); setActiveTab(tab.key); }}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#FF9F1C] text-white'
                : 'text-gray-500 bg-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-28" style={{ scrollbarWidth: 'none' }}>
        {isCurrentLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF9F1C]" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Aucun événement</h3>
            <p className="text-gray-500 text-sm max-w-[250px]">
              {activeTab === 'upcoming' && "Vous n'avez pas d'événement prévu prochainement."}
              {activeTab === 'favorites' && "Vous n'avez aucun événement en favori."}
              {activeTab === 'past' && "Vous n'avez pas encore participé à des événements."}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => onNavigate('explorer')}
                className="mt-6 px-6 py-3 bg-[#FF9F1C] text-white rounded-full font-bold text-sm"
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
                badge={
                  activeTab === 'upcoming' ? (
                    <span className="px-3 py-1 rounded-lg bg-[#E6F9F1] text-[#00A859] text-[12px] font-bold whitespace-nowrap">
                      Vous participez
                    </span>
                  ) : undefined
                }
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


