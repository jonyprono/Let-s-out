import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { TopBar } from '@/components/ui/TopBar';
import { RowEventCard } from '@/components/ui/event-cards-v2';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/features/users/api';
import { useAuthStore } from '@/stores/auth.store';
import { useParams } from 'react-router';

export function JoinedEventsList() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const user = useAuthStore((s) => s.user);
  const targetUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

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

  const joinedEvents = activity?.joinedEvents ?? [];

  const upcomingEvents = useMemo(() => {
    return joinedEvents.filter((e: any) => e?.startAt && new Date(e.startAt) > new Date());
  }, [joinedEvents]);

  const pastEvents = useMemo(() => {
    return joinedEvents.filter((e: any) => e?.startAt && new Date(e.startAt) <= new Date());
  }, [joinedEvents]);

  // Aggregate stats
  const totalEvents = joinedEvents.length;
  const globalScore = profile?.detailedStats?.rating ? Number(profile.detailedStats.rating).toFixed(1) : 'N/A';

  const cagnottes = useMemo(() => {
    return joinedEvents.filter((e: any) => e.poolTarget != null || e.poolMode != null);
  }, [joinedEvents]);

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      
      {/* Header with Checker Pattern */}
      <div className="relative w-full pb-6" style={{ background: 'url(/Checker.png) top/cover no-repeat' }}>
        
        {/* Top Navbar */}
        <TopBar 
          title="Evénements rejoints"
          onBack={() => navigate(-1)}
          containerClassName="pt-12 pb-4 bg-transparent"
        />

        {/* Stats Card */}
        <div className="mx-4 bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center justify-between shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col items-center flex-1 border-r border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 rounded-full bg-[#FFF9EC] flex items-center justify-center mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF7A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <span className="text-[16px] font-bold text-gray-900 dark:text-white">{totalEvents}</span>
            <span className="text-[10px] text-gray-500 font-medium">Evénements</span>
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

        {isOwnProfile && (
          <button 
            onClick={() => setActiveTab('cagnottes')}
            className={`flex flex-row items-center px-3 py-2 gap-1 h-[36px] rounded-full transition-colors ${
              activeTab === 'cagnottes' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'cagnottes' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            <span className="font-poppins font-medium text-[12px] leading-[16px]">Cagnottes</span>
          </button>
        )}
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
                <RowEventCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}`)} />
              ))
            )}
          </div>

          <h2 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3 mt-6">Passés</h2>
          <div className="flex flex-col gap-3">
            {pastEvents.length === 0 ? (
              <p className="text-[13px] text-gray-400">Aucun événement passé.</p>
            ) : (
              pastEvents.map((ev: any) => (
                <RowEventCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}`)} />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-20">
          <h2 className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 mb-3">Mes participations</h2>
          <div className="flex flex-col gap-3">
            {cagnottes.length === 0 ? (
              <p className="text-[13px] text-gray-400">Vous n'avez participé à aucune cagnotte.</p>
            ) : (
              cagnottes.map((ev: any) => (
                <RowEventCard key={ev.id} event={ev} onClick={() => navigate(`/events/${ev.id}`)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
