import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── EventRowCard Component ──────────────────────────────────────────────────
function EventRowCard({ event, onClick }: { event: any; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="w-full bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 p-3 flex gap-3 cursor-pointer active:scale-95 transition-transform shadow-sm"
    >
      <div 
        className="w-[80px] h-[80px] rounded-xl bg-gray-200 shrink-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${event.coverUrl || '/Checker.png'})` }}
      />
      <div className="flex flex-col justify-center flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-tight line-clamp-1">{event.title}</h3>
          {event.status === 'DRAFT' && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded">Brouillon</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span className="text-[12px]">{format(new Date(event.startAt), 'dd MMMM yyyy - HH:mm', { locale: fr })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span className="text-[12px]">{event.city ? event.city : 'En ligne'}</span>
        </div>
      </div>
    </div>
  );
}

// ── MyEvents Page ────────────────────────────────────────────────────────────
export function MyEvents() {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<'created' | 'joined'>('created');
  const [subTab, setSubTab] = useState<'ongoing' | 'past' | 'drafts'>('ongoing');

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
    } else {
      if (subTab === 'ongoing') return joinedOngoing;
      if (subTab === 'past') return joinedPast;
    }
    return [];
  }, [mainTab, subTab, createdOngoing, createdPast, createdDrafts, joinedOngoing, joinedPast]);

  const handleSubTabSwitch = (tab: 'ongoing' | 'past' | 'drafts') => setSubTab(tab);
  
  const handleMainTabSwitch = (tab: 'created' | 'joined') => {
    setMainTab(tab);
    if (tab === 'joined' && subTab === 'drafts') {
      setSubTab('ongoing'); // Joined doesn't have drafts
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
          
          {/* Main Tabs */}
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
          </div>

          {/* Sub Tabs */}
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
                <EventRowCard key={event.id} event={event} onClick={() => onEventClick(event)} />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
