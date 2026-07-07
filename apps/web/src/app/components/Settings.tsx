import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, Globe, Lock, Bell, Shield, HelpCircle,
  LogOut, User, Moon, Smartphone, ExternalLink, Loader2, Clock,
  CheckCircle2, XCircle, Trash2, AlertTriangle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useNavigate } from 'react-router';
import { BadgeCheck } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { SafeImage } from '@/components/shared/SafeImage';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { LanguageModal } from '@/features/users/components/LanguageModal';
import { ChangePasswordModal } from '@/features/users/components/ChangePasswordModal';
import { PrivacyModal } from '@/features/users/components/PrivacyModal';
import { EditPhoneModal } from '@/features/users/components/EditPhoneModal';
import { EditEmailModal } from '@/features/users/components/EditEmailModal';
import { useLogout, useDeleteAccount } from '@/features/auth/hooks/useAuth';
import { useSettingsStore } from '@/stores/settings.store';
import { PreferenceSegment } from '@/components/shared/SettingsToggle';
import { Button } from '@/components/ui/button';

interface SettingsProps {
  onBack: () => void;
}

const colorClasses: Record<string, string> = {
  blue:   'bg-blue-50 dark:bg-blue-500/10 text-blue-500',
  purple: 'bg-brand-orange-50 dark:bg-brand-orange-50/10 text-action-primary',
  orange: 'bg-brand-orange-50 dark:bg-brand-orange-500/10 text-action-primary',
  green:  'bg-green-50 dark:bg-green-500/10 text-green-500',
  pink:   'bg-pink-50 dark:bg-pink-500/10 text-pink-500',
  gray:   'bg-gray-100 dark:bg-[#2A2A2A] text-text-secondary dark:text-gray-400 dark:text-text-secondary',
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
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [kycStatus, setKycStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteReason, setDeleteReason] = useState('');

  const { notifEnabled, setNotifEnabled, language } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const { mutate: doLogout, isPending: loggingOut } = useLogout();
  const { mutate: doDeleteAccount, isPending: deletingAccount } = useDeleteAccount();

  // Fetch KYC status
  useEffect(() => {
    apiClient.get('/users/me/kyc-status')
      .then(r => setKycStatus(r.data.kycStatus ?? null))
      .catch(() => setKycStatus((profile as any)?.kycStatus ?? null))
  }, [profile]);
  
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
      <div className="bg-background-white dark:bg-[#1A1A1A] px-5 pt-4 pt-safe-4 pb-4 border-b border-gray-100 dark:border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">{t('settings.title')}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8 px-5 pt-5 space-y-5" style={{ scrollbarWidth: 'none' }}>

        {/* ── Compte ─────────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-text-secondary uppercase tracking-wide mb-2 px-1">{t('settings.account')}</p>
          <div className="bg-background-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#2A2A2A] flex-shrink-0">
                <SafeImage
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400 dark:text-text-secondary" />
                    </div>
                  }
                />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[15px] font-semibold text-gray-900 dark:text-[#FFFFFF] truncate">{displayName}</p>
                <p className="text-[13px] text-gray-400 dark:text-text-secondary truncate">{username}</p>
              </div>
              <div className="flex items-center gap-1 px-150 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(151,71,255,0.1)', color: 'var(--action-primary)' }}>
                {t('settings.edit')}
              </div>
            </button>
          </div>
        </div>

        {/* ── Préférences ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-text-secondary uppercase tracking-wide mb-2 px-1">{t('settings.preferences')}</p>
          <div className="bg-background-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">

            {/* Notifications toggle */}
            <div className="flex items-center gap-150 px-200 py-200">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.orange}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.notifications')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">{t('settings.notificationsDesc')}</p>
              </div>
              <PreferenceSegment
                leftLabel="Non"
                rightLabel="Oui"
                activeRight={notifEnabled}
                onSelectLeft={() => setNotifEnabled(false)}
                onSelectRight={() => setNotifEnabled(true)}
              />
            </div>

            {/* Dark mode toggle */}
            <div className="flex items-center gap-150 px-200 py-200">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.gray}`}>
                <Moon className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.darkMode')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">{t('settings.darkModeDesc')}</p>
              </div>
              <PreferenceSegment
                leftLabel="Clair"
                rightLabel="Sombre"
                activeRight={darkMode}
                onSelectLeft={() => setTheme('light')}
                onSelectRight={() => setTheme('dark')}
              />
            </div>

            {/* Language */}
            <button 
              onClick={() => setShowLangModal(true)}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.blue}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.language')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">
                  {language === 'fr' ? 'Français' : 'English'}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── Sécurité & Confidentialité ─────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-text-secondary uppercase tracking-wide mb-2 px-1">{t('settings.security')}</p>
          <div className="bg-background-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">
            <button 
              onClick={() => setShowPassModal(true)}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.purple}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.password')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">{t('settings.passwordDesc')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => setShowPrivacyModal(true)}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.green}`}>
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.privacy')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">{t('settings.privacyDesc')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => setShowPhoneModal(true)}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.gray}`}>
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.phone')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">{user?.phone || t('settings.notProvided')}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => setShowEmailModal(true)}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.blue}`}>
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">Adresse e-mail</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">{user?.email || 'Non renseignée'}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button 
              onClick={() => navigate('/verify-profile')}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                kycStatus === 'verified'
                  ? 'bg-green-50 dark:bg-green-500/10 text-green-500'
                  : kycStatus === 'pending'
                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                  : kycStatus === 'rejected'
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-500'
                  : colorClasses.blue
              }`}>
                {kycStatus === 'verified' ? <CheckCircle2 className="w-5 h-5" /> :
                 kycStatus === 'pending'  ? <Clock className="w-5 h-5" /> :
                 kycStatus === 'rejected' ? <XCircle className="w-5 h-5" /> :
                 <BadgeCheck className="w-5 h-5" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">Vérification du profil</p>
                <p className={`text-[12px] font-medium ${
                  kycStatus === 'verified'
                    ? 'text-green-500'
                    : kycStatus === 'pending'
                    ? 'text-amber-500'
                    : kycStatus === 'rejected'
                    ? 'text-red-500'
                    : 'text-gray-400 dark:text-text-secondary'
                }`}>
                  {kycStatus === 'verified' ? '✓ Profil vérifié'
                   : kycStatus === 'pending' ? '⏳ Vérification en cours'
                   : kycStatus === 'rejected' ? '✗ Dossier refusé — resoumettre'
                   : 'Obtenir le badge vérifié'}
                </p>
              </div>
              {kycStatus !== 'verified' && kycStatus !== 'pending' && <ChevronRight className="w-5 h-5 text-gray-300" />}
            </button>
          </div>
        </div>

        {/* ── Administration ──────────────────────────────────────────────── */}
        {user?.role === 'ADMIN' && (
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-text-secondary uppercase tracking-wide mb-2 px-1">Administration</p>
            <div className="bg-background-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">
              <button 
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">Dashboard Admin</p>
                  <p className="text-[12px] text-gray-400 dark:text-text-secondary">Gérer les KYC, événements, etc.</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          </div>
        )}

        {/* ── À propos & Support ──────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold text-gray-400 dark:text-text-secondary uppercase tracking-wide mb-2 px-1">{t('settings.about')}</p>
          <div className="bg-background-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm divide-y divide-gray-50 dark:divide-[#2A2A2A]">
            <button
              onClick={() => window.open('mailto:support@letsout.app', '_blank')}
              className="w-full flex items-center gap-150 px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.pink}`}>
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.support')}</p>
                <p className="text-[12px] text-gray-400 dark:text-text-secondary">support@letsout.app</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300" />
            </button>

            <button className="w-full flex items-center justify-between px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors">
              <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.version')}</p>
              <span className="text-[13px] text-gray-400 dark:text-text-secondary font-medium">1.0.0</span>
            </button>

            <button
              onClick={() => window.open('/terms', '_blank')}
              className="w-full flex items-center justify-between px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.terms')}</p>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>

            <button
              onClick={() => window.open('/privacy', '_blank')}
              className="w-full flex items-center justify-between px-200 py-200 active:bg-gray-50 dark:bg-[#222222] transition-colors"
            >
              <p className="text-[14px] font-medium text-gray-900 dark:text-[#FFFFFF]">{t('settings.privacyPolicy')}</p>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── Déconnexion ─────────────────────────────────────────────────── */}
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 rounded-2xl py-6"
        >
          {loggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
          {t('settings.logout')}
        </Button>

        {/* ── Suppression de compte ────────────────────────────────────────── */}
        <Button
          variant="outline"
          onClick={() => { setDeleteStep(1); setDeleteReason(''); setShowDeleteModal(true); }}
          className="w-full flex items-center justify-center gap-2 text-red-600 border-red-200 dark:border-red-500/20 rounded-2xl py-6"
        >
          <Trash2 className="w-5 h-5" />
          Supprimer mon compte
        </Button>

        <div className="text-center pb-2">
          <p className="text-[11px] text-gray-300">Let's Out • {displayName}</p>
        </div>
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
      {showLangModal && <LanguageModal onClose={() => setShowLangModal(false)} />}
      {showPassModal && <ChangePasswordModal onClose={() => setShowPassModal(false)} />}
      {showPrivacyModal && <PrivacyModal onClose={() => setShowPrivacyModal(false)} />}
      {showPhoneModal && <EditPhoneModal onClose={() => setShowPhoneModal(false)} />}
      {showEmailModal && <EditEmailModal onClose={() => setShowEmailModal(false)} />}

      {/* ── Modale de suppression de compte ─────────────────────────────── */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center px-4 pb-6 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}>
          <div
            className="bg-white dark:bg-[#1A1A1A] w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteStep === 1 ? (
              <>
                {/* Step 1 — Confirmation initiale */}
                <div className="flex flex-col items-center text-center gap-3 mb-6">
                  <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Supprimer mon compte</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Cette action est <strong>irréversible</strong>. Votre profil sera anonymisé
                    et vous ne pourrez plus vous connecter avec ce compte.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="bg-red-50 dark:bg-red-500/10 rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Ce qui sera supprimé</p>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                      <li>• Votre profil et vos données personnelles</li>
                      <li>• Votre accès au compte</li>
                      <li>• Vos photos et informations</li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#222] rounded-2xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ce qui est conservé</p>
                    <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      <li>• Vos transactions et paiements (traçabilité légale)</li>
                      <li>• Les événements que vous avez créés</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2A2A2A] active:scale-[0.98] transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="flex-1 py-3 rounded-2xl font-semibold text-white bg-red-500 active:scale-[0.98] transition-all"
                  >
                    Continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2 — Raison + confirmation finale */}
                <div className="flex flex-col items-center text-center gap-2 mb-5">
                  <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                    <Trash2 className="w-7 h-7 text-red-500" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dernière étape</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Aidez-nous à nous améliorer en indiquant la raison (optionnel).
                  </p>
                </div>

                <div className="mb-5">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Motif de suppression</label>
                  <div className="grid grid-cols-1 gap-2 mb-3">
                    {[
                      "Je ne trouve pas d'événements intéressants",
                      "Problème technique",
                      "Je crée un nouveau compte",
                      "Confidentialité et données personnelles",
                    ].map((r) => (
                      <button
                        key={r}
                        onClick={() => setDeleteReason(r)}
                        className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                          deleteReason === r
                            ? 'border-red-400 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'border-gray-200 dark:border-[#2A2A2A] text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={deleteReason.startsWith('Autre') || ![
                      "Je ne trouve pas d'événements intéressants",
                      "Problème technique",
                      "Je crée un nouveau compte",
                      "Confidentialité et données personnelles",
                    ].includes(deleteReason) ? deleteReason : ''}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Autre raison (optionnel)..."
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl text-sm border border-gray-200 dark:border-[#2A2A2A] bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-300 focus:outline-none focus:border-red-400 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteStep(1)}
                    disabled={deletingAccount}
                    className="flex-1 py-3 rounded-2xl font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2A2A2A] active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    Retour
                  </button>
                  <button
                    onClick={() => doDeleteAccount(deleteReason || undefined)}
                    disabled={deletingAccount}
                    className="flex-1 py-3 rounded-2xl font-semibold text-white bg-red-500 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {deletingAccount ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Suppression...</>
                    ) : (
                      <><Trash2 className="w-4 h-4" /> Supprimer définitivement</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}



