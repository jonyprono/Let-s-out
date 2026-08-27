import { useState, useRef, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { useSendOtp, useCheckOtp } from '@/features/auth/hooks/useAuth';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { COUNTRIES, Country } from '@/lib/countries';
import { PhoneInputField } from '@/components/shared/PhoneInputField';
import { usePhoneFormatter } from '@/lib/usePhoneFormatter';

declare global {
  interface Window { recaptchaVerifier: any; }
}

interface Props {
  onClose: () => void;
}

export function EditPhoneModal({ onClose }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [step, setStep] = useState(1);
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const { displayValue: phoneDisplay, rawValue: phone, handleChange: handlePhoneChange, reset: resetPhone } = usePhoneFormatter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp();
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp();
  const [isPatching, setIsPatching] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [nativeVerificationId, setNativeVerificationId] = useState<string>('');
  const [isFirebaseSending, setIsFirebaseSending] = useState(false);
  const [isFirebaseVerifying, setIsFirebaseVerifying] = useState(false);
  const [currentChannel, setCurrentChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  // Tracks exactly which channel sent the LAST code to prevent fallback hijacking
  const [lastCodeVia, setLastCodeVia] = useState<'firebase' | 'backend' | null>(null);

  // Build full phone exactly like Signup.tsx
  const fullPhone = `${country.code}${phone.replace(/\s+/g, '')}`;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!phone || phone.replace(/\s+/g, '').length < 6) {
      toast.error('Veuillez entrer un numéro de téléphone valide.');
      return;
    }

    if (fullPhone === user?.phone) {
      toast.success(t('editPhoneModal.success') || 'Numéro à jour');
      onClose();
      return;
    }

    if (currentChannel === 'whatsapp') {
      setIsFirebaseSending(true);
      setLastCodeVia('backend');
      sendOtp({ target: fullPhone, type: 'phone', channel: 'whatsapp' }, {
        onSuccess: () => {
          setStep(2);
          setCountdown(59);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
          setIsFirebaseSending(false);
        },
        onError: (e: any) => {
          setIsFirebaseSending(false);
          toast.error(e?.response?.data?.message || "Erreur lors de l'envoi du code");
        }
      });
      return;
    }

    try {
      setIsFirebaseSending(true);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch {}
        window.recaptchaVerifier = undefined;
      }

      if (Capacitor.isNativePlatform()) {
        const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
          setNativeVerificationId(event.verificationId);
          setLastCodeVia('firebase');
        });
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone });
        setStep(2);
        setCountdown(59);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        setTimeout(() => listener.remove(), 60000);
      } else {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-phone-edit', { size: 'invisible' });
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
        setConfirmationResult(confirmation);
        setLastCodeVia('firebase');
        setStep(2);
        setCountdown(59);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      console.error('Firebase phone send error:', err);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch {}
        window.recaptchaVerifier = undefined;
      }
      setConfirmationResult(null);
      setNativeVerificationId('');
      setLastCodeVia('backend');
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => {
          setStep(2);
          setCountdown(59);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        },
        onError: (e: any) => {
          if (e?.response?.status === 429) toast.error('Trop de tentatives. Attendez avant de réessayer.');
          else toast.error(e?.response?.data?.message || "Erreur lors de l'envoi du code");
        }
      });
    } finally {
      setIsFirebaseSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    const codeStr = otp.join('');
    if (codeStr.length < 6) return;

    const useFirebasePath = lastCodeVia === 'firebase' && (confirmationResult || nativeVerificationId);
    if (useFirebasePath) {
      setIsFirebaseVerifying(true);
      try {
        if (Capacitor.isNativePlatform() && nativeVerificationId) {
          await FirebaseAuthentication.confirmVerificationCode({
            verificationId: nativeVerificationId,
            verificationCode: codeStr,
          });
        } else if (confirmationResult) {
          await confirmationResult.confirm(codeStr);
        }
        // Firebase verified — patch backend
        setIsPatching(true);
        await apiClient.patch('/users/me/phone', { phone: fullPhone });
        await refreshUser();
        toast.success(t('editPhoneModal.success') || 'Numéro mis à jour');
        onClose();
      } catch (err: any) {
        if (err.response?.data?.error) {
          toast.error(err.response.data.error);
        } else {
          toast.error('Code invalide ou expiré');
        }
      } finally {
        setIsFirebaseVerifying(false);
        setIsPatching(false);
      }
    } else {
      // Fallback OTP flow (backend)
      checkOtp({ target: fullPhone, code: codeStr }, {
        onSuccess: async () => {
          setIsPatching(true);
          try {
            await apiClient.patch('/users/me/phone', { phone: fullPhone });
            await refreshUser();
            toast.success(t('editPhoneModal.success') || 'Numéro mis à jour');
            onClose();
          } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour');
          } finally {
            setIsPatching(false);
          }
        },
        onError: () => toast.error('Code invalide ou expiré.'),
      });
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp(['', '', '', '', '', '']);
    try {
      setIsFirebaseSending(true);
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch {}
        window.recaptchaVerifier = undefined;
      }
      if (Capacitor.isNativePlatform()) {
        const listener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
          setNativeVerificationId(event.verificationId);
          setLastCodeVia('firebase');
        });
        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber: fullPhone });
        setTimeout(() => listener.remove(), 60000);
        setCountdown(59);
        toast.success('Code renvoyé par SMS');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-phone-edit', { size: 'invisible' });
        const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
        setConfirmationResult(confirmation);
        setLastCodeVia('firebase');
        setCountdown(59);
        toast.success('Code renvoyé par SMS');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      }
    } catch {
      if (window.recaptchaVerifier) { try { window.recaptchaVerifier.clear(); } catch {} window.recaptchaVerifier = undefined; }
      setConfirmationResult(null);
      setNativeVerificationId('');
      setLastCodeVia('backend');
      sendOtp({ target: fullPhone, type: 'phone', channel: 'sms' }, {
        onSuccess: () => { setCountdown(59); toast.success('Code renvoyé'); setTimeout(() => otpRefs.current[0]?.focus(), 100); },
        onError: () => toast.error('Impossible de renvoyer le code'),
      });
    } finally {
      setIsFirebaseSending(false);
    }
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

  const isLoading = sendingOtp || checkingOtp || isPatching || isFirebaseSending || isFirebaseVerifying;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div id="recaptcha-container-phone-edit" />
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {step === 1 ? (user?.phone ? 'Modifier le numéro' : 'Ajouter un numéro') : 'Vérification'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:hover:bg-[#333333]">
            <X size={20} />
          </button>
        </div>

        {step === 1 ? (
          <>
            <div className="space-y-5 mb-8">
              <div>
                <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-2 block">
                  {t('editPhoneModal.number') || 'Nouveau numéro'}
                </label>
                <PhoneInputField
                  country={country}
                  onCountryChange={(c) => { setCountry(c); resetPhone(); }}
                  phoneDisplay={phoneDisplay}
                  onPhoneChange={handlePhoneChange}
                  onEnter={handleSendCode}
                />
              </div>

              <div>
                <label className="font-poppins text-[13px] font-medium text-gray-500 dark:text-gray-400 mb-3 block">
                  Moyen de réception
                </label>
                <div className="flex gap-3">
                  {/* TODO: réactiver le bouton WhatsApp quand prêt */}
                  {(['SMS'] as const).map((ch) => {
                    const val = ch.toLowerCase() as 'sms' | 'whatsapp';
                    const isActive = currentChannel === val;
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setCurrentChannel(val)}
                        className="flex-1 flex items-center justify-between px-4 h-[52px] rounded-[12px] border border-gray-200 dark:border-white/10 transition-colors gap-2 bg-white dark:bg-[#1A1A1A]"
                      >
                        <span className="flex-1 text-left font-poppins text-[15px] font-medium text-gray-900 dark:text-white">
                          {ch}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'border-[var(--brand-orange-500)]'
                              : 'border-gray-200 dark:border-white/10'
                          }`}
                        >
                          {isActive && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[var(--brand-orange-500)]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={handleSendCode}
              disabled={isLoading || !phone || phone.replace(/\s+/g, '').length < 6}
              className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer le code'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Code à 6 chiffres envoyé par SMS au <strong className="text-gray-900 dark:text-white">{fullPhone}</strong>
              </p>

              <div
                className="grid gap-3 mb-6"
                style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}
              >
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    className={`aspect-square w-full text-center font-poppins text-[24px] font-semibold rounded-[12px] border-2 outline-none transition-colors bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white ${
                      d
                        ? 'border-[var(--brand-orange-500)]'
                        : 'border-gray-200 dark:border-white/10'
                    } focus:border-[var(--brand-orange-500)]`}
                  />
                ))}
              </div>

              <button
                onClick={handleResend}
                disabled={countdown > 0 || isLoading}
                className="flex items-center gap-1.5 font-poppins text-[13px] text-gray-500 dark:text-gray-400 disabled:opacity-50 transition-opacity mb-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Renvoyer le code
                {countdown > 0 && (
                  <span className="font-poppins text-[13px] text-gray-500 dark:text-gray-400">
                    {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                  </span>
                )}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-4 px-6 text-gray-500 dark:text-gray-400 font-bold rounded-2xl bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 active:scale-[0.98] transition-transform"
              >
                Retour
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={isLoading || otp.join('').length < 6}
                className="flex-1 py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vérifier'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
