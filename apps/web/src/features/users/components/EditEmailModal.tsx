import { useState, useRef, useEffect } from 'react';
import i18n from '@/lib/i18n'
import { X, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { useSendOtp, useCheckOtp } from '@/features/auth/hooks/useAuth';
import { useTranslation } from 'react-i18next';

interface Props {
  onClose: () => void;
}

export function EditEmailModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(user?.email || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp();
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp();
  const [isPatching, setIsPatching] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = () => {
    if (!email || !email.includes('@')) {
      toast.error(t('editEmailModal.veuillezEntrerUneAdresseE'));
      return;
    }

    if (email === user?.email) {
      toast.success(t('editEmailModal.adresseEMailAJour'));
      onClose();
      return;
    }

    sendOtp(
      { target: email, type: 'email' },
      {
        onSuccess: () => {
          setStep(2);
          setCountdown(59);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        },
        onError: (e: any) => {
          toast.error(e?.response?.data?.message || t('editEmailModal.erreurLorsDeLEnvoi'));
        },
      }
    );
  };

  const handleVerifyOtp = () => {
    const codeStr = otp.join('');
    if (codeStr.length < 6) return;

    checkOtp(
      { target: email, code: codeStr },
      {
        onSuccess: async () => {
          setIsPatching(true);
          try {
            // Le code est revérifié (et consommé) par le serveur avant d'enregistrer l'adresse
            const { data } = await apiClient.patch<{ ticketsToSend?: number }>('/users/me/email', { email, code: codeStr });
            await refreshUser();
            toast.success(t('editEmailModal.adresseEMailMiseA'));
            // Billets des événements à venir envoyés à la nouvelle adresse (tickets@letsout.app)
            if (data?.ticketsToSend) {
              toast.success(t('tickets.emailedAfterEmailAdded', { count: data.ticketsToSend, email }));
            }
            onClose();
          } catch (err: any) {
            toast.error(err.response?.data?.error || t('editEmailModal.erreurLorsDeLaMise'));
          } finally {
            setIsPatching(false);
          }
        },
        onError: () => toast.error(t('editEmailModal.codeInvalideOuExpire')),
      }
    );
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setOtp(['', '', '', '', '', '']);
    sendOtp(
      { target: email, type: 'email' },
      {
        onSuccess: () => {
          setCountdown(59);
          toast.success(t('editEmailModal.codeRenvoye'));
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        },
        onError: () => toast.error(t('editEmailModal.impossibleDeRenvoyerLeCode')),
      }
    );
  };

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return;
    const next = [...otp];
    next[i] = v.slice(-1);
    setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const isLoading = sendingOtp || checkingOtp || isPatching;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">
            {step === 1 ? (user?.email ? t('editEmailModal.modifierLEMail') : t('editEmailModal.ajouterUnEMail')) : t('editEmailModal.verification')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:hover:bg-[#333333]"
          >
            <X size={20} />
          </button>
        </div>

        {step === 1 ? (
          <>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 ml-1">
                  E-mail
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] rounded-2xl px-12 py-4 text-[16px] outline-none focus:border-2 focus:border-[var(--brand-orange-500)] focus:bg-white dark:bg-[#1A1A1A] transition-all"
                    placeholder={t('editEmailModal.votreEmailCom')}
                  />
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    size={20}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSendCode}
              disabled={isLoading || !email || !email.includes('@')}
              className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : i18n.t('createEvent.actions.next')}
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <p className="text-[14px] text-gray-500 dark:text-gray-400">
                <span>{i18n.t('editEmailModal.codeSentTo')}</span> <strong className="text-gray-900 dark:text-white">{email}</strong>
              </p>
            </div>

            <div
              className="grid gap-3 mb-6"
              style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
            >
              {otp.map((v, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={v}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  className={`aspect-square w-full text-center font-poppins text-[24px] font-semibold rounded-[12px] border-2 outline-none transition-colors bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white ${
                    v
                      ? 'border-[var(--brand-orange-500)]'
                      : 'border-gray-200 dark:border-white/10'
                  } focus:border-[var(--brand-orange-500)]`}
                />
              ))}
            </div>

            <button
              onClick={handleResend}
              disabled={countdown > 0 || isLoading}
              className="flex items-center gap-1.5 font-poppins text-[13px] text-gray-500 dark:text-gray-400 disabled:opacity-50 transition-opacity mb-8"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{t('editEmailModal.renvoyerLeCode')}</span>
              {countdown > 0 && (
                <span className="font-poppins text-[13px] text-gray-500 dark:text-gray-400">
                  {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                </span>
              )}
            </button>

            <button
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.join('').length < 6}
              className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('editEmailModal.verifierEtSauvegarder')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
