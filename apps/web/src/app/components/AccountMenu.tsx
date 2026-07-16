import { useNavigate } from 'react-router';
import {
  UserCircle02Icon,
  Calendar01Icon,
  Wallet01Icon,
  Settings02Icon,
  UserMultiple02Icon,
  ArrowRight01Icon,
  UserAdd01Icon,
  Medal01Icon,
  HeadphonesIcon,
} from 'hugeicons-react';
import { useAuthStore } from '@/stores/auth.store';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { useNotifications } from '@/features/notifications/api';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/features/users/api';
import { apiClient } from '@/lib/api-client';

export function AccountMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { data: notifData } = useNotifications();
  const unreadCount = (notifData as any)?.unreadCount ?? 0;

  const displayName = user?.profile?.displayName || user?.email?.split('@')[0] || 'Utilisateur';
  const username = user?.profile?.username ? `@${user.profile.username}` : '';
  const avatarUrl = user?.profile?.avatarUrl;
  const isVerified = user?.isVerified || false;

  // Real stats
  const { data: activity } = useQuery({
    queryKey: ['users', 'activity', user?.id],
    queryFn: () => usersApi.getActivity(user!.id),
    enabled: !!user?.id,
  });

  const { data: friends } = useQuery({
    queryKey: ['users', 'friends'],
    queryFn: () => usersApi.getFriends(),
  });

  // Friend requests count
  const { data: friendRequests } = useQuery({
    queryKey: ['users', 'friend-requests'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users/me/friend-requests');
      return data;
    },
  });

  const eventsCount = user?.profile?.eventsCount ?? (activity?.createdEvents?.length ?? 0);
  const friendsCount = friends?.length ?? (user?.profile?.followersCount ?? 0);
  const joinedCount = activity?.joinedEvents?.length ?? 0;
  const pendingRequests = (friendRequests?.data?.length ?? 0) + (friendRequests?.received?.length ?? 0);

  const menuItems = [
    {
      label: 'Profil',
      subtitle: 'Gérez vos informations personnelles',
      icon: UserCircle02Icon,
      path: '/profile',
      badge: null,
    },
    {
      label: 'Mes événements',
      subtitle: 'Événements créés et rejoints',
      icon: Calendar01Icon,
      path: '/my-events',
      badge: null,
    },
    {
      label: 'Mes amis',
      subtitle: 'Voir et gérer vos amis',
      icon: UserMultiple02Icon,
      path: '/friends',
      badge: friendsCount > 0 ? String(friendsCount) : null,
    },
    {
      label: "Demandes d'amis",
      subtitle: 'Voir vos demandes reçues et envoyées',
      icon: UserAdd01Icon,
      path: '/friend-requests',
      badge: pendingRequests > 0 ? String(pendingRequests) : null,
    },
    {
      label: 'Portefeuille',
      subtitle: 'Gérez vos paiements et transactions',
      icon: Wallet01Icon,
      path: '/wallet',
      badge: null,
    },
    {
      label: 'Badges & Récompenses',
      subtitle: 'Découvrez vos badges et niveaux',
      icon: Medal01Icon,
      path: '/badges',
      badge: null,
    },
    {
      label: 'Aide & Support',
      subtitle: 'FAQ, centre d\'aide et contact',
      icon: HeadphonesIcon,
      path: '/support',
      badge: null,
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-black overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-safe-5 pt-5 pb-4 bg-white dark:bg-black flex-shrink-0">
        {/* Avatar + name + notif + settings */}
        <div className="flex items-start justify-between mb-4">
          {/* Left: avatar + name */}
          <div
            className="flex items-center gap-3 active:opacity-70 transition-opacity cursor-pointer"
            onClick={() => navigate('/profile')}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-100 dark:border-gray-800">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#FF7A00] flex items-center justify-center text-white text-2xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Name + badge */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[19px] font-bold text-gray-900 dark:text-white leading-tight">
                  {displayName}
                </span>
                {isVerified && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#3B82F6">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-[13px] text-gray-500 dark:text-gray-400 font-medium">{username}</span>
              <span className="mt-1 inline-block bg-[#FF7A00] text-white text-[10px] font-bold px-2 py-0.5 rounded-md self-start">
                Membre actif
              </span>
            </div>
          </div>

          {/* Right: notif + settings */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => navigate('/notifications')}
              className="w-10 h-10 flex items-center justify-center active:opacity-70 transition-opacity"
            >
              <NotificationIconWithBadge unreadCount={unreadCount} className="w-7 h-7 text-gray-800 dark:text-white" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="w-10 h-10 flex items-center justify-center active:opacity-70 transition-opacity"
            >
              <Settings02Icon className="w-7 h-7 text-gray-800 dark:text-white" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="flex items-center justify-between py-3 border-t border-b border-gray-100 dark:border-gray-800 mb-4">
          <div className="flex flex-col items-center flex-1">
            <span className="text-[18px] font-bold text-gray-900 dark:text-white leading-none">{eventsCount}</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">Événements</span>
          </div>
          <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-[18px] font-bold text-gray-900 dark:text-white leading-none">{friendsCount}</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">Amis</span>
          </div>
          <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />
          <div className="flex flex-col items-center flex-1">
            <span className="text-[18px] font-bold text-gray-900 dark:text-white leading-none">{joinedCount}</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">Rejoints</span>
          </div>
          <div className="w-px h-8 bg-gray-100 dark:bg-gray-800" />
          <div className="flex flex-col items-center flex-1">
            <div className="flex items-center gap-0.5">
              <span className="text-[14px]">⭐</span>
              <span className="text-[18px] font-bold text-gray-900 dark:text-white leading-none">4.8</span>
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">Note</span>
          </div>
        </div>

        {/* ── PRO Banner ── */}
        <div className="bg-[#FF7A00] rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-[15px]">Pass Let's Out</span>
              <span className="bg-white text-[#FF7A00] text-[10px] font-bold px-1.5 py-0.5 rounded-md">PRO</span>
            </div>
            <span className="text-white/85 text-[12px] font-medium">Plus d'avantages exclusifs</span>
          </div>
          <button className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5 active:scale-95 transition-transform">
            <span className="text-white text-[11px] font-semibold whitespace-nowrap">Voir mes avantages</span>
            <ArrowRight01Icon size={14} className="text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Menu List ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="px-4 pb-28">
          {menuItems.map((item, i) => (
            <button
              key={i}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-4 py-4 w-full text-left active:bg-gray-50 dark:active:bg-[#111] transition-colors border-b border-gray-100 dark:border-gray-800/60 last:border-b-0"
            >
              {/* Icon circle */}
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-[#FF7A00]/10 flex items-center justify-center shrink-0">
                <item.icon size={20} className="text-[#FF7A00]" strokeWidth={1.6} />
              </div>

              {/* Label + subtitle */}
              <div className="flex-1 flex flex-col min-w-0">
                <span className="text-[15px] font-semibold text-gray-900 dark:text-white leading-tight">
                  {item.label}
                </span>
                <span className="text-[12px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                  {item.subtitle}
                </span>
              </div>

              {/* Badge or arrow */}
              <div className="flex items-center gap-2 shrink-0">
                {item.badge && (
                  <span className="bg-[#FF7A00] text-white text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                    {item.badge}
                  </span>
                )}
                <ArrowRight01Icon size={18} className="text-gray-300 dark:text-gray-600" strokeWidth={2} />
              </div>
            </button>
          ))}

          {/* Logout */}
          <div className="pt-6 pb-4">
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl active:opacity-70 transition-opacity"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              <span className="text-[15px] font-semibold text-red-500">Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
