import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/features/users/api';
import { useAuthStore } from '@/stores/auth.store';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function CreatedEventsList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const targetUserId = user?.id;

  const [activeTab, setActiveTab] = useState<'events' | 'cagnottes'>('events');

  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', targetUserId],
    queryFn: () => usersApi.getActivity(targetUserId!),
    enabled: !!targetUserId,
  });

  const { data: profile } = useQuery({
    queryKey: ['users', targetUserId],
    queryFn: () => usersApi.getById(targetUserId!),
    enabled: !!targetUserId,
  });

  const createdEvents = activity?.createdEvents ?? [];
  const drafts = activity?.draftEvents ?? [];

  const publishedEvents = createdEvents;

  const upcomingEvents = useMemo(() => {
    return publishedEvents.filter((e: any) => new Date(e.startAt) > new Date());
  }, [publishedEvents]);

  const pastEvents = useMemo(() => {
    return publishedEvents.filter((e: any) => new Date(e.startAt) <= new Date());
  }, [publishedEvents]);

  // Aggregate stats
  const totalEvents = createdEvents.length;
  // Approximated participants. We would ideally need real booking counts from API.
  const totalParticipants = createdEvents.reduce((acc: number, e: any) => acc + (e._count?.bookings || 0), 0);
  const globalScore = profile?.detailedStats?.rating ? Number(profile.detailedStats.rating).toFixed(1) : 'N/A';

  const cagnottes = useMemo(() => {
    return createdEvents.filter((e: any) => e.poolTarget != null || e.poolMode != null);
  }, [createdEvents]);

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      
      {/* Header with Checker Pattern */}
      <div className="relative w-full pb-6" style={{ background: 'url(/Checker.png) top/cover no-repeat' }}>
        
        {/* Top Navbar */}
        <div className="flex items-center px-4 pt-12 pb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-500">
            <ArrowLeft01Icon className="w-6 h-6" />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 ml-2">Evénements créés</h1>
        </div>

        {/* Stats Card */}
        <div className="mx-4 bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col items-center flex-1 border-r border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 rounded-full bg-[#FFF9EC] flex items-center justify-center mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <span className="text-[16px] font-bold text-gray-900 dark:text-white">{totalEvents}</span>
            <span className="text-[10px] text-gray-500 font-medium">Evénements</span>
          </div>

          <div className="flex flex-col items-center flex-1 border-r border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 rounded-full bg-[#FFF9EC] flex items-center justify-center mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <span className="text-[16px] font-bold text-gray-900 dark:text-white">{totalParticipants || 0}</span>
            <span className="text-[10px] text-gray-500 font-medium">Participants</span>
          </div>

          <div className="flex flex-col items-center flex-1">
            <div className="w-8 h-8 rounded-full bg-[#FFF9EC] flex items-center justify-center mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <span className="text-[16px] font-bold text-gray-900 dark:text-white">{globalScore}</span>
            <span className="text-[10px] text-gray-500 font-medium">Score global</span>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex flex-row justify-center items-start p-0 gap-2 w-full max-w-[358px] mx-auto mb-6 h-[36px]">
        <button 
          onClick={() => setActiveTab('events')}
          className={`flex flex-row items-center px-3 py-2 gap-1 h-[36px] rounded-full transition-colors ${
            activeTab === 'events' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'events' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span className="font-poppins font-medium text-[12px] leading-[16px]">Evénements</span>
        </button>

        <button 
          onClick={() => setActiveTab('cagnottes')}
          className={`flex flex-row items-center px-3 py-2 gap-1 h-[36px] rounded-full transition-colors ${
            activeTab === 'cagnottes' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'cagnottes' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          <span className="font-poppins font-medium text-[12px] leading-[16px]">Cagnottes</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'events' ? (
        <div className="px-4 pb-20">
          <h2 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3">A venir</h2>
          <div className="flex flex-col gap-3 mb-6">
            {upcomingEvents.length === 0 ? (
              <p className="text-[13px] text-gray-400">Aucun événement à venir.</p>
            ) : (
              upcomingEvents.map((ev: any) => (
                <EventRowCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}/manage`)} />
              ))
            )}
          </div>

          <h2 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-6">Passés</h2>
          <div className="flex flex-col gap-3">
            {pastEvents.length === 0 ? (
              <p className="text-[13px] text-gray-400">Aucun événement passé.</p>
            ) : (
              pastEvents.map((ev: any) => (
                <EventRowCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}/manage`)} />
              ))
            )}
          </div>

          {drafts.length > 0 && (
            <>
              <h2 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-6">Non publiés (Brouillons)</h2>
              <div className="flex flex-col gap-3">
                {drafts.map((ev: any) => (
                  <EventRowCard key={ev.id} event={ev} onClick={() => navigate(`/events/create`, { state: { editEventId: ev.id, eventData: ev } })} />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="px-4 pb-20">
          {cagnottes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-[13px] text-gray-500">Aucune cagnotte pour le moment.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cagnottes.map((ev: any) => (
                <CagnotteRowCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}?tab=pool`)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CagnotteRowCard({ event, onClick }: { event: any; onClick: () => void }) {
  const target = event.poolTarget || 0;
  const collected = event.poolCollected || 0;
  const remaining = Math.max(0, target - collected);
  const progress = target > 0 ? Math.round((collected / target) * 100) : 0;

  return (
    <div 
      onClick={onClick}
      className="w-full bg-white dark:bg-[#1A1A1A] rounded-[16px] border border-gray-100 dark:border-gray-800 p-4 flex flex-col gap-3 cursor-pointer active:scale-95 transition-transform shadow-sm"
    >
      <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800 border-dashed">
        <h3 className="text-[16px] font-bold text-[#FF7A00]">Cagnotte</h3>
        <span className="text-[12px] text-gray-500 font-medium truncate max-w-[150px]">{event.title}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-gray-500 font-medium">Objectif</span>
          <span className="text-[13px] font-bold text-[#2878E8]">{target.toLocaleString()} F CFA</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-gray-500 font-medium">Collecté</span>
          <span className="text-[13px] font-bold text-[#4CAF50]">{collected.toLocaleString()} F</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-gray-500 font-medium">Restant</span>
          <span className="text-[13px] font-bold text-[#FF7A00]">{remaining.toLocaleString()} F</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-gray-500 font-medium">Progression</span>
          <span className="text-[12px] font-bold bg-[#FF7A00] text-white px-1.5 py-0.5 rounded">{progress}%</span>
        </div>
      </div>
    </div>
  )
}

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
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-tight mb-1">{event.title}</h3>
        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span className="text-[12px]">{format(new Date(event.startAt), 'dd MMMM yyyy - HH:mm', { locale: fr })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span className="text-[12px]">{event.city ? `${event.city}` : 'En ligne'}</span>
        </div>
      </div>
    </div>
  );
}
