import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, ChevronRight, Globe, Lock, Bell, Shield, HelpCircle,
  LogOut, User, Loader2,
  CheckCircle2, Trash2, AlertTriangle, Wallet as WalletIcon,
  Star, MessageCircle, AlertCircle, Share2, Heart, Award,
  Calendar, Bot, FileText, Info,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { SafeImage } from '@/components/shared/SafeImage';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { PreferencesModal } from '@/features/users/components/PreferencesModal';
import { ChangePasswordModal } from '@/features/users/components/ChangePasswordModal';
import { PrivacyModal } from '@/features/users/components/PrivacyModal';
import { EditPhoneModal } from '@/features/users/components/EditPhoneModal';
import { EditEmailModal } from '@/features/users/components/EditEmailModal';
import { useLogout, useDeleteAccount } from '@/features/auth/hooks/useAuth';
import { useSettingsStore } from '@/stores/settings.store';
import { toast } from 'sonner';

interface SettingsProps {
  onBack?: () => void;
}

// ─── Circular progress indicator ─────────────────────────────────────────────
function CircularProgress({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={3} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="#FF7A00" strokeWidth={3}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Settings row item ────────────────────────────────────────────────────────
function SettingsRow({
  icon,
  iconBg = 'bg-gray-100',
  iconColor = 'text-gray-500',
  title,
  subtitle,
  onClick,
  rightEl,
  isLast = false,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  rightEl?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-[#252525] transition-colors text-left${!isLast ? ' border-b border-gray-100 dark:border-[#252525]' : ''}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg} ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium text-gray-900 dark:text-white">{title}</p>
        {subtitle && <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate">{subtitle}</p>}
      </div>
      {rightEl !== undefined ? rightEl : <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
    </button>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-1">
      {children}
    </p>
  );
}

// ─── Compute security score ───────────────────────────────────────────────────
function computeSecurityScore(user: any, kycStatus: string | null, notifEnabled: boolean): number {
  let score = 0;
  if (user?.email) score += 25;
  if (user?.phone) score += 20;
  if (kycStatus === 'verified') score += 35;
  else if (kycStatus === 'pending') score += 10;
  if (notifEnabled) score += 10;
  if (user?.profile?.avatarUrl) score += 10;
  return Math.min(100, score);
}

// ─── Main component ───────────────────────────────────────────────────────────
export function Settings({ onBack }: SettingsProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const profile = user?.profile;

  // Modal states — all preserved
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [kycStatus, setKycStatus] = useState<'pending' | 'verified' | 'rejected' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteReason, setDeleteReason] = useState('');

  const { notifEnabled } = useSettingsStore();
  const { mutate: doLogout, isPending: loggingOut } = useLogout();
  const { mutate: doDeleteAccount, isPending: deletingAccount } = useDeleteAccount();

  // Fetch KYC status
  useEffect(() => {
    apiClient.get('/users/me/kyc-status')
      .then(r => setKycStatus(r.data.kycStatus ?? null))
      .catch(() => setKycStatus((profile as any)?.kycStatus ?? null));
  }, [profile]);

  // Real profile data with rating (same pattern as AccountMenu & ProfileV2)
  const { data: myProfile } = useQuery({
    queryKey: ['public-profile', profile?.username],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${profile?.username}`);
      return data;
    },
    enabled: !!profile?.username,
  });

  // Profile data — exact same as AccountMenu
  const displayName = profile?.displayName || user?.email?.split('@')[0] || 'Utilisateur';
  const username = profile?.username ? `@${profile.username}` : user?.phone || '';
  const avatarUrl = profile?.avatarUrl ?? null;
  const rating = myProfile?.detailedStats?.rating?.toFixed(1) ?? null;
  const securityScore = computeSecurityScore(user, kycStatus, notifEnabled);

  // Check Early Adopter badge
  const userBadges: any[] = (user as any)?.badges ?? myProfile?.badges ?? [];
  const hasEarlyAdopter = userBadges.some((b: any) => b.badge === 'Early adopter');

  const handleLogout = () => doLogout();

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Let's Out",
        text: "Rejoins-moi sur Let's Out !",
        url: 'https://letsout.app',
      });
    } catch {
      try {
        await navigator.clipboard.writeText('https://letsout.app');
        toast.success('Lien copié !');
      } catch {
        toast.info('https://letsout.app');
      }
    }
  };

  const handleBack = () => {
    if (onBack) return onBack();
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate('/account');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F5F5F5] dark:bg-[#111111]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-safe-4 pt-4 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-9 h-9 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-[20px] font-bold text-gray-900 dark:text-white leading-tight">Paramètres</h1>
              <p className="text-[11px] text-gray-400 leading-snug">
                Gérez votre compte, votre sécurité<br />et vos préférences
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-10 space-y-3" style={{ scrollbarWidth: 'none' }}>

        {/* ── User profile card ────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-[60px] h-[60px] rounded-full overflow-hidden bg-gray-100 dark:bg-[#2A2A2A] border-2 border-white shadow-sm">
                <SafeImage
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/20">
                      <User className="w-7 h-7 text-[#FF7A00]" />
                    </div>
                  }
                />
              </div>
              {/* Camera icon overlay */}
              <div className="absolute -bottom-0.5 -right-0.5 w-[20px] h-[20px] rounded-full bg-[#FF7A00] flex items-center justify-center shadow-sm">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4" fill="none" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
            </div>

            {/* Name + username */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[16px] font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                {(kycStatus === 'verified' || user?.isVerified) && (
                  <div className="w-[18px] h-[18px] rounded-full bg-[#FF7A00] flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-[11px] h-[11px] text-white" />
                  </div>
                )}
              </div>
              <p className="text-[13px] text-gray-400 dark:text-gray-500">{username}</p>
            </div>

            {/* Modifier button */}
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-0.5 px-3 py-1.5 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full text-[12px] font-semibold text-gray-700 dark:text-gray-300 active:scale-95 transition-transform flex-shrink-0"
            >
              Modifier
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Badges row — Note réelle + Early Adopter */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {rating !== null && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ background: 'linear-gradient(90deg, #FFD700, #FF9500)', color: 'white' }}>
                <Star className="w-3 h-3 fill-white" />
                <span>Note {rating}</span>
              </div>
            )}
            {hasEarlyAdopter && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-500 text-white">
                <span>🚀</span>
                <span>Early Adopter</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Pro banner ───────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #FF9500 0%, #FF7A00 100%)' }}
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[18px]">👑</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-white font-bold text-[15px]">Let's Out</span>
              <span className="px-1.5 py-0.5 bg-white/30 rounded-md text-[10px] font-bold text-white tracking-wide">PRO</span>
            </div>
            <p className="text-white/80 text-[12px]">Profitez d'avantages exclusifs</p>
          </div>
          <button
            onClick={() => toast.info('Bientôt disponible !')}
            className="flex items-center gap-0.5 px-3 py-1.5 bg-white rounded-full text-[12px] font-semibold text-[#FF7A00] active:scale-95 transition-transform flex-shrink-0 whitespace-nowrap"
          >
            Découvrir <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* ── 3 stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5">

          {/* Sécurité */}
          <button
            onClick={() => setShowPassModal(true)}
            className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3 shadow-sm flex flex-col gap-1 active:scale-[0.97] transition-transform text-left"
          >
            <div className="flex items-start justify-between mb-0.5">
              <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-green-500" />
              </div>
            </div>
            <p className="text-[10px] font-bold text-gray-800 dark:text-white leading-tight">Sécurité</p>
            <p className="text-[9px] text-gray-400 leading-tight">Votre compte est sécurisé</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="relative flex-shrink-0">
                <CircularProgress value={securityScore} size={36} />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-800 dark:text-white">
                  {securityScore}
                </span>
              </div>
              <p className="text-[9px] text-green-500 font-semibold leading-tight">Score {securityScore}%</p>
            </div>
          </button>

          {/* Portefeuille — pas de solde pour la sécurité */}
          <button
            onClick={() => navigate('/wallet')}
            className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3 shadow-sm flex flex-col gap-1 active:scale-[0.97] transition-transform text-left"
          >
            <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mb-0.5">
              <WalletIcon className="w-4 h-4 text-[#FF7A00]" />
            </div>
            <p className="text-[10px] font-bold text-gray-800 dark:text-white leading-tight">Portefeuille</p>
            <p className="text-[9px] text-gray-400 leading-tight">Solde disponible</p>
            <div className="mt-auto pt-2">
              <span className="text-[9px] font-semibold text-[#FF7A00] flex items-center gap-0.5">
                Gérer <ChevronRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </button>

          {/* Notifications */}
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-3 shadow-sm flex flex-col gap-1 text-left">
            <div className="w-8 h-8 rounded-full bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-0.5">
              <Bell className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-[10px] font-bold text-gray-800 dark:text-white leading-tight">Notifications</p>
            <p className="text-[9px] text-gray-400 leading-tight">Personnalisées selon vos choix</p>
            <div className="mt-auto pt-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                notifEnabled
                  ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-400'
              }`}>
                {notifEnabled ? 'Actives' : 'Inactives'}
              </span>
            </div>
          </div>
        </div>

        {/* ── COMPTE ────────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Compte</SectionLabel>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
            <SettingsRow
              icon={<User className="w-4 h-4" />}
              iconBg="bg-orange-50 dark:bg-orange-500/10"
              iconColor="text-[#FF7A00]"
              title="Profil"
              subtitle="Informations personnelles"
              onClick={() => setShowEditModal(true)}
            />
            <SettingsRow
              icon={<Shield className="w-4 h-4" />}
              iconBg="bg-green-50 dark:bg-green-500/10"
              iconColor="text-green-500"
              title="Sécurité"
              subtitle="Mot de passe, vérification, sessions"
              onClick={() => setShowPassModal(true)}
            />
            <SettingsRow
              icon={<Globe className="w-4 h-4" />}
              iconBg="bg-blue-50 dark:bg-blue-500/10"
              iconColor="text-blue-500"
              title="Préférences"
              subtitle="Langue, thème, notifications"
              onClick={() => setShowPreferencesModal(true)}
            />
            <SettingsRow
              icon={<WalletIcon className="w-4 h-4" />}
              iconBg="bg-orange-50 dark:bg-orange-500/10"
              iconColor="text-[#FF7A00]"
              title="Paiements & Wallet"
              subtitle="Moyens de paiement, retraits, historique"
              onClick={() => navigate('/wallet')}
              isLast
            />
          </div>
        </div>

        {/* ── ÉVÉNEMENTS ────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Événements</SectionLabel>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
            <SettingsRow
              icon={<Calendar className="w-4 h-4" />}
              iconBg="bg-orange-50 dark:bg-orange-500/10"
              iconColor="text-[#FF7A00]"
              title="Mes événements"
              subtitle="Créez vos événements et invitations"
              onClick={() => navigate('/my-events')}
            />
            <SettingsRow
              icon={<Heart className="w-4 h-4" />}
              iconBg="bg-red-50 dark:bg-red-500/10"
              iconColor="text-red-500"
              title="Mes favoris"
              subtitle="Événements et organisateurs favoris"
              onClick={() => navigate('/my-events', { state: { tab: 'favorites' } })}
            />
            <SettingsRow
              icon={<Award className="w-4 h-4" />}
              iconBg="bg-yellow-50 dark:bg-yellow-500/10"
              iconColor="text-yellow-500"
              title="Mes badges"
              subtitle="Vos badges et récompenses"
              onClick={() => navigate('/profile')}
              isLast
            />
          </div>
        </div>

        {/* ── ASSISTANCE ────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>Assistance</SectionLabel>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
            <SettingsRow
              icon={<Bot className="w-4 h-4" />}
              iconBg="bg-violet-50 dark:bg-violet-500/10"
              iconColor="text-violet-500"
              title="Support IA"
              subtitle="Discutez avec notre IA"
              onClick={() => navigate('/support')}
            />
            <SettingsRow
              icon={<MessageCircle className="w-4 h-4" />}
              iconBg="bg-blue-50 dark:bg-blue-500/10"
              iconColor="text-blue-500"
              title="Contacter un agent"
              subtitle="Par chat ou email"
              onClick={() => window.open('mailto:support@letsout.app', '_blank')}
            />
            <SettingsRow
              icon={<HelpCircle className="w-4 h-4" />}
              iconBg="bg-cyan-50 dark:bg-cyan-500/10"
              iconColor="text-cyan-500"
              title="Centre d'aide"
              subtitle="Guides et FAQ"
              onClick={() => navigate('/support')}
            />
            <SettingsRow
              icon={<AlertCircle className="w-4 h-4" />}
              iconBg="bg-amber-50 dark:bg-amber-500/10"
              iconColor="text-amber-500"
              title="Signaler un problème"
              subtitle="Aidez-nous à nous améliorer"
              onClick={() => window.open('mailto:bugs@letsout.app?subject=Signalement%20d%27un%20probl%C3%A8me', '_blank')}
              isLast
            />
          </div>
        </div>

        {/* ── À PROPOS ──────────────────────────────────────────────────────── */}
        <div>
          <SectionLabel>À propos</SectionLabel>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
            <SettingsRow
              icon={<Info className="w-4 h-4" />}
              iconBg="bg-gray-100 dark:bg-[#2A2A2A]"
              iconColor="text-gray-500"
              title="Version de l'app"
              rightEl={<span className="text-[13px] text-gray-400 font-medium">1.0.0</span>}
            />
            <SettingsRow
              icon={<FileText className="w-4 h-4" />}
              iconBg="bg-gray-100 dark:bg-[#2A2A2A]"
              iconColor="text-gray-500"
              title="Conditions d'utilisation"
              onClick={() => navigate('/terms')}
            />
            <SettingsRow
              icon={<Lock className="w-4 h-4" />}
              iconBg="bg-gray-100 dark:bg-[#2A2A2A]"
              iconColor="text-gray-500"
              title="Politique de confidentialité"
              onClick={() => navigate('/privacy')}
            />
            <SettingsRow
              icon={<Star className="w-4 h-4" />}
              iconBg="bg-yellow-50 dark:bg-yellow-500/10"
              iconColor="text-yellow-500"
              title="Noter Let's Out"
              subtitle="Donnez votre avis"
              onClick={() => setShowRatingModal(true)}
            />
            <SettingsRow
              icon={<Share2 className="w-4 h-4" />}
              iconBg="bg-green-50 dark:bg-green-500/10"
              iconColor="text-green-500"
              title="Partager l'application"
              subtitle="Invitez vos amis"
              onClick={handleShare}
              isLast
            />
          </div>
        </div>

        {/* ── Admin (si applicable) ─────────────────────────────────────────── */}
        {user?.role === 'ADMIN' && (
          <div>
            <SectionLabel>Administration</SectionLabel>
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl overflow-hidden shadow-sm">
              <SettingsRow
                icon={<Shield className="w-4 h-4" />}
                iconBg="bg-red-50 dark:bg-red-500/10"
                iconColor="text-red-500"
                title="Dashboard Admin"
                subtitle="Gérer les KYC, événements, etc."
                onClick={() => navigate('/admin')}
                isLast
              />
            </div>
          </div>
        )}

        {/* ── Se déconnecter ─────────────────────────────────────────────────── */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-[#FF7A00] text-[#FF7A00] font-semibold text-[15px] bg-white dark:bg-[#1A1A1A] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
        >
          {loggingOut
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <LogOut className="w-5 h-5" />
          }
          Se déconnecter
        </button>

        {/* ── Supprimer mon compte ──────────────────────────────────────────── */}
        <button
          onClick={() => { setDeleteStep(1); setDeleteReason(''); setShowDeleteModal(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-semibold text-[15px] active:scale-[0.98] transition-all"
        >
          <Trash2 className="w-5 h-5" />
          Supprimer mon compte
        </button>

      </div>

      {/* ── Modales (toutes préservées) ─────────────────────────────────────── */}
      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
      {showPreferencesModal && <PreferencesModal onClose={() => setShowPreferencesModal(false)} />}
      {showPassModal && <ChangePasswordModal onClose={() => setShowPassModal(false)} />}
      {showPrivacyModal && <PrivacyModal onClose={() => setShowPrivacyModal(false)} />}
      {showPhoneModal && <EditPhoneModal onClose={() => setShowPhoneModal(false)} />}
      {showEmailModal && <EditEmailModal onClose={() => setShowEmailModal(false)} />}

      {/* ── Modale de note (Rating) ────────────────────────────────────────── */}
      {showRatingModal && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center px-4 pb-6 sm:p-4"
          onClick={() => setShowRatingModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#1A1A1A] w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="w-16 h-16 rounded-full bg-yellow-50 dark:bg-yellow-500/10 flex items-center justify-center">
                <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
              </div>
              <h2 className="text-[20px] font-bold text-gray-900 dark:text-white">Noter Let's Out</h2>
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                Où souhaitez-vous laisser votre avis ?
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => {
                  window.open('https://play.google.com/store/apps/details?id=app.letsout.android', '_blank');
                  setShowRatingModal(false);
                }}
                className="w-full py-4 bg-gray-50 dark:bg-[#222] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] rounded-2xl flex items-center justify-center gap-3 font-semibold text-gray-900 dark:text-white transition-colors border border-gray-100 dark:border-[#333]"
              >
                Google Play Store
              </button>
              <button
                onClick={() => {
                  window.open('https://apps.apple.com/app/lets-out/id123456789', '_blank');
                  setShowRatingModal(false);
                }}
                className="w-full py-4 bg-gray-50 dark:bg-[#222] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] rounded-2xl flex items-center justify-center gap-3 font-semibold text-gray-900 dark:text-white transition-colors border border-gray-100 dark:border-[#333]"
              >
                Apple App Store
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modale suppression de compte ─────────────────────────────────────── */}
      {showDeleteModal && createPortal(
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center px-4 pb-6 sm:p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white dark:bg-[#1A1A1A] w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteStep === 1 ? (
              <>
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
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
                    Motif de suppression
                  </label>
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
                    value={
                      !["Je ne trouve pas d'événements intéressants", "Problème technique", "Je crée un nouveau compte", "Confidentialité et données personnelles"].includes(deleteReason)
                        ? deleteReason : ''
                    }
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
                    {deletingAccount
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Suppression...</>
                      : <><Trash2 className="w-4 h-4" /> Supprimer définitivement</>
                    }
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
