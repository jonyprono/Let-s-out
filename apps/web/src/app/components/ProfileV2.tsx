import { useState, useEffect, useRef } from 'react';
import { Settings, UserPlus, Calendar, Users, Activity, ChevronLeft, MessageCircle, Check, UserCheck, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { usersApi } from '@/features/users/api';
import { chatApi } from '@/features/chat/api';

import { useNavigate, useParams } from 'react-router';
import { EventCard } from '@/components/shared/EventCard';
import { toast } from 'sonner';

type BadgeDef = {
  badge: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  howTo: string;
  getProgress: (activity: any, friends: any[], profileData?: any) => { current: number; target: number };
};

function BadgeIcon({ children }: { children: React.ReactNode }) {
  return <div className="w-8 h-8 flex items-center justify-center">{children}</div>;
}

const ALL_BADGES: BadgeDef[] = [
  {
    badge: 'Early adopter',
    title: 'Early\nadopter',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Récompense les pionniers qui ont rejoint Let\'s Out lors du lancement.',
    howTo: 'Créez votre compte pendant la phase de lancement de l\'application.',
    getProgress: (_a, _f) => ({ current: 1, target: 1 }),
  },
  {
    badge: 'Social Star',
    title: 'Social\nStar',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Décerné aux membres avec une grande vie sociale sur la plateforme.',
    howTo: 'Ajoutez 10 amis sur Let\'s Out pour débloquer ce badge.',
    getProgress: (_a, friends) => ({ current: friends.length, target: 10 }),
  },
  {
    badge: 'Party Maker',
    title: 'Party\nMaker',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.8 11.3 2 22l10.7-3.79"/>
          <path d="M4 3h.01"/>
          <path d="M22 8h.01"/>
          <path d="M15 2h.01"/>
          <path d="M22 20h.01"/>
          <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/>
          <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.1.5-.55.85-1.06.85H17"/>
          <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.72 4.9 9.37 5.35 9.37 5.86V6"/>
          <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2z"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Pour les organisateurs dont la cagnotte atteint au moins 90% de son objectif.',
    howTo: 'Organisez un événement avec cagnotte et atteignez 90% de l\'objectif.',
    getProgress: (activity, _f) => {
      const events = activity?.createdEvents ?? [];
      // Find the best pool percentage across all created events
      const poolEvents = events.filter((e: any) => e.poolTarget > 0);
      if (poolEvents.length === 0) return { current: 0, target: 90 };
      const best = Math.max(...poolEvents.map((e: any) => {
        const pct = e.poolTarget > 0 ? Math.round((e.poolCollected ?? 0) / e.poolTarget * 100) : 0;
        return pct;
      }));
      return { current: Math.min(best, 90), target: 90 };
    },
  },
  {
    badge: 'Top Donateur',
    title: 'Top\nDonateur',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12v10H4V12"/>
          <path d="M22 7H2v5h20V7z"/>
          <path d="M12 22V7"/>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Récompense la générosité envers la communauté.',
    howTo: 'Contribuez au moins 2 fois à la cagnotte de 5 événements différents.',
    getProgress: (activity, _f) => {
      // Count pool events where totalPaid suggests at least 2 contributions
      // activity.bookings has the raw booking data including totalPaid and event.poolMinAmount
      const poolBookings = (activity?.bookings ?? []).filter((b: any) =>
        b.event?.poolTarget > 0 && b.totalPaid > 0
      );
      // Consider "contributed twice" if totalPaid >= 2 * (poolMinAmount || 1)
      const doubleContributed = poolBookings.filter((b: any) => {
        const minAmount = b.event?.poolMinAmount || 1;
        return b.totalPaid >= minAmount * 2;
      });
      return { current: doubleContributed.length, target: 5 };
    },
  },
  {
    badge: 'Top Org.',
    title: 'Top\nOrg.',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Décerné aux organisateurs les mieux notés de la communauté.',
    howTo: 'Maintenez une note moyenne de 4.5/5 après avoir reçu 5 avis.',
    getProgress: (_a, _f, profileData) => ({
      current: Math.min(profileData?.detailedStats?.reviewCount ?? 0, 5),
      target: 5,
    }),
  },
  {
    badge: 'Ponctuel',
    title: 'Ponctuel',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Décerné aux organisateurs qui respectent toujours les horaires.',
    howTo: 'Obtenez une note de ponctualité ≥ 4.5/5 sur au moins 3 évaluations.',
    getProgress: (_a, _f, profileData) => {
      const stats = profileData?.detailedStats;
      const count = stats?.reviewCount ?? 0;
      // Progress = count of reviews (up to 3), unlocked when avg >= 4.5
      return { current: Math.min(count, 3), target: 3 };
    },
  },
  {
    badge: 'Accueillant',
    title: 'Accueil-\nlant',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Pour les organisateurs chaleureux et souriants.',
    howTo: 'Obtenez une note d\'attitude ≥ 4.5/5 sur au moins 3 évaluations.',
    getProgress: (_a, _f, profileData) => {
      const count = profileData?.detailedStats?.reviewCount ?? 0;
      return { current: Math.min(count, 3), target: 3 };
    },
  },
  {
    badge: 'Fiable',
    title: 'Fiable',
    icon: (
      <BadgeIcon>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </BadgeIcon>
    ),
    description: 'Pour ceux dont les événements correspondent toujours aux descriptions.',
    howTo: 'Obtenez une note de fiabilité ≥ 4.5/5 sur au moins 3 évaluations.',
    getProgress: (_a, _f, profileData) => {
      const count = profileData?.detailedStats?.reviewCount ?? 0;
      return { current: Math.min(count, 3), target: 3 };
    },
  },
];



interface ProfileProps {
  onNavigate: (screen: string, params?: any) => void;
}

type Tab = 'profil' | 'events' | 'friends' | 'following';

export function ProfileV2({ onNavigate }: ProfileProps) {
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profil');
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null);
  const { username } = useParams<{ username?: string }>();

  // Scroll to top whenever the profile page mounts
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [username]);

  const targetUsername = username || profile?.username;
  const isOwnProfile = !username || (!!profile?.username && username === profile?.username);

  const { data: viewedProfile, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['public-profile', targetUsername],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${targetUsername}`);
      return data;
    },
    enabled: !!targetUsername,
    retry: false,
  });

  const displayProfile = isOwnProfile ? (viewedProfile || profile) : viewedProfile;
  const targetUserId = displayProfile?.userId || displayProfile?.id || displayProfile?.user?.id;

  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', targetUserId],
    queryFn: () => usersApi.getActivity(targetUserId!),
    enabled: !!targetUserId,
  });

  // My own friends list (for stats + badge progress)
  const { data: friendsData } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
    enabled: !!user?.id && isOwnProfile,
  });

  const createdEvents = activity?.createdEvents ?? [];
  const pastEvents = activity?.pastEvents ?? [];
  const upcomingEvents = createdEvents.filter((e: any) => new Date(e.startAt) > new Date()).slice(0, 5);
  const friends = friendsData ?? [];

  // From API: real friendship & follow state
  const friendshipStatus: string = viewedProfile?.friendshipStatus ?? 'none';
  const isFollowingFromAPI: boolean = viewedProfile?.isFollowing ?? false;
  const commonEventsCount: number = viewedProfile?.commonEventsCount ?? 0;

  // Local optimistic states — reset when API data arrives
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const prevIsFollowingRef = useRef<boolean | null>(null);
  useEffect(() => {
    // When the query refreshes, sync local state
    if (prevIsFollowingRef.current !== isFollowingFromAPI) {
      setIsFollowing(null);
      prevIsFollowingRef.current = isFollowingFromAPI;
    }
  }, [isFollowingFromAPI]);
  const effectiveIsFollowing = isFollowing !== null ? isFollowing : isFollowingFromAPI;
  const [localFriendStatus, setLocalFriendStatus] = useState<string | null>(null);
  const effectiveFriendStatus = localFriendStatus ?? friendshipStatus;

  const displayName = isOwnProfile
    ? (profile?.displayName || 'Mon Profil')
    : (displayProfile?.displayName || displayProfile?.username || username || 'Utilisateur');
  const city = displayProfile?.city || '';
  // Real bio only — no fallback placeholder
  const bio = displayProfile?.bio || '';

  // Interests: profile data directly
  const interests: string[] = displayProfile?.interests ?? [];

  const rating = viewedProfile?.detailedStats?.rating?.toFixed(1) ?? (isOwnProfile ? '0.0' : null);

  // Follow mutation
  const followMut = useMutation({
    mutationFn: async () => {
      if (effectiveIsFollowing) {
        await usersApi.unfollowUser(targetUserId!);
      } else {
        await usersApi.followUser(targetUserId!);
      }
    },
    onMutate: () => setIsFollowing(!effectiveIsFollowing),
    onError: () => {
      setIsFollowing(effectiveIsFollowing);
      toast.error('Erreur lors de l\'action.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['public-profile', targetUsername] }),
  });

  // Friend request mutation
  const friendMut = useMutation({
    mutationFn: () => usersApi.sendFriendRequest(targetUserId!),
    onMutate: () => setLocalFriendStatus('pending_sent'),
    onError: () => {
      setLocalFriendStatus(null);
      toast.error('Erreur lors de la demande.');
    },
    onSuccess: () => {
      toast.success('Demande d\'ami envoyée !');
      qc.invalidateQueries({ queryKey: ['public-profile', targetUsername] });
    },
  });

  // Navigate to chat
  const handleMessage = async () => {
    try {
      const conv = await chatApi.createDM(targetUserId!);
      onNavigate('chat', conv.id);
    } catch (e) {
      toast.error('Impossible d\'ouvrir la discussion');
    }
  };

  if (username && !isOwnProfile && profileError) {
    return (
      <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        {/* Header simple pour revenir en arrière */}
        <div className="absolute top-0 left-0 w-full p-4 pt-12 z-10 flex items-center">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-white/80 dark:bg-black/50 backdrop-blur rounded-full shadow-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-900 dark:text-white">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-2">Profil indisponible</h2>
          <p className="text-[14px] text-gray-500">{(profileError as any)?.response?.data?.error || "Vous ne pouvez pas voir ce profil ou il n'existe pas."}</p>
        </div>
      </div>
    );
  }

  if (username && !isOwnProfile && !viewedProfile && isLoadingProfile) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0b]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const coverUrl = displayProfile?.coverUrl || '';

  return (
    <div ref={scrollRef} className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      
      {/* Dynamic Cover Header */}
      <div className="w-full h-[200px] relative shrink-0" style={{ borderBottom: '1px solid #D4D4D4' }}>
        <div
          className="absolute inset-0"
          style={{ background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : 'url(/Checker.png) center/cover repeat' }}
        />
        {/* Top buttons — always above the cover image */}
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
      <div className="flex flex-col w-full -mt-10 mb-4 z-10 px-4 shrink-0">
        <div className="flex items-end gap-3 mb-2">
          {/* Avatar */}
          <div 
            onClick={() => { if (isOwnProfile) setShowEditModal(true) }}
            className="w-[72px] h-[72px] rounded-full ring-4 ring-[#F9F9F9] dark:ring-[#0a0a0b] overflow-hidden bg-gray-200 shadow-sm relative cursor-pointer shrink-0"
          >
            <SafeImage src={displayProfile?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" fallback={<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
<g clipPath="url(#clip0_1575_8860)">
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
              <span className="text-[12px] text-gray-500 font-medium font-inter">
                Membre depuis {new Date(displayProfile?.createdAt || displayProfile?.user?.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Bio — real data only */}
        {bio ? (
          <p className="text-[13px] text-gray-600 dark:text-gray-300 w-full mb-3">{bio}</p>
        ) : isOwnProfile ? (
          <p className="text-[13px] text-gray-400 italic w-full mb-3">Aucune description. Modifiez votre profil pour en ajouter une.</p>
        ) : null}

        {/* Public Profile Actions */}
        {!isOwnProfile && (
          <div className="flex gap-2 w-full mb-4">
            {/* Follow Button */}
            <button
              onClick={() => followMut.mutate()}
              disabled={followMut.isPending}
              className={`flex-1 rounded-full h-9 text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                effectiveIsFollowing
                  ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {followMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : effectiveIsFollowing ? <Check className="w-3.5 h-3.5" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>}
              {effectiveIsFollowing ? 'Abonné' : 'S\'abonner'}
            </button>

            {/* Message Button */}
            <button
              onClick={handleMessage}
              className="flex-1 rounded-full h-9 text-[13px] font-semibold flex items-center justify-center gap-1.5 border border-gray-200 bg-white text-gray-700 active:scale-95 transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Écrire
            </button>

            {/* Add Friend Button */}
            <button
              onClick={() => {
                if (effectiveFriendStatus === 'none') friendMut.mutate();
              }}
              disabled={friendMut.isPending || effectiveFriendStatus !== 'none'}
              className={`flex-1 rounded-full h-9 text-[13px] font-semibold flex items-center justify-center gap-1.5 border transition-all active:scale-95 ${
                effectiveFriendStatus === 'friend'
                  ? 'bg-[#FF7A00] text-white border-[#FF7A00]'
                  : effectiveFriendStatus === 'pending_sent'
                  ? 'bg-[#FF7A00]/50 text-white border-[#FF7A00]/50'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {friendMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : effectiveFriendStatus === 'friend' ? <UserCheck className="w-3.5 h-3.5" />
                : effectiveFriendStatus === 'pending_sent' ? <Check className="w-3.5 h-3.5" />
                : <UserPlus className="w-3.5 h-3.5" />
              }
              {effectiveFriendStatus === 'friend' ? 'Amis'
                : effectiveFriendStatus === 'pending_sent' ? 'Ajouté'
                : 'Ajouter'
              }
            </button>
          </div>
        )}
      </div>

      {/* Main Toggle Profil/Evenements */}
      <div className="w-full overflow-x-auto hide-scrollbar px-4 mb-6">
        <div className="flex flex-row items-start p-0 gap-2 w-max">
          <button 
            onClick={() => setActiveTab('profil')}
            className={`flex flex-row items-center px-3 py-2 gap-1.5 h-[36px] rounded-full transition-colors ${
              activeTab === 'profil' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'profil' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="font-poppins font-medium text-[12px] leading-[16px]">Profil</span>
          </button>

          <button 
            onClick={() => setActiveTab('events')}
            className={`flex flex-row items-center px-3 py-2 gap-1.5 h-[36px] rounded-full transition-colors ${
              activeTab === 'events' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'events' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span className="font-poppins font-medium text-[12px] leading-[16px]">Evénements</span>
          </button>

          <button 
            onClick={() => navigate(isOwnProfile ? '/friends' : `/friends/${targetUserId}`)}
            className={`flex flex-row items-center px-3 py-2 gap-1.5 h-[36px] rounded-full transition-colors ${
              activeTab === 'friends' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
            }`}
          >
            <Users className={`w-[18px] h-[18px] ${activeTab === 'friends' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}`} />
            <span className="font-poppins font-medium text-[12px] leading-[16px]">Amis</span>
          </button>

          <button 
            onClick={() => navigate(isOwnProfile ? '/friends?tab=following' : `/friends/${targetUserId}?tab=following`)}
            className={`flex flex-row items-center px-3 py-2 gap-1.5 h-[36px] rounded-full transition-colors ${
              activeTab === 'following' ? 'bg-[#FFF2D3] text-[#FF7A00]' : 'bg-[#FAFAFA] text-[#56514F]'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={activeTab === 'following' ? 'text-[#FF7A00]' : 'text-[#A3A3A3]'}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="font-poppins font-medium text-[12px] leading-[16px]">Abonnements</span>
          </button>
        </div>
      </div>

      {/* TABS CONTENT */}
      <div className="px-4 pb-20 shrink-0">
        {activeTab === 'profil' && (
          <div className="flex flex-col gap-6">
            
            {/* Stats */}
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
              <div className="flex flex-col items-center gap-1 border-r border-[#F5F5F4]" onClick={() => navigate(isOwnProfile ? '/friends' : `/friends/${targetUserId}`)}>
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
                  <p className="font-poppins font-medium text-[15px] text-gray-700 leading-tight">{rating ?? '–'}</p>
                  <p className="font-inter text-[10px] text-gray-500">Note</p>
                </div>
              </div>
            </div>

            {/* Evénements en commun — real count from API */}
            {!isOwnProfile && commonEventsCount > 0 && (
              <div className="w-full bg-[#FFF9EC] border border-[#FFE5B4] rounded-xl p-3 flex items-center gap-3">
                <div className="bg-[#FF7A00] p-1.5 rounded-lg text-white">
                  <Calendar className="w-4 h-4" />
                </div>
                <p className="text-[13px] font-medium text-gray-800">
                  {String(commonEventsCount).padStart(2, '0')} Événement{commonEventsCount > 1 ? 's' : ''} en commun
                </p>
              </div>
            )}

            {/* Interests */}
            <div>
              <h3 className="font-inter text-[15px] font-medium text-gray-600 mb-3">Mes intérêts</h3>
              <div className="flex flex-wrap gap-2">
                {interests.length > 0 ? interests.map((i: string) => {
                  let icon = '📌';
                  if (i.toLowerCase().includes('sport')) icon = '⚽';
                  else if (i.toLowerCase().includes('musique')) icon = '🎶';
                  else if (i.toLowerCase().includes('cuisine')) icon = '🍳';
                  else if (i.toLowerCase().includes('art')) icon = '🎨';
                  else if (i.toLowerCase().includes('culture')) icon = '🌍';
                  else if (i.toLowerCase().includes('voyage')) icon = '✈️';
                  else if (i.toLowerCase().includes('jeux')) icon = '🎮';
                  else if (i.toLowerCase().includes('tech')) icon = '💻';
                  else if (i.toLowerCase().includes('lecture') || i.toLowerCase().includes('livre')) icon = '📚';
                  else if (i.toLowerCase().includes('ciné') || i.toLowerCase().includes('film')) icon = '🎬';
                  else if (i.toLowerCase().includes('photo')) icon = '📷';
                  else if (i.toLowerCase().includes('danse')) icon = '💃';
                  else if (i.toLowerCase().includes('mode')) icon = '👗';
                  else if (i.toLowerCase().includes('anim')) icon = '🐾';
                  else if (i.toLowerCase().includes('brico')) icon = '🛠️';
                  else if (i.toLowerCase().includes('natur')) icon = '🌿';
                  else if (i.toLowerCase().includes('bien-être')) icon = '🧘‍♀️';

                  return (
                    <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAFAFA] border border-[#F5F5F4] rounded-full text-[13px] font-medium text-gray-700">
                      <span>{icon}</span>
                      <span>{i}</span>
                    </div>
                  );
                }) : (
                  <p className="text-[12px] text-gray-400 italic">Aucun centre d'intérêt renseigné.</p>
                )}
                {isOwnProfile && (
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-dashed border-[#D4D4D4] rounded-full text-[13px] font-medium text-gray-700 active:scale-95 transition-transform"
                  >
                    <span className="text-gray-400 text-[16px] leading-[0]">+</span> Ajouter
                  </button>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="shrink-0 w-full">
              <h3 className="font-inter text-[14px] font-medium text-gray-500 mb-3">Badges</h3>
              <div className="flex flex-wrap gap-3 pb-2">
                {ALL_BADGES.map((b) => {
                  const hasBadge = displayProfile?.user?.badges?.some((userBadge: any) => userBadge.badge === b.badge);
                  const prog = b.getProgress(activity, friends, viewedProfile);
                  const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
                  const isEarned = hasBadge || pct >= 100;

                  if (!isOwnProfile && !isEarned) return null;

                  if (isEarned) {
                    return (
                      <div
                        key={b.badge}
                        onClick={() => setSelectedBadge(b)}
                        className="w-[64px] h-[74px] rounded-lg flex flex-col items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer active:scale-95 transition-transform shadow-sm"
                        style={{ background: 'linear-gradient(243.43deg, #FFD439 16.67%, #4CAF50 83.33%)' }}
                      >
                        <div className="w-6 h-6 flex items-center justify-center text-white drop-shadow-md">{b.icon}</div>
                        <span className="text-[9px] font-bold text-white text-center leading-[10px] whitespace-pre-wrap drop-shadow-sm">{b.title}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={b.badge}
                        onClick={() => setSelectedBadge(b)}
                        className="w-[64px] h-[74px] rounded-lg flex flex-col items-center justify-center gap-1.5 flex-shrink-0 bg-gray-100 border border-dashed border-gray-300 opacity-60 cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
                      >
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                          <div className="h-full bg-[#FF7A00]/50 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="w-6 h-6 flex items-center justify-center grayscale opacity-50">{b.icon}</div>
                        <span className="text-[9px] font-semibold text-gray-500 text-center leading-[10px] whitespace-pre-wrap">{b.title}</span>
                      </div>
                    );
                  }
                })}
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
            <div onClick={() => navigate(isOwnProfile ? '/profile/events-created' : `/profile/${targetUserId}/events-created`)} className="w-full bg-[#FAFAFA] dark:bg-[#111] border border-[#F5F5F4] dark:border-[#222] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <p className="text-[13px] font-medium text-gray-700 text-center">Événements<br/>créés</p>
            </div>
            <div onClick={() => console.log('Go to joined events')} className="w-full bg-[#FAFAFA] border border-[#F5F5F4] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm active:scale-95 transition-transform cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-[#FFF9EC] flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#FF7A00]" />
              </div>
              <p className="text-[13px] font-medium text-gray-700 text-center">Événements<br/>rejoints</p>
            </div>
          </div>
        )}
      </div>

      {/* Badge Detail Bottom Sheet */}
      {selectedBadge && (() => {
        const hasBadge = displayProfile?.user?.badges?.some((userBadge: any) => userBadge.badge === selectedBadge.badge);
        const prog = selectedBadge.getProgress(activity, friends, viewedProfile);
        const pct = Math.min(100, Math.round((prog.current / prog.target) * 100));
        const isEarned = hasBadge || pct >= 100;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedBadge(null)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl shadow-2xl flex flex-col"
              style={{ maxHeight: '85dvh' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>

              {/* Close button */}
              <button
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 px-6 pb-8 pt-2" style={{ scrollbarWidth: 'none' }}>
                {/* Badge icon */}
                <div className="flex flex-col items-center mb-4">
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-3 ${!isEarned ? 'bg-gray-100 grayscale' : ''}`}
                    style={isEarned ? { background: 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)' } : {}}
                  >
                    <div className="scale-[2]">{selectedBadge.icon}</div>
                  </div>
                  <h3 className="text-[18px] font-bold text-gray-900 dark:text-white text-center">{selectedBadge.title.replace('\n', ' ')}</h3>
                  {isEarned && (
                    <span className="mt-2 px-3 py-1 bg-green-100 text-green-700 text-[11px] font-semibold rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Obtenu
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-[13px] text-gray-500 dark:text-gray-400 text-center mb-4">{selectedBadge.description}</p>

                {/* How to get + progress */}
                <div className="bg-[#FFF9EC] border border-[#FFE5B4] rounded-2xl p-4">
                  <p className="text-[12px] font-semibold text-[#FF7A00] mb-2">Comment l'obtenir ?</p>
                  <p className="text-[13px] text-gray-700 dark:text-gray-300 mb-3">{selectedBadge.howTo}</p>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-gray-500">Progression</span>
                    <span className="text-[11px] font-bold text-[#FF7A00]">{prog.current} / {prog.target}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-[#FF7A00] rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-right text-[10px] text-gray-400 mt-1">{pct}%{isEarned ? ' — Félicitations !' : ''}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
    </div>
  );
}
