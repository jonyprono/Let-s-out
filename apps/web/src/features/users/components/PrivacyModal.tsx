import { useState } from 'react';
import { X, Loader2, Globe, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

interface Props {
  onClose: () => void;
}

export function PrivacyModal({ onClose }: Props) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [isPublic, setIsPublic] = useState(user?.profile?.isPublic ?? true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiClient.patch('/users/me/profile', { isPublic });
      await refreshUser();
      toast.success(t('changePasswordModal.success')); // Or generic success
      onClose();
    } catch (err: any) {
      toast.error('Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">{t('privacyModal.title')}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:bg-[#333333] dark:hover:bg-[#333333]">
            <X size={20} />
          </button>
        </div>

        <div className="mb-8">
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
              isPublic ? 'border-green-500 bg-green-50/50' : 'border-gray-200 dark:border-[#333333] hover:border-gray-300 dark:hover:border-[#444444]'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isPublic ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-400 dark:text-gray-500 dark:text-gray-400'}`}>
              {isPublic ? <Globe size={24} /> : <Lock size={24} />}
            </div>
            <div className="flex-1 text-left">
              <h3 className={`font-bold ${isPublic ? 'text-green-700' : 'text-gray-900 dark:text-[#FFFFFF]'}`}>{t('privacyModal.isPublic')}</h3>
              <p className={`text-xs mt-1 leading-relaxed ${isPublic ? 'text-green-600/80' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('privacyModal.isPublicDesc')}
              </p>
            </div>
            <div className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${isPublic ? 'bg-green-500' : 'bg-gray-200 dark:bg-[#333333]'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-[#1A1A1A] rounded-full shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('privacyModal.save')}
        </button>
      </div>
    </div>
  );
}



