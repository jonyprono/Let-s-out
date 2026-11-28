import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { verificationsAdminApi, type PageReviewStatus } from '@/features/admin/api/verifications-admin.api'
import { DocumentLinks, InfoRow, ReviewActions, StatusFilter, StatusPill } from './AdminReviewKit'
import { PageVerifiedBadge } from '@/features/pages/components/PageVerifiedBadge'
import { intlLocale } from '@/lib/locale'
import { badgeForEntityType } from '@/features/pages/api'

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const

/** Back-office : certification des pages (badge officiel anti-usurpation). */
export function AdminPageVerificationsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [status, setStatus] = useState<PageReviewStatus | undefined>('PENDING')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'page-verifications', status],
    queryFn: () => verificationsAdminApi.pageRequests(status),
  })
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin', 'page-verifications', 'detail', selectedId],
    queryFn: () => verificationsAdminApi.pageRequest(selectedId!),
    enabled: !!selectedId,
  })

  const review = useMutation({
    mutationFn: (body: { action: 'approve' } | { action: 'reject'; reason: string }) =>
      verificationsAdminApi.reviewPage(selectedId!, body),
    onSuccess: (_d, body) => {
      toast.success(body.action === 'approve' ? t('adminVerif.pages.approved') : t('adminVerif.pages.rejected'))
      qc.invalidateQueries({ queryKey: ['admin', 'page-verifications'] })
      setSelectedId(null)
    },
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
              <div className="w-14 h-14 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0 text-xl font-bold text-white/50">
                {detail.page.avatarUrl ? <img src={detail.page.avatarUrl} alt={detail.page.name} className="w-full h-full object-cover" /> : detail.page.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate"><span>{detail.page.name}</span></h1>
                <StatusPill status={detail.status} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoRow label={t('pageVerification.entityTypeLabel')} value={t(`pageVerification.entityTypes.${detail.entityType}`)} />
              <InfoRow label={t('adminVerif.pages.category')} value={detail.page.category} />
              <InfoRow label={t('adminVerif.pages.audience')} value={t('adminVerif.pages.audienceValue', { followers: detail.page._count.followers, posts: detail.page._count.posts })} />
              <InfoRow label={t('adminVerif.submittedAt')} value={fmt(detail.createdAt)} />
              <InfoRow
                label={t('adminVerif.applicant')}
                value={<span>{detail.submittedBy.profile?.displayName} · {t(`adminVerif.kyc.${detail.submittedBy.profile?.kycStatus ?? 'pending'}`)}</span>}
              />
              <InfoRow label={t('adminVerif.pages.pageCreated')} value={fmt(detail.page.createdAt)} />
            </div>
            {detail.page.description && <p className="text-sm text-white/70 whitespace-pre-line"><span>{detail.page.description}</span></p>}
            {detail.rejectionReason && (
              <p className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-sm text-red-300">
                <span>{t('charityApply.reason', { reason: detail.rejectionReason })}</span>
              </p>
            )}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white"><span>{t('adminVerif.documents')}</span></h2>
              <DocumentLinks documents={detail.documents} labelPrefix="pageVerification.docs" />
            </div>
            {detail.status === 'PENDING' && (
              <ReviewActions
                approveLabel={t('adminVerif.pages.approve')}
                onApprove={() => review.mutate({ action: 'approve' })}
                onReject={(reason) => review.mutate({ action: 'reject', reason })}
                pending={review.isPending}
                approveExtra={(() => {
                  // Badge déduit du type de structure (règle serveur) : affiché pour information
                  const badge = badgeForEntityType(detail.entityType)
                  return (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                      <span>{t('adminVerif.pages.badge')}</span>
                      <PageVerifiedBadge page={{ verificationStatus: 'VERIFIED', verificationBadge: badge }} size={16} />
                      <span className="font-semibold text-white">{t(`adminVerif.pages.badges.${badge}`)}</span>
                      <span className="text-white/40">{t(`adminVerif.pages.badgeRule.${badge}`)}</span>
                    </div>
                  )
                })()}
              />
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white"><span>{t('adminVerif.pages.title')}</span></h1>
        <p className="text-sm text-white/50 mt-1"><span>{t('adminVerif.pages.subtitle')}</span></p>
      </div>
      <StatusFilter value={status} onChange={setStatus} options={STATUSES} />
      {isLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      ) : !list || list.length === 0 ? (
        <p className="text-sm text-white/40"><span>{t('adminVerif.empty')}</span></p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-black/20 hover:border-action-primary/40 text-left"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0 font-bold text-white/50">
                {r.page.avatarUrl ? <img src={r.page.avatarUrl} alt={r.page.name} className="w-full h-full object-cover" /> : r.page.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate"><span>{r.page.name}</span></p>
                <p className="text-xs text-white/40 truncate">
                  <span>{t(`pageVerification.entityTypes.${r.entityType}`)} · {r.submittedBy.profile?.displayName} · {fmt(r.createdAt)}</span>
                </p>
              </div>
              <StatusPill status={r.status} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
