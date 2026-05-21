import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/settings.store';

interface Props {
  onClose: () => void;
}

export function LanguageModal({ onClose }: Props) {
  const { t } = useTranslation();
  const { language, setLanguage } = useSettingsStore();
  const [selected, setSelected] = useState(language);

  const handleSave = () => {
    setLanguage(selected);
    import('@/lib/i18n').then(({ default: i18n }) => {
      i18n.changeLanguage(selected);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-5 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#FFFFFF]">{t('languageModal.title')}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:hover:bg-[#333333]">
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('languageModal.select')}</p>

        <div className="space-y-3 mb-6">
          <button
            onClick={() => setSelected('fr')}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
              selected === 'fr' ? 'border-[#FF9F1C] bg-orange-50/50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-[#333333] hover:border-gray-200 dark:hover:border-[#444444]'
            }`}
          >
            <span className={`font-semibold ${selected === 'fr' ? 'text-[#FF9F1C]' : 'text-gray-700 dark:text-gray-300'}`}>
              {t('languageModal.french')}
            </span>
            {selected === 'fr' && <Check size={20} className="text-[#FF9F1C]" />}
          </button>

          <button
            onClick={() => setSelected('en')}
            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
              selected === 'en' ? 'border-[#FF9F1C] bg-orange-50/50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-[#333333] hover:border-gray-200 dark:hover:border-[#444444]'
            }`}
          >
            <span className={`font-semibold ${selected === 'en' ? 'text-[#FF9F1C]' : 'text-gray-700 dark:text-gray-300'}`}>
              {t('languageModal.english')}
            </span>
            {selected === 'en' && <Check size={20} className="text-[#FF9F1C]" />}
          </button>
        </div>

        <button
          onClick={handleSave}
          className="w-full py-4 text-white font-bold rounded-2xl shadow-lg shadow-orange-400/20 active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #FF9F1C 0%, #FF9F1C 100%)' }}
        >
          {t('languageModal.save')}
        </button>
      </div>
    </div>
  );
}



