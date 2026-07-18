import { useState } from 'react';
import { X, Check, Moon, Sun, Monitor, Bell } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings.store';
import { useTheme } from 'next-themes';

interface Props {
  onClose: () => void;
}

export function PreferencesModal({ onClose }: Props) {
  const { language, setLanguage, notifEnabled, setNotifEnabled } = useSettingsStore();
  const { theme, setTheme } = useTheme();

  const [selectedLang, setSelectedLang] = useState(language);
  const [selectedTheme, setSelectedTheme] = useState(theme || 'system');
  const [notifications, setNotifications] = useState(notifEnabled);

  const handleSave = () => {
    // Save Language
    if (selectedLang !== language) {
      setLanguage(selectedLang as 'fr' | 'en');
      import('@/lib/i18n').then(({ default: i18n }) => {
        i18n.changeLanguage(selectedLang);
      });
    }

    // Save Theme
    if (selectedTheme !== theme) {
      setTheme(selectedTheme);
    }

    // Save Notifications
    if (notifications !== notifEnabled) {
      setNotifEnabled(notifications);
      // Here you could trigger push notification permission request if enabled
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-white">Préférences</h2>
          <button onClick={onClose} className="p-2 text-gray-400 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:hover:bg-[#333]">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
        
        <div className="space-y-6 mb-8">
          
          {/* Theme Section */}
          <div>
            <h3 className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Thème de l'application</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setSelectedTheme('light')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                  selectedTheme === 'light' ? 'border-[#FF7A00] bg-orange-50/50 dark:bg-orange-900/20 text-[#FF7A00]' : 'border-gray-100 dark:border-[#333] text-gray-500'
                }`}
              >
                <Sun className="w-6 h-6 mb-2" />
                <span className="text-[12px] font-semibold">Clair</span>
              </button>
              <button
                onClick={() => setSelectedTheme('dark')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                  selectedTheme === 'dark' ? 'border-[#FF7A00] bg-orange-50/50 dark:bg-orange-900/20 text-[#FF7A00]' : 'border-gray-100 dark:border-[#333] text-gray-500'
                }`}
              >
                <Moon className="w-6 h-6 mb-2" />
                <span className="text-[12px] font-semibold">Sombre</span>
              </button>
              <button
                onClick={() => setSelectedTheme('system')}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                  selectedTheme === 'system' ? 'border-[#FF7A00] bg-orange-50/50 dark:bg-orange-900/20 text-[#FF7A00]' : 'border-gray-100 dark:border-[#333] text-gray-500'
                }`}
              >
                <Monitor className="w-6 h-6 mb-2" />
                <span className="text-[12px] font-semibold">Système</span>
              </button>
            </div>
          </div>

          {/* Language Section */}
          <div>
            <h3 className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Langue</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedLang('fr')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  selectedLang === 'fr' ? 'border-[#FF7A00] bg-orange-50/50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-[#333]'
                }`}
              >
                <span className={`font-semibold text-[14px] ${selectedLang === 'fr' ? 'text-[#FF7A00]' : 'text-gray-700 dark:text-gray-300'}`}>
                  Français
                </span>
                {selectedLang === 'fr' && <Check size={20} className="text-[#FF7A00]" />}
              </button>
              <button
                onClick={() => setSelectedLang('en')}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  selectedLang === 'en' ? 'border-[#FF7A00] bg-orange-50/50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-[#333]'
                }`}
              >
                <span className={`font-semibold text-[14px] ${selectedLang === 'en' ? 'text-[#FF7A00]' : 'text-gray-700 dark:text-gray-300'}`}>
                  English
                </span>
                {selectedLang === 'en' && <Check size={20} className="text-[#FF7A00]" />}
              </button>
            </div>
          </div>

          {/* Notifications Section */}
          <div>
            <h3 className="text-[13px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Notifications</h3>
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#222] rounded-2xl border border-gray-100 dark:border-[#333]">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${notifications ? 'bg-orange-50 dark:bg-[#FF7A00]/15' : 'bg-gray-200 dark:bg-[#2A2A2A]'}`}>
                  <Bell className={`w-4 h-4 ${notifications ? 'text-[#FF7A00]' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">Notifications push</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">Recevez des alertes importantes</p>
                </div>
              </div>

              {/* Custom Non/Oui Switch */}
              <div 
                className="relative flex items-center bg-[#F2F4F7] dark:bg-[#2A2A2A] rounded-full p-[3px] cursor-pointer"
                onClick={() => setNotifications(!notifications)}
                style={{ width: '96px', height: '46px' }}
              >
                {/* Thumb */}
                <div 
                  className={`absolute w-[40px] h-[40px] bg-white dark:bg-[#444] rounded-full shadow-sm transition-transform duration-300 ease-in-out ${notifications ? 'translate-x-[50px]' : 'translate-x-0'}`} 
                />
                <div className="relative z-10 flex items-center justify-between w-full h-full">
                  <span className={`w-1/2 text-center text-[14px] font-bold transition-colors duration-300 ${!notifications ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    Non
                  </span>
                  <span className={`w-1/2 text-center text-[14px] font-bold transition-colors duration-300 ${notifications ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    Oui
                  </span>
                </div>
              </div>
            </div>
          </div>

          
        </div>

        <button
          onClick={handleSave}
          className="w-full py-4 text-white font-bold text-[16px] rounded-2xl bg-[#FF7A00] active:scale-[0.98] transition-transform shadow-md"
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}
