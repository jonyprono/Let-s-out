import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import type { PartnerOrgPublic } from '../api'

/** Badge de confiance d'une cagnotte solidaire : « Cagnotte supervisée par <ONG> — Structure certifiée ». */
export function CharitySupervisionBadge({ org }: { org: PartnerOrgPublic }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 p-3 mb-4 rounded-[12px] border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10">
      <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1A1A] overflow-hidden flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-500/20">
        {org.logoUrl
          ? <SafeImage src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
          : <span className="text-[18px]" aria-hidden="true">🎗️</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-snug">
          <span aria-hidden="true">🎗️ </span><span>{t('charity.supervisedBy', { name: org.name })}</span>
        </p>
        <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t('charity.certifiedStructure')}</span>
        </p>
      </div>
    </div>
  )
}
