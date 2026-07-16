import { useNavigate } from 'react-router';
import { 
  Calendar01Icon, 
  Wallet01Icon, 
  Settings02Icon, 
  UserMultiple02Icon,
  Logout03Icon,
  ArrowRight01Icon,
  Tick02Icon,
  Ticket01Icon
} from 'hugeicons-react';
import { useAuthStore } from '@/stores/auth.store';
import { NotificationIconWithBadge } from '@/components/shared/NotificationIconWithBadge';
import { useNotifications } from '@/features/notifications/api';

export function AccountMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { data: notifData } = useNotifications();
  const unreadCount = (notifData as any)?.unreadCount ?? 0;

  const displayName = user?.profile?.displayName || user?.email?.split('@')[0] || 'Utilisateur';
  const username = user?.profile?.username ? `@${user.profile.username}` : '';
  const avatarUrl = user?.profile?.avatarUrl;
  const isVerified = user?.isVerified || false;
  const isCreator = true; // Hardcoded to match design, or use user.role if available

  const menuItems = [
    {
      label: 'Mes événements',
      subtitle: 'Billets et inscriptions',
      icon: Ticket01Icon,
      path: '/my-events',
      badge: null
    },
    {
      label: 'Gérer mes événements',
      subtitle: 'Création et suivi',
      icon: Calendar01Icon,
      path: '/manage-events',
      badge: 'Nouveau'
    },
    {
      label: 'Amis & Réseau',
      subtitle: 'Retrouvez vos connaissances',
      icon: UserMultiple02Icon,
      path: '/friends',
      badge: null
    },
    {
      label: 'Portefeuille',
      subtitle: 'Solde et cagnottes',
      icon: Wallet01Icon,
      path: '/wallet',
      badge: null
    }
  ];

  return (
    <div className="flex flex-col w-full h-full bg-[#F9FAFB] dark:bg-black pt-5 pt-safe-5">
      {/* Header Profile Section */}
      <div className="px-5 pt-4 pb-6 flex items-start justify-between">
        <div className="flex items-center gap-3" onClick={() => navigate('/profile')}>
          <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-gray-200 border border-gray-300 dark:border-gray-800 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#FF7A00] flex items-center justify-center text-white text-xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h1 className="text-[18px] font-bold text-gray-900 dark:text-white leading-tight">{displayName}</h1>
              {isVerified && <Tick02Icon className="w-4 h-4 text-blue-500 bg-white rounded-full" />}
            </div>
            <span className="text-[14px] text-gray-500 dark:text-gray-400 font-medium">{username}</span>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded font-semibold uppercase">Utilisateur</span>
              {isCreator && <span className="text-[10px] bg-orange-100 dark:bg-[#FF7A00]/20 text-[#FF7A00] px-2 py-0.5 rounded font-semibold uppercase">Créateur</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/notifications')} className="w-10 h-10 bg-white dark:bg-[#1A1A1A] rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform border border-gray-100 dark:border-gray-800">
            <NotificationIconWithBadge unreadCount={unreadCount} className="w-6 h-6 text-gray-900 dark:text-white" />
          </button>
          <button onClick={() => navigate('/settings')} className="w-10 h-10 bg-white dark:bg-[#1A1A1A] rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform border border-gray-100 dark:border-gray-800">
            <Settings02Icon className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* PRO Banner */}
      <div className="px-5 mb-6">
        <div className="w-full bg-gradient-to-r from-[#FF7A00] to-[#FFA733] rounded-2xl p-4 flex items-center justify-between shadow-md active:scale-[0.98] transition-transform cursor-pointer">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-white mb-1">
              <span className="text-lg">⭐</span>
              <span className="font-bold text-[16px]">Pass Let's Out PRO</span>
            </div>
            <span className="text-white/90 text-[12px] font-medium">Boostez vos événements et créez des cagnottes</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <ArrowRight01Icon className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="flex-1 px-4 space-y-3 overflow-y-auto pb-[100px]" style={{ scrollbarWidth: 'none' }}>
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => navigate(item.path)}
            className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] shadow-sm border border-gray-100 dark:border-gray-800/50 active:scale-[0.98] transition-transform text-left w-full"
          >
            <div className="w-11 h-11 rounded-full bg-gray-50 dark:bg-[#2A2A2A] flex items-center justify-center shrink-0">
              <item.icon size={22} className="text-gray-700 dark:text-gray-300" strokeWidth={1.5} />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-[15px] font-bold text-gray-900 dark:text-white leading-tight mb-0.5">
                {item.label}
              </span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">
                {item.subtitle}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {item.badge && (
                <span className="text-[10px] bg-[#FF7A00] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  {item.badge}
                </span>
              )}
              <ArrowRight01Icon size={18} className="text-gray-400" strokeWidth={2} />
            </div>
          </button>
        ))}

        <div className="pt-4">
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-3 p-4 rounded-2xl w-full text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
              <Logout03Icon size={22} className="text-red-500" strokeWidth={1.5} />
            </div>
            <span className="flex-1 text-[15px] font-bold text-red-500">
              Se déconnecter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
