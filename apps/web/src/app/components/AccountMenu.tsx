import { useNavigate } from 'react-router';
import { UserCircle02Icon, Calendar01Icon, Wallet01Icon, Settings02Icon } from 'hugeicons-react';

export function AccountMenu() {
  const navigate = useNavigate();

  const menuItems = [
    {
      label: 'Profil',
      icon: UserCircle02Icon,
      path: '/profile',
    },
    {
      label: 'Evénements',
      icon: Calendar01Icon,
      path: '/my-events',
    },
    {
      label: 'Portefeuille',
      icon: Wallet01Icon,
      path: '/wallet',
    },
    {
      label: 'Paramètres',
      icon: Settings02Icon,
      path: '/settings',
    },
  ];

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-black pt-5 pt-safe-5">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 mt-2">
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white">Compte</h1>
      </div>

      {/* Menu List */}
      <div className="flex flex-col px-4 gap-3 mt-4">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => navigate(item.path)}
            className="flex items-center gap-4 p-4 rounded-[20px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1A1A1A] active:scale-[0.98] transition-transform text-left w-full"
          >
            <div className="w-[46px] h-[46px] rounded-full bg-[#FFF9EC] dark:bg-[#FFF9EC]/10 flex items-center justify-center shrink-0">
              <item.icon size={22} className="text-[#FF7A00]" />
            </div>
            <span className="flex-1 text-[16px] font-medium text-gray-900 dark:text-white">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
