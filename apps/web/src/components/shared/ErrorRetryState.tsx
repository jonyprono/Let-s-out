import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ErrorRetryStateProps {
  onRetry: () => void
  message?: string
  className?: string
}

// Shown instead of a silent empty-state when a list fetch actually failed
// (network error, 5xx, etc.) — distinct from "the list is genuinely empty".
export function ErrorRetryState({ onRetry, message, className }: ErrorRetryStateProps) {
  const { t } = useTranslation()
  return (
    <div className={`flex flex-col items-center py-14 gap-3 text-center px-8 ${className ?? ''}`}>
      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-2xl">⚠️</div>
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
        {message || t('common.loadError', 'Impossible de charger ce contenu.')}
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF7A00] text-white text-sm font-semibold active:opacity-80"
      >
        <RefreshCw className="w-4 h-4" />
        {t('common.retry', 'Réessayer')}
      </button>
    </div>
  )
}
