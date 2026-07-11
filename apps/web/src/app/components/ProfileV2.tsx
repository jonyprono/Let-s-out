import { useState } from 'react';
import { Settings, UserPlus, Calendar, Users, Activity, ChevronLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { usersApi } from '@/features/users/api';

import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/shared/EventCard';

type BadgeDef = {
  badge: string;
  title: string;
  icon: string;
  description: string;
  howTo: string;
  getProgress: (activity: any, friends: any[]) => { current: number; target: number };
};

const ALL_BADGES: BadgeDef[] = [
  {
    badge: 'Early adopter',
    title: 'Early\nadopter',
    icon: '🚀',
    description: 'Récompense les pionniers qui ont rejoint Let\'s Out lors du lancement.',
    howTo: 'Créez votre compte pendant la phase de lancement de l\'application.',
    getProgress: (_a, _f) => ({ current: 1, target: 1 }),
  },
  {
    badge: 'Social Star',
    title: 'Social\nStar',
    icon: '⭐',
    description: 'Décerné aux membres avec une grande vie sociale sur la plateforme.',
    howTo: 'Ajoutez 10 amis sur Let\'s Out pour débloquer ce badge.',
    getProgress: (_a, friends) => ({ current: friends.length, target: 10 }),
  },
  {
    badge: 'Party Maker',
    title: 'Party\nMaker',
    icon: '🎉',
    description: 'Pour ceux qui animent la communauté en créant des événements.',
    howTo: 'Créez et publiez 3 événements sur la plateforme.',
    getProgress: (activity, _f) => ({ current: (activity?.createdEvents ?? []).length, target: 3 }),
  },
  {
    badge: 'Top Donateur',
    title: 'Top\nDonateur',
    icon: '🎁',
    description: 'Récompense la générosité envers la communauté.',
    howTo: 'Contribuez à la cagnotte de 5 événements différents.',
    getProgress: (_a, _f) => ({ current: 0, target: 5 }),
  },
  {
    badge: 'Top Org.',
    title: 'Top\nOrg.',
    icon: '🏆',
    description: 'Décerné aux organisateurs les mieux notés de la communauté.',
    howTo: 'Maintenez une note moyenne de 4.5/5 après avoir reçu 5 avis.',
    getProgress: (_a, _f) => ({ current: 0, target: 5 }),
  },
];

interface ProfileProps {
  onNavigate: (screen: string, params?: any) => void;
}

type Tab = 'profil' | 'events';

export function ProfileV2({ onNavigate }: ProfileProps) {
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profil');
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null);
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

  const rating = viewedProfile?.detailedStats?.rating?.toFixed(1) || '0.0';

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
      <div className="w-full h-[200px] relative" style={{ borderBottom: '1px solid #D4D4D4' }}>
        {/* Cover image */}
        <div
          className="absolute inset-0"
          style={{ background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : 'url(/Checker.png) center/cover repeat' }}
        />
        {/* Top buttons – always above the cover image */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            className="w-9 h-9 flex items-center justify-center bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg shadow-sm border border-gray-200"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
          {isOwnProfile && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate('settings'); }}
              className="w-9 h-9 flex items-center justify-center bg-white/80 dark:bg-black/50 backdrop-blur rounded-lg shadow-sm border border-gray-200"
            >
              <Settings className="w-5 h-5 text-gray-700 dark:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="flex flex-col w-full -mt-10 mb-4 z-10 px-4">
        <div className="flex items-end gap-3 mb-2">
          {/* Avatar */}
          <div 
            onClick={() => { if (isOwnProfile) setShowEditModal(true) }}
            className="w-[72px] h-[72px] rounded-full ring-4 ring-[#F9F9F9] dark:ring-[#0a0a0b] overflow-hidden bg-gray-200 shadow-sm relative cursor-pointer shrink-0"
          >
            <SafeImage src={displayProfile?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" fallback={<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
<g clip-path="url(#clip0_1575_8860)">
<rect width="48" height="48" rx="24" fill="#F5F5F5"/>
<circle cx="24" cy="16" r="8" fill="#BDBDBD"/>
<circle cx="24" cy="49" r="22" fill="#BDBDBD"/>
</g>
<defs>
<clipPath id="clip0_1575_8860">
<rect width="48" height="48" rx="24" fill="white"/>
</clipPath>
</defs>
</svg>} />
          </div>

          {/* Name and Location */}
          <div className="flex flex-col pb-1">
            <div className="flex items-center gap-1">
              <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white leading-tight font-poppins">{displayName}</h2>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M7.66822 1.30874C7.30677 0.921827 6.69331 0.921827 6.33186 1.30874L5.44541 2.25692C5.26468 2.44974 5.0095 2.55601 4.74541 2.54646L3.44913 2.50255C2.91968 2.48474 2.48568 2.91874 2.5035 3.44819L2.54741 4.74574C2.55631 5.00983 2.45068 5.26501 2.25722 5.44574L1.30904 6.33155C0.922133 6.69301 0.922133 7.3071 1.30904 7.66855L2.25722 8.55501C2.45068 8.73574 2.55631 8.99028 2.54741 9.25501L2.50286 10.5519C2.48568 11.0814 2.91968 11.5154 3.44913 11.4976L4.74604 11.4536C5.01013 11.4447 5.26531 11.5504 5.44604 11.7432L6.33186 12.6914C6.69395 13.0789 7.30741 13.0789 7.6695 12.6914L8.55595 11.7432C8.73604 11.5504 8.99122 11.4441 9.25531 11.4536L10.5522 11.4976C11.0817 11.5154 11.5163 11.0814 11.4979 10.5519L11.4546 9.25437C11.445 8.99028 11.5513 8.73574 11.7441 8.55501L12.6923 7.66855C13.0792 7.3071 13.0792 6.69301 12.6923 6.33155L11.7441 5.4451C11.5513 5.26501 11.445 5.00983 11.4546 4.7451L11.4979 3.44819C11.5163 2.91874 11.0817 2.48474 10.5522 2.50255L9.25531 2.5471C8.99122 2.55537 8.73604 2.44974 8.55531 2.25692L7.66822 1.30874ZM3.9665 7.26955L6.14859 9.45101L9.76504 5.50174L8.90786 4.70819L6.10786 7.75955L4.78931 6.44101L3.9665 7.26955Z" fill="#2878E8"/>
              </svg>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              {city && <span className="text-[12px] text-gray-500 font-medium font-inter">{city} · </span>}
              <span className="text-[12px] text-gray-500 font-medium font-inter">Membre depuis {new Date(displayProfile?.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Bio */}
        {bio ? (
           <p className="text-[13px] text-gray-600 dark:text-gray-300 w-full mb-4">{bio}</p>
        ) : (
           <p className="text-[13px] text-gray-600 dark:text-gray-300 w-full mb-4">Amatrice de sorties. Fan de musique, food & nouvelles rencontres.</p>
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
                  <p className="font-poppins font-medium text-[15px] text-gray-700 leading-tight">{friends.length}</p>
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
                {displayProfile?.interests?.length > 0 ? displayProfile.interests.map((i: string) => (
                  <div key={i} className="px-3 py-1.5 bg-[#FAFAFA] border border-gray-100 rounded-full text-[11px] font-medium text-gray-600">
                    {i}
                  </div>
                )) : (
                  <p className="text-[12px] text-gray-400 italic">Aucun centre d'intérêt renseigné.</p>
                )}
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
                {ALL_BADGES.map((b) => {
                  const hasBadge = displayProfile?.user?.badges?.some((userBadge: any) => userBadge.badge === b.badge);
                  const prog = b.getProgress(activity, friends);
                  const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));

                  if (hasBadge) {
                    return (
                      <div key={b.badge} className="min-w-[64px] h-[74px] rounded-xl flex flex-col items-center justify-center gap-1 flex-shrink-0 cursor-pointer active:scale-95 transition-transform" style={{ background: 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)' }} onClick={() => setSelectedBadge(b)}>
                        <span className="text-[20px]">{b.icon}</span>
                        <span className="text-[9px] font-semibold text-white text-center leading-[10px] whitespace-pre-wrap">{b.title}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={b.badge}
                        onClick={() => setSelectedBadge(b)}
                        className="min-w-[64px] h-[74px] rounded-xl flex flex-col items-center justify-center gap-1 flex-shrink-0 bg-gray-100 border border-dashed border-gray-300 opacity-60 cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
                      >
                        {/* Progress bar at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                          <div className="h-full bg-[#FF7A00]/50 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[20px] grayscale">{b.icon}</span>
                        <span className="text-[9px] font-semibold text-gray-500 text-center leading-[10px] whitespace-pre-wrap">{b.title}</span>
                      </div>
                    );
                  }
                })}
              </div>
            </div>

            {/* Badge Detail Modal */}
            {selectedBadge && (() => {
              const hasBadge = displayProfile?.user?.badges?.some((userBadge: any) => userBadge.badge === selectedBadge.badge);
              const prog = selectedBadge.getProgress(activity, friends);
              const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
              return (
                <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedBadge(null)}>
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                  <div
                    className="relative w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl p-6 pb-10 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Close */}
                    <button onClick={() => setSelectedBadge(null)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>

                    {/* Badge icon */}
                    <div className="flex flex-col items-center mb-4">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-3 ${hasBadge ? '' : 'bg-gray-100 grayscale'}`} style={hasBadge ? { background: 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)' } : {}}>
                        <span className="text-[40px]">{selectedBadge.icon}</span>
                      </div>
                      <h3 className="text-[18px] font-bold text-gray-900 dark:text-white text-center whitespace-pre-wrap">{selectedBadge.title.replace('\n', ' ')}</h3>
                      {hasBadge && <span className="mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-[11px] font-semibold rounded-full">✓ Obtenu</span>}
                    </div>

                    {/* Description */}
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mb-4">{selectedBadge.description}</p>

                    {!hasBadge && (
                      <div className="bg-[#FFF9EC] border border-[#FFE5B4] rounded-2xl p-4">
                        <p className="text-[12px] font-semibold text-[#FF7A00] mb-2">Comment l'obtenir ?</p>
                        <p className="text-[13px] text-gray-700 mb-3">{selectedBadge.howTo}</p>
                        {/* Progress */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-500">Progression</span>
                          <span className="text-[11px] font-bold text-[#FF7A00]">{prog.current} / {prog.target}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[#FF7A00] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-right text-[10px] text-gray-400 mt-1">{pct}%</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

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

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
    </div>
  );
}
