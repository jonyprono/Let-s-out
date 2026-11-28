import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ShieldAlert, HeartHandshake, FileCheck2, Upload, X } from 'lucide-react'
import { charitiesApi, charityKeys, DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'

interface CharityPoolFieldsProps {
  isKycVerified: boolean
  orgId: string | null
  onOrgChange: (id: string | null) => void
  proofRef: string | null
  onProofChange: (ref: string | null) => void
}

/**
 * Champs d'une cagnotte solidaire / santé (catégorie CHARITY) à la création d'un événement :
 * KYC vérifié obligatoire, ONG partenaire agréée obligatoire, justificatif médical facultatif.
 * Les mêmes règles sont revérifiées par l'API.
 */
export function CharityPoolFields({ isKycVerified, orgId, onOrgChange, proofRef, onProofChange }: CharityPoolFieldsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [proofName, setProofName] = useState<string | null>(null)

  const { data: orgs, isLoading } = useQuery({
    queryKey: charityKeys.approved,
    queryFn: charitiesApi.approved,
    enabled: isKycVerified,
    staleTime: 5 * 60 * 1000,
  })

  if (!isKycVerified) {
    return (
      <div className="mt-3 p-4 rounded-[12px] border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]"><span>{t('charity.kycRequiredTitle')}</span></p>
            <p className="text-[12px] text-[var(--color-text-secondary)] mt-1"><span>{t('charity.kycRequiredDesc')}</span></p>
            <button
              type="button"
              onClick={() => navigate('/verify-profile')}
              className="mt-3 px-4 h-9 rounded-full bg-[#FF7A00] text-white text-[13px] font-semibold active:scale-95 transition-transform"
            >
              <span>{t('charity.verifyProfile')}</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_DOCUMENT_BYTES) { toast.error(t('charity.errors.fileTooLarge')); return }
    setUploading(true)
    try {
      const ref = await charitiesApi.uploadMedicalProof(file)
      onProofChange(ref)
      setProofName(file.name)
    } catch {
      toast.error(t('charity.errors.proofUpload'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mt-3 p-4 rounded-[12px] border border-[var(--border-default)] bg-[var(--color-background-alt)] space-y-4">
      <div className="flex items-start gap-2">
        <HeartHandshake className="w-5 h-5 text-[#FF7A00] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[var(--color-text-secondary)]"><span>{t('charity.intro')}</span></p>
      </div>

      {/* ONG partenaire (obligatoire) */}
      <div>
        <label htmlFor="charity-org" className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5 block">
          <span>{t('charity.orgLabel')}</span> <span className="text-red-500">*</span>
        </label>
        {isLoading ? (
          <div className="h-11 rounded-[12px] bg-[var(--border-default)] animate-pulse" />
        ) : orgs && orgs.length > 0 ? (
          <select
            id="charity-org"
            value={orgId ?? ''}
            onChange={(e) => onOrgChange(e.target.value || null)}
            className="w-full h-11 px-3 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)]"
          >
            <option value="">{t('charity.orgPlaceholder')}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : (
          <p className="text-[12px] text-[var(--color-text-secondary)]"><span>{t('charity.noOrg')}</span></p>
        )}
        {orgId && orgs && (() => {
          const org = orgs.find((o) => o.id === orgId)
          if (!org) return null
          return (
            <div className="mt-2 flex items-center gap-2">
              {org.logoUrl && <SafeImage src={org.logoUrl} alt={org.name} className="w-7 h-7 rounded-full object-cover" />}
              <p className="text-[12px] text-[var(--color-text-secondary)] line-clamp-2"><span>{org.description || org.name}</span></p>
            </div>
          )
        })()}
        <button
          type="button"
          onClick={() => navigate('/charities/apply')}
          className="mt-2 text-[12px] font-medium text-[#FF7A00] underline"
        >
          <span>{t('charity.applyLink')}</span>
        </button>
      </div>

      {/* Justificatif médical (facultatif) */}
      <div>
        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-0.5"><span>{t('charity.proofLabel')}</span></p>
        <p className="text-[11px] text-[var(--color-text-muted)] mb-2"><span>{t('charity.proofHint')}</span></p>
        <input
          ref={fileRef}
          type="file"
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {proofRef ? (
          <div className="flex items-center gap-2 px-3 h-11 rounded-[12px] border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10">
            <FileCheck2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[13px] text-[var(--color-text-primary)]"><span>{proofName || t('charity.proofAttached')}</span></span>
            <button type="button" aria-label={t('charity.removeProof')} onClick={() => { onProofChange(null); setProofName(null) }}>
              <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-[12px] border border-dashed border-[var(--border-default)] text-[13px] font-medium text-[var(--color-text-secondary)] disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? t('charity.uploading') : t('charity.addProof')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
