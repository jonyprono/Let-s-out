import { useEffect, useState } from 'react';
import { Settings, LogOut, MapPin, UserCheck, UserPlus, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { useUserProfile } from '@/features/users/UserProfileContext';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { usersApi } from '@/features/users/api';

import { useNavigate, useParams } from 'react-router';
import { EventCard } from '@/components/shared/EventCard';

interface ProfileProps {
  onNavigate: (screen: string, params?: any) => void;
}

type Tab = 'events' | 'drafts' | 'followers' | 'following' | 'friends';

export function Profile({ onNavigate }: ProfileProps) {
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const { username } = useParams<{ username?: string }>()

  const isOwnProfile = !username || (!!profile?.username && username === profile?.username)

  const { data: viewedProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['public-profile', username],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${username}`)
      return data
    },
    enabled: !!username && !isOwnProfile,
  })

  const displayProfile = isOwnProfile ? profile : viewedProfile
  const targetUserId = isOwnProfile ? user?.id : (viewedProfile?.userId || viewedProfile?.user?.id)

  useEffect(() => {
    setActiveTab('events')
  }, [username, isOwnProfile])

  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', targetUserId],
    queryFn: () => usersApi.getActivity(targetUserId!),
    enabled: !!targetUserId,
  })

  const displayName = isOwnProfile
    ? (profile?.displayName || 'Mon Profil')
    : (displayProfile?.displayName || displayProfile?.username || username || 'Utilisateur');
  const city = displayProfile?.city || '';
  const bio = displayProfile?.bio || '';
  const memberSince = isOwnProfile
    ? user?.createdAt
      ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt))
      : ''
    : displayProfile?.user?.createdAt || displayProfile?.createdAt
      ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(displayProfile?.user?.createdAt || displayProfile?.createdAt!))
      : '';

  const { mutate: doLogout } = useLogout();

  // Followers
  const { data: followersData } = useQuery({
    queryKey: ['users', targetUserId, 'followers'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${targetUserId}/followers`);
      return data.data as any[];
    },
    enabled: !!targetUserId,
  });

  // Following
  const { data: followingData } = useQuery({
    queryKey: ['users', targetUserId, 'following'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${targetUserId}/following`);
      return data.data as any[];
    },
    enabled: !!targetUserId,
  });

  // Friends (only for own profile)
  const { data: friendsData } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
    enabled: !!user?.id && isOwnProfile,
  });

  const createdEvents = activity?.createdEvents ?? [];
  const draftEvents = activity?.draftEvents ?? [];
  const pastEvents = activity?.pastEvents ?? [];
  const followers = followersData ?? [];
  const following = followingData ?? [];
  const friends = friendsData ?? [];

  // On other profiles: don't show drafts or friends tab
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'events', label: 'Événements', count: createdEvents.length } as const,
    ...(isOwnProfile ? [{ key: 'drafts', label: 'Brouillons', count: draftEvents.length } as const] : []),
    { key: 'followers', label: 'Abonnés', count: followers.length } as const,
    { key: 'following', label: 'Abonnements', count: following.length } as const,
    ...(isOwnProfile ? [{ key: 'friends', label: 'Amis', count: friends.length } as const] : []),
  ];

  // Show loading state while determining own vs other profile
  if (username && !isOwnProfile && !viewedProfile && isLoadingProfile) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F8F7FF] dark:bg-[#111111]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-4 w-32 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }


  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">

      {/* Header */}
      <div className="px-5 pt-4 pb-3 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isOwnProfile && (
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-bold text-gray-900">
              {isOwnProfile ? 'Mon Profil' : (displayProfile?.displayName || username || 'Profil')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <button
                onClick={() => onNavigate('settings')}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center active:scale-95 transition-transform"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            )}
            {isOwnProfile && (
              <button
                onClick={() => doLogout()}
                className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-transform bg-red-50"
              >
                <LogOut className="w-5 h-5 text-red-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8" style={{ scrollbarWidth: 'none' }}>

        {/* Profile Card */}
        <div className="mx-4 mt-4 mb-4 bg-white rounded-[24px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50/50">
          {/* Cover gradient */}
          <div className="h-32 relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #FF9F1C 0%, #FFB75E 60%, #FFA040 100%)' }} />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/30 rounded-full blur-2xl" />
          </div>

          <div className="px-5 pb-5">
            {/* Avatar + edit */}
            <div className="flex items-end justify-between -mt-12 mb-4 relative z-10">
              <div className="relative">
                <div className="w-24 h-24 rounded-full ring-4 ring-white/90 backdrop-blur-md shadow-lg overflow-hidden bg-white">
                  <SafeImage
                    src={displayProfile?.avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #FF9F1C, #FFB75E)' }}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-emerald-400 rounded-full border-[3px] border-white shadow-sm" />
              </div>
              {isOwnProfile && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-5 py-2.5 rounded-full text-sm font-bold text-[#FF9F1C] bg-orange-50 active:scale-95 transition-transform shadow-sm"
                >
                  Modifier le profil
                </button>
              )}
            </div>

            {/* Name, location, bio */}
            <h2 className="text-[22px] font-bold text-gray-900 mb-1 leading-tight">{displayName}</h2>
            {city && (
              <div className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-2.5 font-medium">
                <MapPin className="w-4 h-4 text-[#FF9F1C]" />
                <span>{city}</span>
                {memberSince && <><span className="mx-1.5 text-gray-300">•</span><span>Membre depuis {memberSince}</span></>}
              </div>
            )}
            {bio && <p className="text-[14px] text-gray-600 leading-relaxed mb-5">{bio}</p>}

            {/* Stats row */}
            <div className="flex gap-2 pt-4 border-t border-gray-100/80">
              {[
                { value: createdEvents.length, label: 'Événements', color: '#FF9F1C', tab: 'events' as Tab },
                { value: followers.length, label: 'Abonnés', color: '#FF9F1C', tab: 'followers' as Tab },
                { value: following.length, label: 'Abonnements', color: '#FF9F1C', tab: 'following' as Tab },
                ...(isOwnProfile ? [{ value: friends.length, label: 'Amis', color: '#FF9F1C', tab: 'friends' as Tab }] : []),
              ].map(stat => (
                <button
                  key={stat.label}
                  onClick={() => setActiveTab(stat.tab)}
                  className={`flex-1 text-center py-2.5 rounded-[16px] transition-all active:scale-95 ${activeTab === stat.tab ? 'bg-gray-50/80 ring-1 ring-gray-100 shadow-sm' : 'hover:bg-gray-50/50'}`}
                >
                  <p className="text-[19px] font-black tracking-tight" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-[11px] font-semibold text-gray-500 mt-0.5 leading-tight">{stat.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs navigation */}
        <div className="overflow-x-auto hide-scrollbar mx-4 mb-5 pb-2 -mt-1 pt-1">
          <div className="flex bg-white/60 backdrop-blur-sm rounded-full p-1.5 gap-1 shadow-sm border border-gray-100/50 min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-none px-4 py-2 rounded-full text-[12px] font-bold transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-[#FF9F1C] shadow-sm ring-1 ring-gray-100/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 text-[10px] ${activeTab === tab.key ? 'text-[#FF9F1C]' : 'text-gray-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* TAB: Events créés */}
        {activeTab === 'events' && (
          <div className="mx-4 space-y-4">
            {createdEvents.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50/50">
                <div className="w-16 h-16 mx-auto bg-orange-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📅</span>
                </div>
                <p className="text-gray-900 font-bold text-[15px]">Aucun événement créé</p>
                <p className="text-sm text-gray-500 mt-1">Vos événements créés apparaîtront ici</p>
                {isOwnProfile && (
                  <button
                    onClick={() => onNavigate('create-event')}
                    className="mt-6 px-6 py-3 rounded-full text-sm font-bold text-white shadow-md active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #FF9F1C, #FFB75E)' }}
                  >
                    Créer un événement
                  </button>
                )}
              </div>
            ) : (
              createdEvents.map((event: any) => (
                <EventCard key={event.id} event={event} onNavigate={onNavigate} />
              ))
            )}

            {/* Participated events */}
            {pastEvents.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-8 mb-4">
                  <div className="w-1 h-4 bg-gray-300 rounded-full" />
                  <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wide">Participations passées</p>
                </div>
                {pastEvents.slice(0, 3).map((event: any) => (
                  <EventCard key={event.id} event={event} onNavigate={onNavigate} />
                ))}
              </>
            )}
          </div>
        )}

        {/* TAB: Brouillons */}
        {activeTab === 'drafts' && isOwnProfile && (
          <div className="mx-4 space-y-4">
            {draftEvents.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50/50">
                <div className="w-16 h-16 mx-auto bg-orange-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <p className="text-gray-900 font-bold text-[15px]">Aucun brouillon</p>
                <p className="text-sm text-gray-500 mt-1">Vos événements en attente apparaîtront ici</p>
              </div>
            ) : (
              draftEvents.map((event: any) => (
                <div key={event.id} className="relative">
                  {/* Draft badge */}
                  <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-sm text-[#FF9F1C] px-3 py-1 rounded-full text-[11px] font-black tracking-wide uppercase border border-[#FF9F1C]/20 shadow-sm">
                    Brouillon
                  </div>
                  {/* Manage button */}
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={() => navigate('/events/create', { state: { editEventId: event.id, step: 7, eventData: event } })}
                      className="flex items-center gap-1.5 bg-[#FF9F1C] text-white px-3 py-1.5 rounded-full text-[11px] font-black shadow-md active:scale-95 transition-transform"
                    >
                      <span>⚙</span> Gérer
                    </button>
                  </div>
                  <div className="opacity-80 hover:opacity-100 transition-opacity">
                    <EventCard event={event} onNavigate={onNavigate} />
                  </div>
                  {/* Bottom action bar */}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => navigate('/events/create', { state: { editEventId: event.id, step: 7, eventData: event } })}
                      className="flex-1 py-3 rounded-2xl border-2 border-[#FF9F1C] text-[#FF9F1C] font-bold text-[13px] bg-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                    >
                      ✏️ Modifier & publier
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Followers */}
        {activeTab === 'followers' && (
          <div className="mx-4 space-y-2">
            {followers.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50/50">
                <div className="w-16 h-16 mx-auto bg-orange-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-gray-900 font-bold text-[15px]">Aucun abonné</p>
                <p className="text-sm text-gray-500 mt-1">Personne ne vous suit encore</p>
              </div>
            ) : (
              followers.map((f: any) => (
                <UserCard key={f?.userId} user={f} type="follower" />
              ))
            )}
          </div>
        )}

        {/* TAB: Following */}
        {activeTab === 'following' && (
          <div className="mx-4 space-y-2">
            {following.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50/50">
                <div className="w-16 h-16 mx-auto bg-pink-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <p className="text-gray-900 font-bold text-[15px]">Vous ne suivez personne</p>
                <p className="text-sm text-gray-500 mt-1">Explorez des profils pour les suivre</p>
              </div>
            ) : (
              following.map((f: any) => (
                <UserCard key={f?.userId} user={f} type="following" />
              ))
            )}
          </div>
        )}

        {/* TAB: Friends */}
        {activeTab === 'friends' && isOwnProfile && (
          <div className="mx-4 space-y-2">
            <button
              onClick={() => navigate('/friend-requests')}
              className="w-full bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm mb-4 active:scale-[0.98] transition-transform border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-[15px] text-gray-900">Demandes d'amis</p>
                  <p className="text-[13px] text-gray-500">Gérer les demandes en attente</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            {friends.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center shadow-sm border border-gray-50/50">
                <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl">🤝</span>
                </div>
                <p className="text-gray-900 font-bold text-[15px]">Aucun ami</p>
                <p className="text-sm text-gray-500 mt-1">Envoyez des demandes d'amis pour commencer</p>
              </div>
            ) : (
              friends.map((f: any) => (
                <UserCard key={f?.userId} user={f} type="friend" />
              ))
            )}
          </div>
        )}
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
    </div>
  );
}

// ── UserCard sub-component ────────────────────────────────────────────────────

function UserCard({ user, type }: { user: any; type: 'follower' | 'following' | 'friend' }) {
  const name = user?.displayName || user?.username || 'Utilisateur';
  const avatar = user?.avatarUrl;
  const { openUserProfile } = useUserProfile();

  return (
    <div 
      onClick={() => openUserProfile(user?.userId || user?.id, { displayName: name, avatarUrl: avatar })}
      className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border border-gray-50/50 hover:border-gray-100"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm ring-2 ring-white">
        <SafeImage
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full flex items-center justify-center font-bold text-[#FFFFFF] text-lg"
              style={{ background: 'linear-gradient(135deg, #FF9F1C, #FFB75E)' }}>
              {name.charAt(0).toUpperCase()}
            </div>
          }
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-[15px] truncate">{name}</p>
        {user?.username && (
          <p className="text-[13px] text-gray-500 truncate">@{user.username}</p>
        )}
      </div>
      {type === 'follower' && (
        <div className="flex-shrink-0 p-2 rounded-full bg-orange-50">
          <UserCheck className="w-4 h-4 text-[#FF9F1C]" />
        </div>
      )}
      {type === 'following' && (
        <div className="flex-shrink-0 p-2 rounded-full bg-orange-50">
          <UserPlus className="w-4 h-4 text-[#FF9F1C]" />
        </div>
      )}
      {type === 'friend' && (
        <div className="flex-shrink-0 p-2 rounded-full bg-orange-50">
          <UserCheck className="w-4 h-4 text-[#FF9F1C]" />
        </div>
      )}
    </div>
  );
}


