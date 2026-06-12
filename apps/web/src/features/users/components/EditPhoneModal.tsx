import { useState, useRef, useEffect } from 'react';
import { X, Loader2, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { useSendOtp, useCheckOtp } from '@/features/auth/hooks/useAuth';

interface Props {
  onClose: () => void;
}

export function EditPhoneModal({ onClose }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState(user?.phone || '');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { mutate: sendOtp, isPending: sendingOtp } = useSendOtp();
  const { mutate: checkOtp, isPending: checkingOtp } = useCheckOtp();
  const [isPatching, setIsPatching] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = () => {
    if (!phone || phone.length < 6) return;
    
    // Si c'est le même numéro, pas besoin de le modifier
    if (phone === user?.phone) {
      toast.success(t('editPhoneModal.success') || 'Numéro mis à jour');
      onClose();
      return;
    }

    sendOtp({ target: phone, type: 'phone', channel: 'sms' }, {
      onSuccess: () => {
        setStep(2);
        setCountdown(59);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      },
      onError: (e: any) => {
        if (e?.response?.status === 429) toast.error('Trop de tentatives.');
        else toast.error(e?.response?.data?.message || "Erreur d'envoi du code");
      }
    });
  };

  const handleVerifyOtp = () => {
    const codeStr = otp.join('');
    if (codeStr.length < 6) return;

    checkOtp({ target: phone, code: codeStr }, {
      onSuccess: async () => {
        setIsPatching(true);
        try {
          await apiClient.patch('/users/me/phone', { phone });
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
            {step === 1 ? t('editPhoneModal.title') || 'Modifier le numéro' : 'Vérification'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:hover:bg-[#333333]">
            <X size={20} />
          </button>
        </div>

        {step === 1 ? (
          <>
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 ml-1">
                  {t('editPhoneModal.number') || 'Nouveau numéro'}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="auth-phone-input w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] rounded-2xl px-12 py-4 text-[15px] outline-none focus:border-action-primary focus:bg-white dark:bg-[#1A1A1A] transition-all"
                    placeholder="+33 6 12 34 56 78"
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                </div>
              </div>
            </div>

            <button
              onClick={handleSendCode}
              disabled={isLoading || !phone || phone.length < 6}
              className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Suivant'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Code à 6 chiffres envoyé par SMS au <strong className="text-gray-900 dark:text-white">{phone}</strong>
              </p>
              
              <div className="grid grid-cols-6 gap-2 w-full">
                {otp.map((d, i) => (
                  <input
                    key={i} ref={el => { otpRefs.current[i] = el; }}
                    type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    className={`aspect-square w-full text-center text-xl font-bold border-2 rounded-xl focus:outline-none transition-colors bg-white dark:bg-[#222222] text-gray-900 dark:text-white
                      ${d ? 'border-action-primary' : 'border-gray-200 dark:border-[#333333]'}
                      focus:border-action-primary`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="py-4 px-6 text-gray-500 font-bold rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-transform"
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



