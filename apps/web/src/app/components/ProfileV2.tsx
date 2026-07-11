import { useState } from 'react';
import { Settings, UserPlus, Calendar, Users, Activity, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { SafeImage } from '@/components/shared/SafeImage';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { usersApi } from '@/features/users/api';

import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/shared/EventCard';

interface ProfileProps {
  onNavigate: (screen: string, params?: any) => void;
}

type Tab = 'profil' | 'events';

export function ProfileV2({ onNavigate }: ProfileProps) {
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('profil');
  const { username } = useParams<{ username?: string }>();

  const targetUsername = username || profile?.username;
  const isOwnProfile = !username || (!!profile?.username && username === profile?.username);

  const { data: viewedProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-profile', targetUsername],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${targetUsername}`);
      return data;
    },
    enabled: !!targetUsername,
  });

  const displayProfile = viewedProfile || profile;
  const targetUserId = displayProfile?.userId || displayProfile?.user?.id;

  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', targetUserId],
    queryFn: () => usersApi.getActivity(targetUserId!),
    enabled: !!targetUserId,
  });

  const displayName = isOwnProfile
    ? (profile?.displayName || 'Mon Profil')
    : (displayProfile?.displayName || displayProfile?.username || username || 'Utilisateur');
  const city = displayProfile?.city || '';
  const bio = displayProfile?.bio || '';



  // Followers / Friends queries can be kept if we still need them, but the mockups only show "Amis" count
  const { data: friendsData } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
    enabled: !!user?.id && isOwnProfile,
  });

  const createdEvents = activity?.createdEvents ?? [];
  const pastEvents = activity?.pastEvents ?? []; // Used for "Rejoints" count
  const upcomingEvents = createdEvents.slice(0, 5); // Example: just to show some next events
  const friends = friendsData ?? [];

  const rating = viewedProfile?.detailedStats?.rating?.toFixed(1) || '4.8'; // Default mock rating

  if (username && !isOwnProfile && !viewedProfile && isLoadingProfile) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0b]">
        <div className="flex flex-col items-center gap-150">
          <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const coverUrl = displayProfile?.coverUrl || ''; // We assume the user profile might have a coverUrl in the future.

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      
      {/* Dynamic Cover Header */}
      <div 
        className="w-full h-[200px] relative flex flex-col justify-between pt-12 pb-3 px-4"
        style={{
          background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : 'url(/Checker.png) center/cover repeat',
          borderBottom: '1px solid #D4D4D4'
        }}
      >
        <div className="flex items-center justify-between z-10">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg shadow-sm border border-gray-200">
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
          
          {isOwnProfile && (
            <button onClick={() => onNavigate('settings')} className="w-9 h-9 flex items-center justify-center bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg shadow-sm border border-gray-200">
              <Settings className="w-5 h-5 text-gray-700 dark:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="flex flex-col items-center -mt-10 mb-4 z-10 px-4">
        {/* Avatar */}
        <div className="w-[68px] h-[68px] rounded-full ring-4 ring-[#F9F9F9] dark:ring-[#0a0a0b] overflow-hidden bg-gray-200 shadow-sm relative mb-2">
          <SafeImage src={displayProfile?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500 bg-gray-100">{displayName.charAt(0).toUpperCase()}</div>} />
        </div>

        {/* Name and Location */}
        <div className="flex items-center gap-1">
          <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white leading-tight font-poppins">{displayName}</h2>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8ZM7.04289 11.9571C7.30325 12.2175 7.72535 12.2175 7.9857 11.9571L12.4857 7.45711C12.7461 7.19675 12.7461 6.77465 12.4857 6.51429C12.2254 6.25393 11.8033 6.25393 11.5429 6.51429L7.51429 10.5429L4.45711 7.48571C4.19675 7.22535 3.77465 7.22535 3.51429 7.48571C3.25393 7.74607 3.25393 8.16817 3.51429 8.42853L7.04289 11.9571Z" fill="#2878E8"/>
          </svg>
        </div>
        <div className="flex items-center gap-1 mt-0.5 mb-2">
          {city && <span className="text-[12px] text-gray-500 font-medium font-inter">{city} · </span>}
          <span className="text-[12px] text-gray-500 font-medium font-inter">Membre depuis {new Date(displayProfile?.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
        </div>

        {/* Bio */}
        {bio ? (
           <p className="text-[13px] text-gray-600 dark:text-gray-300 text-center px-4 mb-4">{bio}</p>
        ) : (
           <p className="text-[13px] text-gray-600 dark:text-gray-300 text-center px-4 mb-4">Amatrice de sorties. Fan de musique, food & nouvelles rencontres.</p>
        )}

        {/* Public Profile Actions */}
        {!isOwnProfile && (
          <div className="flex gap-2 w-full max-w-sm px-4 mb-4">
            <Button variant="outline" className="flex-1 rounded-full h-9 text-[13px] font-semibold flex items-center justify-center gap-2 border-gray-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg> Suivre
            </Button>
            <Button variant="outline" className="flex-1 rounded-full h-9 text-[13px] font-semibold flex items-center justify-center gap-2 border-gray-200">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Écrire
            </Button>
            <Button variant="outline" className="flex-1 rounded-full h-9 text-[13px] font-semibold flex items-center justify-center gap-2 border-gray-200">
              <UserPlus className="w-4 h-4" /> Ajouter
            </Button>
          </div>
        )}
      </div>

      {/* Main Toggle Profil/Evenements */}
      <div className="flex justify-center w-full px-4 mb-6">
        <div className="flex p-1 bg-white border border-gray-100 rounded-full shadow-sm">
          <button 
            onClick={() => setActiveTab('profil')}
            className={`flex items-center justify-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium transition-colors ${activeTab === 'profil' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-transparent text-gray-500'}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profil
          </button>
          <button 
            onClick={() => setActiveTab('events')}
            className={`flex items-center justify-center gap-2 px-5 py-2 rounded-full text-[13px] font-medium transition-colors ${activeTab === 'events' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-transparent text-gray-500'}`}
          >
            <Calendar className="w-[18px] h-[18px]" />
            Événements
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex-1 pb-10 bg-white rounded-t-3xl border-t border-gray-100 pt-6 px-4">
        {activeTab === 'profil' && (
          <div className="space-y-8">
            
            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-2 bg-[#FEFEFA] border border-[#F5F5F4] rounded-2xl py-3 px-2">
              <div className="flex flex-col items-center gap-1 border-r border-[#F5F5F4]">
                <div className="w-7 h-7 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-[#FF7A00]" />
                </div>
                <div className="text-center">
                  <p className="font-poppins font-medium text-[15px] text-gray-700 leading-tight">{createdEvents.length}</p>
                  <p className="font-inter text-[10px] text-gray-500">Créés</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 border-r border-[#F5F5F4]">
                <div className="w-7 h-7 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-[#FF7A00]" />
                </div>
                <div className="text-center">
                  <p className="font-poppins font-medium text-[15px] text-gray-700 leading-tight">{pastEvents.length}</p>
                  <p className="font-inter text-[10px] text-gray-500">Rejoints</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1 border-r border-[#F5F5F4]">
                <div className="w-7 h-7 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-[#FF7A00]" />
                </div>
                <div className="text-center">
                  <p className="font-poppins font-medium text-[15px] text-gray-700 leading-tight">{friends.length || 100}</p>
                  <p className="font-inter text-[10px] text-gray-500">Amis</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#FF7A00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
                <div className="text-center">
                  <p className="font-poppins font-medium text-[15px] text-gray-700 leading-tight">{rating}</p>
                  <p className="font-inter text-[10px] text-gray-500">Note</p>
                </div>
              </div>
            </div>

            {/* Evénements en commun (Only for public profile) */}
            {!isOwnProfile && (
              <div className="w-full bg-[#FFF9EC] border border-[#FFE5B4] rounded-xl p-3 flex items-center gap-3">
                <div className="bg-[#FF7A00] p-1.5 rounded-lg text-white">
                  <Calendar className="w-4 h-4" />
                </div>
                <p className="text-[13px] font-medium text-gray-800">03 Événements en commun</p>
              </div>
            )}

            {/* Interests */}
            <div>
              <h3 className="font-inter text-[14px] font-medium text-gray-500 mb-3">Centres d'intérêt</h3>
              <div className="flex flex-wrap gap-2">
                {['⚽ Sport', '🎶 Musique', '🍳 Cuisine', '🎭 Arts', '🌍 Culture'].map((i) => (
                  <div key={i} className="px-3 py-1.5 bg-[#FAFAFA] border border-gray-100 rounded-full text-[11px] font-medium text-gray-600">
                    {i}
                  </div>
                ))}
                {isOwnProfile && (
                  <button className="px-3 py-1.5 bg-[#FAFAFA] border border-dashed border-gray-300 rounded-full text-[11px] font-medium text-gray-600 flex items-center gap-1">
                    + Ajouter
                  </button>
                )}
              </div>
            </div>

            {/* Badges */}
            <div>
              <h3 className="font-inter text-[14px] font-medium text-gray-500 mb-3">Badges</h3>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                {[
                  { id: '1', title: 'Early\nadopter', icon: '🚀' },
                  { id: '2', title: 'Social\nStar', icon: '⭐' },
                  { id: '3', title: 'Party\nMaker', icon: '🎉' },
                  { id: '4', title: 'Top\nDonateur', icon: '🎁' },
                  { id: '5', title: 'Top\nOrg.', icon: '🏆' },
                ].map((b) => (
                  <div key={b.id} className="min-w-[64px] h-[74px] rounded-xl flex flex-col items-center justify-center gap-1 flex-shrink-0" style={{ background: 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)' }}>
                    <span className="text-[20px]">{b.icon}</span>
                    <span className="text-[9px] font-semibold text-white text-center leading-[10px] whitespace-pre-wrap">{b.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prochains Événements */}
            {upcomingEvents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-inter text-[14px] font-medium text-gray-500">Prochains événements</h3>
                  <button className="text-[13px] text-gray-500 font-medium">Voir tout</button>
                </div>
                
                <div className="flex overflow-x-auto hide-scrollbar pb-4 pl-1">
                  {upcomingEvents.map((event: any) => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
                      onNavigate={onNavigate} 
                      horizontal={true} 
                    />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {activeTab === 'events' && (
          <div className="grid grid-cols-2 gap-4">
             {/* Evenements créés Card */}
             <div onClick={() => console.log('Go to created events')} className="w-full bg-[#FAFAFA] border border-[#F5F5F4] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer">
               <div className="w-10 h-10 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                 <Calendar className="w-5 h-5 text-[#FF7A00]" />
               </div>
               <p className="text-[13px] font-medium text-gray-700 text-center">Événements<br/>créés</p>
             </div>

             {/* Evenements rejoints Card */}
             <div onClick={() => console.log('Go to joined events')} className="w-full bg-[#FAFAFA] border border-[#F5F5F4] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer">
               <div className="w-10 h-10 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                 <Activity className="w-5 h-5 text-[#FF7A00]" />
               </div>
               <p className="text-[13px] font-medium text-gray-700 text-center">Événements<br/>rejoints</p>
             </div>
          </div>
        )}
      </div>

    </div>
  );
}
