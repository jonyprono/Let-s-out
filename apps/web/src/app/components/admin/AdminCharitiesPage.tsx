import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, HeartHandshake, Loader2 } from 'lucide-react'
import { verificationsAdminApi, type OrgStatus } from '@/features/admin/api/verifications-admin.api'
import { DocumentLinks, InfoRow, ReviewActions, StatusFilter, StatusPill } from './AdminReviewKit'
import { intlLocale } from '@/lib/locale'

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const

/** Back-office : agrément des ONG partenaires (cagnottes solidaires). */
export function AdminCharitiesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [status, setStatus] = useState<OrgStatus | undefined>('PENDING')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'charities', status],
    queryFn: () => verificationsAdminApi.charities(status),
  })
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin', 'charities', 'detail', selectedId],
    queryFn: () => verificationsAdminApi.charity(selectedId!),
    enabled: !!selectedId,
  })

  const done = (msg: string) => {
    toast.success(msg)
    qc.invalidateQueries({ queryKey: ['admin', 'charities'] })
    setSelectedId(null)
  }
  const approve = useMutation({
    mutationFn: () => verificationsAdminApi.approveCharity(selectedId!),
    onSuccess: () => done(t('adminVerif.charities.approved')),
    onError: () => toast.error(t('adminVerif.error')),
  })
  const reject = useMutation({
    mutationFn: (reason: string) => verificationsAdminApi.rejectCharity(selectedId!, reason),
    onSuccess: () => done(t('adminVerif.charities.rejected')),
    onError: () => toast.error(t('adminVerif.error')),
  })

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleString(intlLocale()) : '—')

  if (selectedId) {
    return (
      <div className="p-4 lg:p-8 space-y-6 max-w-5xl">
        <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="w-4 h-4" /><span>{t('adminVerif.back')}</span>
        </button>
        {loadingDetail || !detail ? (
          <Loader2 className="w-6 h-6 animate-spin text-white/50" />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                {detail.logoUrl ? <img src={detail.logoUrl} alt={detail.name} className="w-full h-full object-cover" /> : <HeartHandshake className="w-6 h-6 text-white/40" />}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate"><span>{detail.name}</span></h1>
                <StatusPill status={detail.kycStatus} />
              </div>
            </div>
            {detail.description && <p className="text-sm text-white/70 whitespace-pre-line"><span>{detail.description}</span></p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoRow label={t('charityApply.fields.rccmOrReceiptNumber')} value={detail.rccmOrReceiptNumber} />
              <InfoRow label={t('charityApply.fields.ifu')} value={detail.ifu} />
              <InfoRow label={t('charityApply.fields.address')} value={detail.address} />
              <InfoRow label={t('charityApply.fields.contactEmail')} value={detail.contactEmail} />
              <InfoRow label={t('charityApply.fields.contactPhone')} value={detail.contactPhone} />
              <InfoRow label={t('adminVerif.submittedAt')} value={fmt(detail.createdAt)} />
              <InfoRow
                label={t('adminVerif.applicant')}
                value={<span>{detail.applicant.profile?.displayName} · {t(`adminVerif.kyc.${detail.applicant.profile?.kycStatus ?? 'pending'}`)}</span>}
              />
              <InfoRow label={t('adminVerif.charities.fundraisers')} value={String(detail._count.events)} />
            </div>
            {detail.rejectionReason && (
              <p className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-sm text-red-300">
                <span>{t('charityApply.reason', { reason: detail.rejectionReason })}</span>
              </p>
            )}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white"><span>{t('adminVerif.documents')}</span></h2>
              <DocumentLinks documents={detail.documents} labelPrefix="charityApply.docs" />
            </div>
            {/* Agrément (ou retrait : un rejet d'une ONG agréée bloque les nouvelles cagnottes) */}
            <ReviewActions
              approveLabel={t('adminVerif.charities.approve')}
              onApprove={() => approve.mutate()}
              onReject={(reason) => reject.mutate(reason)}
              pending={approve.isPending || reject.isPending}
            />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white"><span>{t('adminVerif.charities.title')}</span></h1>
        <p className="text-sm text-white/50 mt-1"><span>{t('adminVerif.charities.subtitle')}</span></p>
      </div>
      <StatusFilter value={status} onChange={setStatus} options={STATUSES} />
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      ) : !list || list.length === 0 ? (
        <p className="text-sm text-white/40"><span>{t('adminVerif.empty')}</span></p>
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setSelectedId(o.id)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-black/20 hover:border-action-primary/40 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                {o.logoUrl ? <img src={o.logoUrl} alt={o.name} className="w-full h-full object-cover" /> : <HeartHandshake className="w-5 h-5 text-white/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate"><span>{o.name}</span></p>
                <p className="text-xs text-white/40 truncate"><span>{o.applicant.profile?.displayName} · {fmt(o.createdAt)}</span></p>
              </div>
              <StatusPill status={o.kycStatus} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
