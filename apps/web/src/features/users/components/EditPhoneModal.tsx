import { useState } from 'react';
import { X, Loader2, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

interface Props {
  onClose: () => void;
}

export function EditPhoneModal({ onClose }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [phone, setPhone] = useState(user?.phone || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!phone || phone.length < 6) return;
    setIsLoading(true);
    try {
      await apiClient.patch('/users/me/phone', { phone });
      await refreshUser();
      toast.success(t('editPhoneModal.success'));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">{t('editPhoneModal.title')}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:bg-[#333333] dark:hover:bg-[#333333]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 ml-1">
              {t('editPhoneModal.number')}
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] rounded-2xl px-12 py-4 text-[15px] font-medium outline-none focus:border-[#FF9F1C] focus:bg-white dark:bg-[#1A1A1A] transition-all"
                placeholder="+33 6 12 34 56 78"
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-400" size={20} />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || !phone || phone.length < 6}
          className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #FF9F1C 0%, #FF9F1C 100%)' }}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('editPhoneModal.save')}
        </button>
      </div>
    </div>
  );
}



