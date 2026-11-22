import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'

/** Délai de traitement des demandes de retrait (cagnotte, billetterie, Wallet) */
export function PayoutDelayNotice({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      className={`flex items-start gap-2.5 rounded-[12px] border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/15 px-3.5 py-3 text-[12.5px] leading-snug text-blue-800 dark:text-blue-300 ${className}`}
      role="note"
    >
      <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
      <span>{t('payout.processingDelay')}</span>
    </div>
  )
}
