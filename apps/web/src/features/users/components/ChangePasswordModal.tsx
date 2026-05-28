import { useState } from 'react';
import { X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!oldPassword || !newPassword || newPassword.length < 6) return;
    setIsLoading(true);
    try {
      await apiClient.patch('/users/me/password', { oldPassword, newPassword });
      toast.success(t('changePasswordModal.success'));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('changePasswordModal.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">{t('changePasswordModal.title')}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:bg-[#333333] dark:hover:bg-[#333333]">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 ml-1">
              {t('changePasswordModal.oldPassword')}
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] rounded-2xl px-4 py-4 text-[15px] font-medium outline-none focus:border-action-primary focus:bg-white dark:bg-[#1A1A1A] transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600"
              >
                {showOld ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 ml-1">
              {t('changePasswordModal.newPassword')}
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:border-[#333333] rounded-2xl px-4 py-4 text-[15px] font-medium outline-none focus:border-action-primary focus:bg-white dark:bg-[#1A1A1A] transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || !oldPassword || newPassword.length < 6}
          className="w-full py-4 flex items-center justify-center text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FF7A00 100%)' }}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('changePasswordModal.save')}
        </button>
      </div>
    </div>
  );
}



