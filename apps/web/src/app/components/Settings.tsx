import { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Globe, Lock, Bell, Shield, HelpCircle,
  LogOut, User, Moon, Smartphone, ExternalLink, Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router';
import { BadgeCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { SafeImage } from '@/components/shared/SafeImage';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { LanguageModal } from '@/features/users/components/LanguageModal';
import { ChangePasswordModal } from '@/features/users/components/ChangePasswordModal';
import { PrivacyModal } from '@/features/users/components/PrivacyModal';
import { EditPhoneModal } from '@/features/users/components/EditPhoneModal';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useSettingsStore } from '@/stores/settings.store';

interface SettingsProps {
  onBack: () => void;
}

const colorClasses: Record<string, string> = {
  blue:   'bg-blue-50 dark:bg-blue-500/10 text-blue-500',
  purple: 'bg-orange-50 dark:bg-orange-50/10 text-[#FF9F1C]',
  orange: 'bg-orange-50 dark:bg-orange-500/10 text-[#FF9F1C]',
  green:  'bg-green-50 dark:bg-green-500/10 text-green-500',
  pink:   'bg-pink-50 dark:bg-pink-500/10 text-pink-500',
  gray:   'bg-gray-100 dark:bg-[#2A2A2A] text-gray-500 dark:text-gray-400 dark:text-gray-500',
};

export function Settings({ onBack }: SettingsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  const { notifEnabled, setNotifEnabled, language } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const { mutate: doLogout, isPending: loggingOut } = useLogout();
  
  const darkMode = theme === 'dark';

  const handleLogout = () => {
    doLogout();
  };

  const displayName = profile?.displayName || 'Utilisateur';
  const username = profile?.username ? `@${profile.username}` : user?.phone || '';
  const avatarUrl = profile?.avatarUrl ?? null;

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'var(--background)' }}>

      {/* Header */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-4 pt-safe-4 pb-4 border-b border-gray-100 dark:border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 bg-gray-100 dark:bg-[#2A2A2A] rounded-full flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">{t('settings.title')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8 px-5 pt-5 space-y-5" style={{ scrollbarWidth: 'none' }}>

        {/* ── Compte ─────────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">{t('settings.account')}</p>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#2A2A2A] flex-shrink-0">
                <SafeImage
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                  }
                />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-[#FFFFFF] truncate">{displayName}</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 truncate">{username}</p>
              </div>
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(151,71,255,0.1)', color: '#FF9F1C' }}>
                {t('settings.edit')}
              </div>
            </button>
          </div>
        </div>

        {/* ── Préférences ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">{t('settings.preferences')}</p>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">

            {/* Notifications toggle */}
            <div className="flex items-center gap-3 px-4 py-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.orange}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.notifications')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('settings.notificationsDesc')}</p>
              </div>
              <button
                onClick={() => {
                  setNotifEnabled(!notifEnabled);
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${notifEnabled ? 'bg-[#FF9F1C]' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-[#1A1A1A] rounded-full shadow transition-transform ${notifEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Dark mode toggle */}
            <div className="flex items-center gap-3 px-4 py-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.gray}`}>
                <Moon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.darkMode')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('settings.darkModeDesc')}</p>
              </div>
              <div className="flex items-center bg-gray-100 dark:bg-[#2A2A2A] rounded-full p-1 shadow-inner">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${!darkMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Clair
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${darkMode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Sombre
                </button>
              </div>
            </div>

            {/* Language */}
            <button 
              onClick={() => setShowLangModal(true)}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.blue}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.language')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">
                  {language === 'fr' ? 'Français' : 'English'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── Sécurité & Confidentialité ─────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">{t('settings.security')}</p>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">
            <button 
              onClick={() => setShowPassModal(true)}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.purple}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.password')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('settings.passwordDesc')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => setShowPrivacyModal(true)}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.green}`}>
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.privacy')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">{t('settings.privacyDesc')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => setShowPhoneModal(true)}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.gray}`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.phone')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">{user?.phone || t('settings.notProvided')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => navigate('/verify-profile')}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.blue}`}>
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">Vérification du profil</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">Obtenir le badge vérifié</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── À propos & Support ──────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 px-1">{t('settings.about')}</p>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">
            <button
              onClick={() => window.open('mailto:support@letsout.app', '_blank')}
              className="w-full flex items-center gap-3 px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.pink}`}>
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.support')}</p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500">support@letsout.app</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300" />
            </button>

            <button className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors">
              <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.version')}</p>
              <span className="text-[13px] text-gray-400 dark:text-gray-500 font-medium">1.0.0</span>
            </button>

            <button
              onClick={() => window.open('/terms', '_blank')}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.terms')}</p>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button
              onClick={() => window.open('/privacy', '_blank')}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.privacyPolicy')}</p>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── Déconnexion ─────────────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
          {t('settings.logout')}
        </button>

        <div className="text-center pb-2">
          <p className="text-[11px] text-gray-300">Let's Out • {displayName}</p>
        </div>
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
      {showLangModal && <LanguageModal onClose={() => setShowLangModal(false)} />}
      {showPassModal && <ChangePasswordModal onClose={() => setShowPassModal(false)} />}
      {showPrivacyModal && <PrivacyModal onClose={() => setShowPrivacyModal(false)} />}
      {showPhoneModal && <EditPhoneModal onClose={() => setShowPhoneModal(false)} />}
    </div>
  );
}



