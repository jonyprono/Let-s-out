import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/lib/i18n';

interface SettingsState {
  notifEnabled: boolean;
  darkMode: boolean;
  language: string;
  setNotifEnabled: (enabled: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  setLanguage: (lang: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifEnabled: true,
      darkMode: false,
      language: 'fr',
      setNotifEnabled: (enabled) => set({ notifEnabled: enabled }),
      setDarkMode: (enabled) => set({ darkMode: enabled }),
      setLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set({ language: lang });
      },
    }),
    {
      name: 'letsout-settings',
    }
  )
);
