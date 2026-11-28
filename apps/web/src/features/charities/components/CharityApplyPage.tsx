import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileCheck2, Upload, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { TopBar } from '@/components/ui/TopBar'
import { Input } from '@/components/ui/input'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import {
  charitiesApi, charityKeys, CHARITY_REQUIRED_DOCS, CHARITY_OPTIONAL_DOCS, DOCUMENT_ACCEPT, MAX_DOCUMENT_BYTES,
  type CharityDocField, type PartnerOrgStatus,
} from '../api'

const TEXT_FIELDS = ['name', 'description', 'contactEmail', 'contactPhone', 'address', 'ifu', 'rccmOrReceiptNumber'] as const
type TextField = typeof TEXT_FIELDS[number]
const REQUIRED_TEXT: readonly TextField[] = ['name', 'contactEmail', 'contactPhone', 'rccmOrReceiptNumber']

const STATUS_STYLE: Record<PartnerOrgStatus, { Icon: typeof Clock; cls: string }> = {
  PENDING: { Icon: Clock, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10' },
  VERIFIED: { Icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' },
  REJECTED: { Icon: XCircle, cls: 'text-red-600 bg-red-50 dark:bg-red-500/10' },
}

/** Demande d'agrément d'une ONG partenaire (pièces légales examinées par les admins). */
export function CharityApplyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<TextField, string>>(
    Object.fromEntries(TEXT_FIELDS.map((f) => [f, ''])) as Record<TextField, string>,
  )
  const [files, setFiles] = useState<Partial<Record<CharityDocField | 'logo', File>>>({})

  const { data: mine } = useQuery({ queryKey: charityKeys.mine, queryFn: charitiesApi.mine })
  const hasPending = !!mine?.some((m) => m.kycStatus === 'PENDING')

  const missing =
    REQUIRED_TEXT.some((f) => !values[f].trim()) || CHARITY_REQUIRED_DOCS.some((d) => !files[d])

  const submit = useMutation({
    mutationFn: () => {
      const form = new FormData()
      for (const f of TEXT_FIELDS) if (values[f].trim()) form.append(f, values[f].trim())
      for (const [k, file] of Object.entries(files)) if (file) form.append(k, file)
      return charitiesApi.apply(form)
    },
    onSuccess: () => {
      toast.success(t('charityApply.submitted'))
      qc.invalidateQueries({ queryKey: charityKeys.mine })
      setValues(Object.fromEntries(TEXT_FIELDS.map((f) => [f, ''])) as Record<TextField, string>)
      setFiles({})
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code
      if (code === 'APPLICATION_PENDING') toast.error(t('charityApply.errors.pending'))
      else if (code === 'MISSING_DOCUMENTS') toast.error(t('charityApply.errors.missingDocs'))
      else if (code === 'FILE_TOO_LARGE') toast.error(t('charity.errors.fileTooLarge'))
      else if (code === 'INVALID_FILE_TYPE') toast.error(t('charityApply.errors.fileType'))
      else toast.error(t('charityApply.errors.generic'))
    },
  })

  const pickFile = (field: CharityDocField | 'logo', file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_DOCUMENT_BYTES) { toast.error(t('charity.errors.fileTooLarge')); return }
    setFiles((p) => ({ ...p, [field]: file }))
  }

  const docRow = (field: CharityDocField | 'logo', required: boolean, accept = DOCUMENT_ACCEPT) => {
    const file = files[field]
    const inputId = `charity-doc-${field}`
    return (
      <div key={field}>
        <input id={inputId} type="file" accept={accept} className="hidden" onChange={(e) => pickFile(field, e.target.files?.[0])} />
        <label
          htmlFor={inputId}
          className={`flex items-center gap-3 px-3 py-3 rounded-[12px] border cursor-pointer ${file ? 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10' : 'border-dashed border-[var(--border-default)]'}`}
        >
          {file ? <FileCheck2 className="w-4 h-4 text-green-600 shrink-0" /> : <Upload className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" />}
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-[var(--color-text-primary)]">
              <span>{t(`charityApply.docs.${field}`)}</span>{required && <span className="text-red-500"> *</span>}
            </span>
            <span className="block text-[11px] text-[var(--color-text-muted)] truncate"><span>{file ? file.name : t('charityApply.chooseFile')}</span></span>
          </span>
        </label>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-[var(--color-background-primary)]">
      <TopBar title={t('charityApply.title')} onBack={() => navigate(-1)} containerClassName="pt-safe-4" />
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-safe-4">
        <p className="text-[13px] text-[var(--color-text-secondary)] mt-2 mb-5"><span>{t('charityApply.intro')}</span></p>

        {mine && mine.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]"><span>{t('charityApply.myApplications')}</span></p>
            {mine.map((m) => {
              const { Icon, cls } = STATUS_STYLE[m.kycStatus]
              return (
                <div key={m.id} className="p-3 rounded-[12px] border border-[var(--border-default)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-medium text-[var(--color-text-primary)] truncate"><span>{m.name}</span></p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
                      <Icon className="w-3.5 h-3.5" /><span>{t(`charityApply.status.${m.kycStatus}`)}</span>
                    </span>
                  </div>
                  {m.kycStatus === 'REJECTED' && m.rejectionReason && (
                    <p className="text-[12px] text-red-600 mt-1"><span>{t('charityApply.reason', { reason: m.rejectionReason })}</span></p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {hasPending ? (
          <p className="text-[13px] text-[var(--color-text-secondary)] p-4 rounded-[12px] bg-[var(--color-background-alt)]"><span>{t('charityApply.pendingInfo')}</span></p>
        ) : (
          <div className="space-y-4">
            {TEXT_FIELDS.map((f) => (
              <div key={f}>
                <label htmlFor={`charity-${f}`} className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1.5 block">
                  <span>{t(`charityApply.fields.${f}`)}</span>{REQUIRED_TEXT.includes(f) && <span className="text-red-500"> *</span>}
                </label>
                {f === 'description' ? (
                  <textarea
                    id={`charity-${f}`}
                    rows={3}
                    maxLength={2000}
                    value={values[f]}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                    className="w-full px-4 py-3 border border-[var(--border-default)] rounded-[12px] text-[16px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] resize-none focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)]"
                  />
                ) : (
                  <Input
                    id={`charity-${f}`}
                    type={f === 'contactEmail' ? 'email' : f === 'contactPhone' ? 'tel' : 'text'}
                    autoCapitalize={f === 'contactEmail' ? 'none' : undefined}
                    value={values[f]}
                    onChange={(e) => setValues((p) => ({ ...p, [f]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]"><span>{t('charityApply.documentsTitle')}</span></p>
              <p className="text-[11px] text-[var(--color-text-muted)]"><span>{t('charityApply.documentsHint')}</span></p>
              {docRow('logo', false, 'image/jpeg,image/png,image/webp')}
              {CHARITY_REQUIRED_DOCS.map((d) => docRow(d, true))}
              {CHARITY_OPTIONAL_DOCS.map((d) => docRow(d, false))}
            </div>

            <div className="pt-2 pb-6">
              <PrimaryButton onClick={() => submit.mutate()} disabled={missing || submit.isPending} loading={submit.isPending}>
                {submit.isPending ? t('charityApply.submitting') : t('charityApply.submit')}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
