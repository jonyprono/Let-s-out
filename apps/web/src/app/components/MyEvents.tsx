import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { RowEventCard } from '@/components/ui/event-cards-v2';
import { useFavoritesStore } from '@/stores/favorites.store';


// ── MyEvents Page ────────────────────────────────────────────────────────────
export function MyEvents() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mainTab, setMainTab] = useState<'created' | 'joined' | 'favorites'>('created');
  const [subTab, setSubTab] = useState<'ongoing' | 'past' | 'drafts'>('ongoing');

  useEffect(() => {
    if (location.state?.tab === 'favorites') {
      setMainTab('favorites');
    }
  }, [location.state]);

  const favoritesObj = useFavoritesStore(s => s.favorites);
  const favoriteEvents = useMemo(() => Object.values(favoritesObj), [favoritesObj]);

  const { data: myEventsResponse, isLoading } = useQuery({
    queryKey: ['my-events'],
    queryFn: async () => {
      const { data } = await apiClient.get('/events/me');
      return data;
    }
  });

  const createdEvents = myEventsResponse?.data?.createdEvents || [];
  const joinedEvents = myEventsResponse?.data?.joinedEvents || [];

  const now = new Date();

  // Created Filters
  const createdOngoing = createdEvents.filter((e: any) => e.status === 'PUBLISHED' && new Date(e.endAt) >= now);
  const createdPast = createdEvents.filter((e: any) => e.status === 'PUBLISHED' && new Date(e.endAt) < now);
  const createdDrafts = createdEvents.filter((e: any) => e.status === 'DRAFT');

  // Joined Filters
  const joinedOngoing = joinedEvents.filter((e: any) => new Date(e.endAt) >= now);
  const joinedPast = joinedEvents.filter((e: any) => new Date(e.endAt) < now);

  const displayedEvents = useMemo(() => {
    if (mainTab === 'created') {
      if (subTab === 'ongoing') return createdOngoing;
      if (subTab === 'past') return createdPast;
      if (subTab === 'drafts') return createdDrafts;
    } else if (mainTab === 'joined') {
      if (subTab === 'ongoing') return joinedOngoing;
      if (subTab === 'past') return joinedPast;
    } else if (mainTab === 'favorites') {
      return favoriteEvents;
    }
    return [];
  }, [mainTab, subTab, createdOngoing, createdPast, createdDrafts, joinedOngoing, joinedPast, favoriteEvents]);

  const handleSubTabSwitch = (tab: 'ongoing' | 'past' | 'drafts') => setSubTab(tab);
  
  const handleMainTabSwitch = (tab: 'created' | 'joined' | 'favorites') => {
    setMainTab(tab);
    if ((tab === 'joined' || tab === 'favorites') && subTab === 'drafts') {
      setSubTab('ongoing'); // Joined/Favorites don't have drafts
    }
  };

  const onEventClick = (event: any) => {
    // If it's a draft, go to create/edit page, else go to details or manage
    if (event.status === 'DRAFT') {
      navigate('/events/create', { state: { editEventId: event.id, eventData: event } });
    } else {
      if (mainTab === 'created') {
        navigate(`/events/${event.id}/manage`);
      } else {
        navigate(`/events/${event.id}`);
      }
    }
  };

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#FAFAFA] dark:bg-[#111]">
      {/* Header */}
      <div className="pt-[env(safe-area-inset-top,44px)] pb-3 px-4 flex items-center justify-between sticky top-0 bg-[#FAFAFA]/95 dark:bg-[#111]/95 backdrop-blur-md z-50 border-b border-gray-100 dark:border-[#222]">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-black dark:text-white active:opacity-50">
          <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
        </button>
        <h1 className="text-[17px] font-bold text-black dark:text-white tracking-tight">Mes Événements</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="p-4 space-y-5">
          
          <div className="flex bg-gray-200/60 dark:bg-[#222] p-1 rounded-xl">
            <button
              onClick={() => handleMainTabSwitch('created')}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${mainTab === 'created' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Créés
            </button>
            <button
              onClick={() => handleMainTabSwitch('joined')}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${mainTab === 'joined' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Rejoints
            </button>
            <button
              onClick={() => handleMainTabSwitch('favorites')}
              className={`flex-1 py-2 text-[14px] font-semibold rounded-lg transition-all ${mainTab === 'favorites' ? 'bg-white dark:bg-[#333] shadow-sm text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
            >
              Favoris
            </button>
          </div>

          {/* Sub Tabs */}
          {mainTab !== 'favorites' && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              <button
                onClick={() => handleSubTabSwitch('ongoing')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${subTab === 'ongoing' ? 'bg-[#FF7A00] text-white' : 'bg-white dark:bg-[#222] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#333]'}`}
              >
                En cours
              </button>
              <button
                onClick={() => handleSubTabSwitch('past')}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${subTab === 'past' ? 'bg-[#FF7A00] text-white' : 'bg-white dark:bg-[#222] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#333]'}`}
              >
                Passés
              </button>
              {mainTab === 'created' && (
                <button
                  onClick={() => handleSubTabSwitch('drafts')}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${subTab === 'drafts' ? 'bg-[#FF7A00] text-white' : 'bg-white dark:bg-[#222] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-[#333]'}`}
                >
                  Brouillons
                </button>
              )}
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-[#FF7A00] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : displayedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-[#222] rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl">📅</span>
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white mb-2">Aucun événement</h3>
              <p className="text-[14px] text-gray-500 dark:text-gray-400">
                Vous n'avez aucun événement dans cette catégorie pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-safe">
              {displayedEvents.map((event: any) => (
                <RowEventCard key={event.id} event={event} onClick={() => onEventClick(event)} />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
