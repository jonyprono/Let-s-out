import { useEffect, useState } from 'react';
import { Settings, LogOut, MapPin, UserCheck, UserPlus, Calendar, Star, Users, Medal, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { useUserProfile } from '@/features/users/UserProfileContext';
import { AddFriendsModal } from '@/features/users/components/AddFriendsModal';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { usersApi } from '@/features/users/api';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';


interface ProfileProps {
  onNavigate: (screen: string, params?: any) => void;
}

type Tab = 'events' | 'drafts' | 'followers' | 'following' | 'friends';

export function Profile({ onNavigate }: ProfileProps) {
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const { username } = useParams<{ username?: string }>()

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

  // Show loading state while determining own vs other profile
  if (username && !isOwnProfile && !viewedProfile && isLoadingProfile) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-150">
          <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-3 w-24 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  // TABS Generation
  const TABS = [
    { key: 'events', label: 'Événements', count: createdEvents.length } as const,
    ...(isOwnProfile ? [{ key: 'drafts', label: 'Brouillons', count: draftEvents.length } as const] : []),
    { key: 'followers', label: 'Abonnés', count: followers.length } as const,
    { key: 'following', label: 'Abonnements', count: following.length } as const,
    ...(isOwnProfile ? [{ key: 'friends', label: 'Amis', count: friends.length } as const] : []),
  ];

  const rating = viewedProfile?.detailedStats?.rating?.toFixed(1) || 'N/A';

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      
      {/* Header Actions */}
      <div className="px-5 pt-12 pb-3 sticky top-0 z-20 flex items-center justify-between bg-gray-50/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2">
          {!isOwnProfile && (
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors">
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <button onClick={() => onNavigate('settings')} className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-sm active:scale-95 transition-transform">
              <Settings className="w-5 h-5 text-gray-700" />
            </button>
          )}
          {isOwnProfile && (
            <button onClick={() => doLogout()} className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-sm active:scale-95 transition-transform text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="px-5 pt-6 pb-6 bg-gray-50 flex flex-col items-center border-b border-gray-100">
          
          {/* Avatar & Info */}
          <div className="relative mb-4">
            <div className="w-[104px] h-[104px] rounded-full ring-4 ring-white shadow-md overflow-hidden bg-white">
              <SafeImage src={displayProfile?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-500 bg-gray-100">{displayName.charAt(0).toUpperCase()}</div>} />
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-white shadow-sm bg-yellow-400 flex items-center justify-center text-[10px] font-bold text-white">
              ★ {rating}
            </div>
          </div>
          
          <h2 className="text-[22px] font-black text-gray-900 mb-1 leading-tight">{displayName}</h2>
          {city && (
            <div className="flex items-center justify-center gap-1.5 text-[13px] text-gray-500 mb-3 font-medium">
              <MapPin className="w-3.5 h-3.5" />
              <span>{city}</span>
              {memberSince && <><span className="mx-1.5">•</span><span>{memberSince}</span></>}
            </div>
          )}
          {bio && <p className="text-[14px] text-gray-600 leading-relaxed max-w-sm mx-auto text-center mb-5">{bio}</p>}

          {/* Actions */}
          {!isOwnProfile && (
            <div className="flex gap-3 w-full mb-6 max-w-xs">
              <Button className="flex-1 rounded-full h-11 text-[14px] font-bold shadow-sm" style={{ backgroundColor: 'var(--color-action-primary, #FF7A00)' }}>+ Suivre</Button>
              <Button variant="outline" className="flex-1 rounded-full h-11 text-[14px] font-bold shadow-sm">Message</Button>
            </div>
          )}

          {/* Badges & Interests (Compact) */}
          <div className="w-full flex flex-col gap-3 mb-6">
            {(displayProfile?.interests?.length > 0 || viewedProfile?.user?.badges?.length > 0) && (
               <div className="flex gap-2 flex-wrap justify-center">
                  {viewedProfile?.user?.badges?.slice(0, 2).map((b: any) => (
                    <div key={b.badge} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-[12px] font-bold rounded-full flex items-center gap-1.5 border border-blue-100/50">
                      <Medal className="w-3.5 h-3.5" /> {b.badge}
                    </div>
                  ))}
                  {displayProfile?.interests?.slice(0, 3).map((i: string) => (
                    <div key={i} className="px-3 py-1.5 bg-orange-50 text-orange-600 text-[12px] font-bold rounded-full border border-orange-100/50">
                      {i}
                    </div>
                  ))}
               </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="w-full grid grid-cols-4 gap-2">
            {[
              { value: createdEvents.length, label: 'Créés', icon: Calendar },
              { value: pastEvents.length, label: 'Rejoints', icon: Activity },
              { value: friends.length, label: 'Amis', icon: Users },
              { value: rating, label: 'Note', icon: Star },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                <stat.icon className="w-4 h-4 text-gray-400 mb-1" />
                <p className="text-[16px] font-black text-gray-900 leading-none mb-1">{stat.value}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>

        </div>

        {/* Content Area */}
        <div className="bg-white min-h-[500px]">
          {/* Scrollable Tabs */}
          <div className="w-full overflow-x-auto hide-scrollbar border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-10">
            <div className="flex p-3 w-max gap-2 mx-auto">
              <ToggleButton
                options={TABS.map(t => ({ label: `${t.label} ${t.count > 0 ? `(${t.count})` : ''}`, value: t.key }))}
                value={activeTab}
                onChange={(val) => setActiveTab(val as Tab)}
                className="bg-gray-50 p-1 rounded-full border border-gray-200"
              />
            </div>
          </div>

          <div className="p-4">
            {/* TAB: Événements */}
            {activeTab === 'events' && (
              <div className="space-y-4">
                {createdEvents.length === 0 ? (
                  <EmptyState icon="📅" title="Aucun événement créé" subtitle="Les événements apparaîtront ici" action={isOwnProfile ? <Button onClick={() => onNavigate('create-event')}>Créer un événement</Button> : null} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {createdEvents.map((event: any) => (
                      <CompactEventCard key={event.id} event={event} onNavigate={onNavigate} />
                    ))}
                  </div>
                )}
                {pastEvents.length > 0 && (
                  <>
                    <h3 className="font-bold text-gray-900 text-lg mt-8 mb-4">Participations passées</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pastEvents.slice(0, 3).map((event: any) => (
                        <CompactEventCard key={event.id} event={event} onNavigate={onNavigate} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: Brouillons */}
            {activeTab === 'drafts' && isOwnProfile && (
              <div className="space-y-4">
                {draftEvents.length === 0 ? (
                  <EmptyState icon="📝" title="Aucun brouillon" subtitle="Vos événements en attente apparaîtront ici" />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {draftEvents.map((event: any) => (
                      <div key={event.id} className="relative group">
                        <CompactEventCard event={event} onNavigate={onNavigate} isDraft />
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            onClick={() => navigate('/events/create', { state: { editEventId: event.id, step: 7, eventData: event } })}
                            className="w-full text-xs h-8 border-orange-500 text-orange-500 hover:bg-orange-50"
                          >
                            Reprendre le brouillon
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Followers */}
            {activeTab === 'followers' && (
              <div className="space-y-3">
                {followers.length === 0 ? (
                  <EmptyState icon="👥" title="Aucun abonné" subtitle="Personne ne vous suit encore" />
                ) : (
                  followers.map((f: any) => (
                    <UserCard key={f?.userId} user={f} type="follower" />
                  ))
                )}
              </div>
            )}

            {/* TAB: Following */}
            {activeTab === 'following' && (
              <div className="space-y-3">
                {following.length === 0 ? (
                  <EmptyState icon="🔍" title="Vous ne suivez personne" subtitle="Explorez des profils pour les suivre" />
                ) : (
                  following.map((f: any) => (
                    <UserCard key={f?.userId} user={f} type="following" />
                  ))
                )}
              </div>
            )}

            {/* TAB: Friends */}
            {activeTab === 'friends' && isOwnProfile && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => navigate('/friend-requests')}
                    className="bg-white rounded-2xl p-4 flex flex-col items-center text-center shadow-sm border border-gray-100 hover:border-orange-200 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center mb-2">
                      <Users className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="font-bold text-[13px] text-gray-900">Demandes</p>
                  </button>
                  <button
                    onClick={() => setShowAddFriendsModal(true)}
                    className="bg-white rounded-2xl p-4 flex flex-col items-center text-center shadow-sm border border-gray-100 hover:border-orange-200 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center mb-2">
                      <UserPlus className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="font-bold text-[13px] text-gray-900">Ajouter</p>
                  </button>
                </div>

                {friends.length === 0 ? (
                  <EmptyState icon="🤝" title="Aucun ami" subtitle="Envoyez des demandes d'amis pour commencer" />
                ) : (
                  friends.map((f: any) => (
                    <UserCard key={f?.userId} user={f} type="friend" />
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
      {showAddFriendsModal && <AddFriendsModal onClose={() => setShowAddFriendsModal(false)} />}
    </div>
  );
}

// ── Compact EventCard ─────────────────────────────────────────────────────────

function CompactEventCard({ event, onNavigate, isDraft }: { event: any; onNavigate?: any; isDraft?: boolean }) {
  return (
    <div 
      onClick={() => {
        if (!isDraft && onNavigate && event?.id) onNavigate('event-details', event.id);
      }}
      className="flex gap-3 p-3 bg-white border border-gray-100 rounded-[16px] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="w-[84px] h-[84px] rounded-[12px] bg-gray-100 flex-shrink-0 overflow-hidden relative">
        <SafeImage src={event?.coverUrl} alt={event?.title || 'Event cover'} className="w-full h-full object-cover" />
        {isDraft && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
            <span className="text-[10px] font-bold text-white uppercase tracking-wider px-2 py-1 bg-black/50 rounded-md">Brouillon</span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1 py-1">
        <h4 className="font-bold text-[15px] text-gray-900 truncate mb-1">{event?.title || 'Sans titre'}</h4>
        <p className="text-[13px] text-gray-500 truncate mb-2">{event?.city || 'Lieu non défini'}</p>
        <div className="flex items-center gap-2 mt-auto">
          <div className="px-2 py-0.5 bg-gray-100 rounded-md text-[11px] font-bold text-gray-600">
            {event?.price === 0 ? 'Gratuit' : `${event?.price || 0} CFA`}
          </div>
          <div className="px-2 py-0.5 bg-orange-50 rounded-md text-[11px] font-bold text-orange-600">
            {event?.currentAttendees || 0} Part.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, subtitle, action }: { icon: string, title: string, subtitle: string, action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[24px] p-8 text-center border border-dashed border-gray-200">
      <div className="w-14 h-14 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-3">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-gray-900 font-bold text-[15px]">{title}</p>
      <p className="text-sm text-gray-500 mt-1 mb-4">{subtitle}</p>
      {action}
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
      className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform cursor-pointer border border-gray-100 hover:border-gray-200"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm ring-2 ring-white">
        <SafeImage
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full flex items-center justify-center font-bold text-gray-500 bg-gray-100 text-lg">
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
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-orange-50">
          <UserCheck className="w-4 h-4 text-orange-500" />
        </div>
      )}
      {type === 'following' && (
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-orange-50">
          <UserPlus className="w-4 h-4 text-orange-500" />
        </div>
      )}
      {type === 'friend' && (
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-orange-50">
          <UserCheck className="w-4 h-4 text-orange-500" />
        </div>
      )}
    </div>
  );
}
