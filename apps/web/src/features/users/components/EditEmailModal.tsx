import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { useSendOtp, useCheckOtp } from '@/features/auth/hooks/useAuth';

interface Props {
  onClose: () => void;
}

export function EditEmailModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

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
      toast.error('Veuillez entrer une adresse e-mail valide.');
      return;
    }

    if (email === user?.email) {
      toast.success('Adresse e-mail à jour');
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
          toast.error(e?.response?.data?.message || "Erreur lors de l'envoi du code");
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
            await apiClient.patch('/users/me/email', { email });
            await refreshUser();
            toast.success('Adresse e-mail mise à jour avec succès');
            onClose();
          } catch (err: any) {
            toast.error(err.response?.data?.error || 'Erreur lors de la mise à jour');
          } finally {
            setIsPatching(false);
          }
        },
        onError: () => toast.error('Code invalide ou expiré.'),
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
          toast.success('Code renvoyé');
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        },
        onError: () => toast.error('Impossible de renvoyer le code'),
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
            {step === 1 ? (user?.email ? 'Modifier l\'e-mail' : 'Ajouter un e-mail') : 'Vérification'}
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
                    className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] rounded-2xl px-12 py-4 text-[15px] outline-none focus:border-action-primary focus:bg-white dark:bg-[#1A1A1A] transition-all"
                    placeholder="votre@email.com"
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
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Suivant'}
            </button>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <p className="text-[14px] text-gray-500 dark:text-gray-400">
                Code à 6 chiffres envoyé à <strong className="text-gray-900 dark:text-white">{email}</strong>
              </p>
            </div>

            <div className="flex justify-between gap-2 mb-8">
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
                  className="w-12 h-14 text-center text-xl font-bold bg-white dark:bg-[#222222] border-2 border-gray-200 dark:border-[#333333] rounded-xl focus:border-action-primary focus:ring-4 focus:ring-action-primary/10 outline-none transition-all dark:text-white"
                />
              ))}
            </div>

            <div className="flex items-center justify-between mb-8">
              <button
                onClick={handleResend}
                disabled={countdown > 0 || isLoading}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
              >
                Renvoyer le code
              </button>
              {countdown > 0 && (
                <span className="text-sm font-medium text-gray-400">dans 00:{countdown.toString().padStart(2, '0')}</span>
              )}
            </div>

            <button
              onClick={handleVerifyOtp}
              disabled={isLoading || otp.join('').length < 6}
              className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vérifier et Sauvegarder'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
