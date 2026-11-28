import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, FileCheck2, Upload, XCircle } from 'lucide-react'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { pagesApi, PAGE_ENTITY_TYPES, PAGE_DOCS_BY_TYPE, type PageEntityType, type PageDocField } from '../api'
import { PageVerifiedBadge } from './PageVerifiedBadge'
import { DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES } from '@/features/charities/api'

/** Section « Certification de la page » de la gestion de page (propriétaire uniquement). */
export function PageCertificationSection({ pageId }: { pageId: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [entityType, setEntityType] = useState<PageEntityType>('COMPANY')
  const [files, setFiles] = useState<Partial<Record<PageDocField, File>>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['page', pageId, 'verification'],
    queryFn: () => pagesApi.getVerification(pageId),
  })

  const docs = PAGE_DOCS_BY_TYPE[entityType]
  const missing = docs.required.some((d) => !files[d])

  const submit = useMutation({
    mutationFn: () => {
      const allowed = new Set<PageDocField>([...docs.required, ...docs.optional])
      const toSend = Object.fromEntries(Object.entries(files).filter(([k]) => allowed.has(k as PageDocField)))
      return pagesApi.submitVerification(pageId, entityType, toSend)
    },
    onSuccess: () => {
      toast.success(t('pageVerification.submitted'))
      setFiles({})
      qc.invalidateQueries({ queryKey: ['page', pageId, 'verification'] })
      qc.invalidateQueries({ queryKey: ['page', pageId] })
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code
      if (code === 'MISSING_DOCUMENTS') toast.error(t('pageVerification.errors.missingDocs'))
      else if (code === 'FILE_TOO_LARGE') toast.error(t('charity.errors.fileTooLarge'))
      else if (code === 'INVALID_FILE_TYPE') toast.error(t('charityApply.errors.fileType'))
      else if (code === 'REQUEST_PENDING' || code === 'ALREADY_VERIFIED') {
        qc.invalidateQueries({ queryKey: ['page', pageId, 'verification'] })
      } else toast.error(t('pageVerification.errors.generic'))
    },
  })

  const pickFile = (field: PageDocField, file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_DOCUMENT_BYTES) { toast.error(t('charity.errors.fileTooLarge')); return }
    setFiles((p) => ({ ...p, [field]: file }))
  }

  return (
    <div className="rounded-[16px] border border-[var(--border-default)] p-4">
      <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1"><span>{t('pageVerification.title')}</span></p>

      {isLoading || !data ? (
        <div className="h-16 rounded-[12px] bg-[var(--border-default)] animate-pulse" />
      ) : data.status === 'VERIFIED' ? (
        <div className="flex items-center gap-2 mt-2">
          <PageVerifiedBadge page={{ verificationStatus: 'VERIFIED', verificationBadge: data.badge }} size={20} />
          <p className="text-[14px] font-semibold text-[var(--color-text-primary)]"><span>{t('pageVerification.verified')}</span></p>
        </div>
      ) : data.status === 'PENDING' ? (
        <div className="flex items-start gap-2 mt-2 p-3 rounded-[12px] bg-amber-50 dark:bg-amber-500/10">
          <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]"><span>{t('pageVerification.pending')}</span></p>
            <p className="text-[12px] text-[var(--color-text-secondary)]"><span>{t('pageVerification.pendingDesc')}</span></p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 mt-1">
          <p className="text-[12px] text-[var(--color-text-secondary)]"><span>{t('pageVerification.intro')}</span></p>

          {data.status === 'REJECTED' && (
            <div className="flex items-start gap-2 p-3 rounded-[12px] bg-red-50 dark:bg-red-500/10">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700 dark:text-red-400">
                <span>{t('pageVerification.rejected')}</span>
                {data.lastRequest?.rejectionReason && <> <span>{t('charityApply.reason', { reason: data.lastRequest.rejectionReason })}</span></>}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="page-entity-type" className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5 block">
              <span>{t('pageVerification.entityTypeLabel')}</span>
            </label>
            <select
              id="page-entity-type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as PageEntityType)}
              className="w-full h-11 px-3 border border-[var(--border-default)] rounded-[12px] text-[15px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none"
            >
              {PAGE_ENTITY_TYPES.map((et) => <option key={et} value={et}>{t(`pageVerification.entityTypes.${et}`)}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {[...docs.required.map((d) => [d, true] as const), ...docs.optional.map((d) => [d, false] as const)].map(([field, required]) => {
              const file = files[field]
              const inputId = `page-doc-${field}`
              return (
                <div key={field}>
                  <input id={inputId} type="file" accept={DOCUMENT_ACCEPT} className="hidden" onChange={(e) => pickFile(field, e.target.files?.[0])} />
                  <label
                    htmlFor={inputId}
                    className={`flex items-center gap-3 px-3 py-3 rounded-[12px] border cursor-pointer ${file ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10' : 'border-dashed border-[var(--border-default)]'}`}
                  >
                    {file ? <FileCheck2 className="w-4 h-4 text-green-600 shrink-0" /> : <Upload className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-[var(--color-text-primary)]">
                        <span>{t(`pageVerification.docs.${field}`)}</span>{required && <span className="text-red-500"> *</span>}
                      </span>
                      <span className="block text-[11px] text-[var(--color-text-muted)] truncate"><span>{file ? file.name : t('charityApply.chooseFile')}</span></span>
                    </span>
                  </label>
                </div>
              )
            })}
          </div>

          <PrimaryButton onClick={() => submit.mutate()} disabled={missing || submit.isPending} loading={submit.isPending}>
            {submit.isPending ? t('pageVerification.submitting') : t('pageVerification.submit')}
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}
