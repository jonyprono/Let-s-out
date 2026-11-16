import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { AlertTriangle, CheckCircle2, Clock, Pencil, ShieldCheck, Ticket, Wallet } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { currentLang, dateLocale, intlLocale } from '@/lib/locale'
import {
  apiErrorMessage, payoutInfoError, ticketingApi, ticketingKeys,
  type PayoutInfo, type PayoutNetwork, type TicketSales,
} from '../api'
import { AddTierButton, CommissionNotice, PayoutAccountFields, TierCard, TierFormSheet, formatFcfa } from './TicketingFields'

type EditingTier = { id: string; name: string; description: string | null; price: number; totalQuantity: number; soldQuantity: number } | 'new' | null

/**
 * Onglet « Billetterie » de ManageEvent (organisateur + co-organisateurs) :
 * bilan brut / commission / net en temps réel, statut du versement, catégories, compte Mobile Money.
 */
export function TicketingManager({ event }: { event: { id: string; creatorId: string; poolTarget?: number | null } }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<EditingTier>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [payout, setPayout] = useState<PayoutInfo>({ phone: '', network: '', name: '' })
  const [payoutErr, setPayoutErr] = useState<'phone' | 'network' | 'name' | null>(null)
  const [kycBlocked, setKycBlocked] = useState(false)
  const [opened, setOpened] = useState(false)
  const [kycModalOpen, setKycModalOpen] = useState(false)

  const hasPot = Boolean(event.poolTarget && event.poolTarget > 0)

  const { data: sales, isLoading, isError, refetch } = useQuery({
    queryKey: ticketingKeys.sales(event.id),
    queryFn: () => ticketingApi.sales(event.id),
    enabled: !hasPot,
    // Bilan « en temps réel » : rafraîchi régulièrement tant que l'onglet est ouvert
    refetchInterval: 15_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ticketingKeys.sales(event.id) })
    qc.invalidateQueries({ queryKey: ['events', event.id] })
  }

  const saveTier = useMutation({
    mutationFn: async (v: { name: string; description: string | null; price: number; totalQuantity: number }) => {
      if (editing && editing !== 'new') return ticketingApi.updateTier(event.id, editing.id, v)
      return ticketingApi.createTier(event.id, v)
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? t('ticketing.toasts.tierAdded') : t('ticketing.toasts.tierSaved'))
      setEditing(null)
      refresh()
    },
    onError: (err: any) => {
      if (err?.response?.data?.code === 'KYC_REQUIRED') { setKycBlocked(true); setEditing(null) }
      toast.error(apiErrorMessage(err, t('ticketing.toasts.saveError')))
    },
  })

  const toggleTier = useMutation({
    mutationFn: (tier: { id: string; isActive: boolean }) => ticketingApi.updateTier(event.id, tier.id, { isActive: !tier.isActive }),
    onSuccess: (res) => { toast.success(res.isActive ? t('ticketing.toasts.tierResumed') : t('ticketing.toasts.tierPaused')); refresh() },
    onError: (err: any) => toast.error(apiErrorMessage(err, t('ticketing.toasts.saveError'))),
  })

  const deleteTier = useMutation({
    mutationFn: (id: string) => ticketingApi.deleteTier(event.id, id),
    onSuccess: () => { toast.success(t('ticketing.toasts.tierDeleted')); setDeleting(null); refresh() },
    onError: (err: any) => { setDeleting(null); toast.error(apiErrorMessage(err, t('ticketing.toasts.saveError'))) },
  })

  const savePayout = useMutation({
    mutationFn: () => ticketingApi.savePayoutInfo(event.id, payout),
    onSuccess: () => { toast.success(t('ticketing.toasts.payoutSaved')); setPayoutOpen(false); refresh() },
    onError: (err: any) => {
      const f = err?.response?.data?.field
      if (f === 'phone' || f === 'network' || f === 'name') setPayoutErr(f)
      toast.error(apiErrorMessage(err, t('ticketing.toasts.saveError')))
    },
  })

  if (hasPot) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-[13px] text-gray-600 dark:text-gray-300">
        <span>{t('ticketing.manage.poolConflict')}</span>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex justify-center py-10"><div className="w-7 h-7 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" /></div>
  }

  if (isError || !sales) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center">
        <p className="text-[13px] text-gray-600 dark:text-gray-300"><span>{t('ticketing.manage.loadError')}</span></p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-[13px] font-semibold text-[#FF7A00]"><span>{t('tickets.retry')}</span></button>
      </div>
    )
  }

  const s: TicketSales = sales
  const percent = s.commissionPercent

  // Billetterie pas encore ouverte (aucune catégorie) : écran d'accueil, comme l'onglet Cagnotte.
  // « Ouvrir une billetterie » donne accès au gestionnaire complet ci-dessous.
  if (s.tiers.length === 0 && !opened) {
    return (
      <div className="w-full flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-100 dark:border-gray-800 mt-4">
        <div className="mb-6 flex justify-center">
          <div className="w-28 h-28 rounded-full bg-[#FFF3E8] dark:bg-[#2A1A0A] flex items-center justify-center">
            <Ticket className="w-14 h-14 text-[#FF7A00] -rotate-12" strokeWidth={1.5} aria-hidden="true" />
          </div>
        </div>
        <h2 className="text-[18px] font-bold text-[#1B1818] dark:text-white mb-2 text-center"><span>{t('ticketing.manage.emptyTitle')}</span></h2>
        <p className="text-[14px] text-[#737373] text-center mb-8 max-w-[280px] leading-relaxed">
          <span>{t('ticketing.manage.emptyDesc')}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            // Même règle que la cagnotte : compte du créateur vérifié (KYC) obligatoire
            if (s.creatorKycVerified === false) setKycModalOpen(true)
            else setOpened(true)
          }}
          className="w-full py-3.5 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 text-[14px] font-semibold text-gray-900 dark:text-white bg-white dark:bg-[#1A1A1A] active:scale-95 transition-transform"
        >
          <Ticket className="w-5 h-5" strokeWidth={1.5} aria-hidden="true" />
          <span>{t('ticketing.manage.openTicketing')}</span>
        </button>

        {/* Compte non vérifié : invitation à la vérification au lieu d'ouvrir la billetterie */}
        <BottomSheet title={t('ticketing.manage.kycTitle')} open={kycModalOpen} onClose={() => setKycModalOpen(false)}>
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-[#FFF3E8] dark:bg-[#2A1A0A] flex items-center justify-center mb-4">
              <ShieldCheck className="w-7 h-7 text-[#FF7A00]" aria-hidden="true" />
            </div>
            <p className="text-[14px] text-[var(--color-text-secondary)] mb-6 leading-relaxed">
              <span>{s.payoutInfo.canEdit ? t('ticketing.manage.kycDescCreator') : t('ticketing.manage.kycDescCohost')}</span>
            </p>
            {s.payoutInfo.canEdit ? (
              <PrimaryButton onClick={() => { setKycModalOpen(false); navigate('/verify-profile') }}>
                <span>{t('createEvent.done.verify')}</span>
              </PrimaryButton>
            ) : (
              <button type="button" onClick={() => setKycModalOpen(false)}
                className="w-full h-12 rounded-full border border-[var(--border-default)] text-[var(--color-text-primary)] font-semibold text-[14px]">
                <span>{t('tickets.cancel')}</span>
              </button>
            )}
          </div>
        </BottomSheet>
      </div>
    )
  }
  const fmtDate = (iso: string) => {
    try {
      return format(new Date(iso), currentLang() === 'fr' ? "d MMMM yyyy 'à' HH'h'mm" : 'PPp', { locale: dateLocale() })
    } catch { return iso }
  }
  const openPayout = () => {
    setPayout({
      phone: s.payoutInfo.canEdit ? (s.payoutInfo.phone ?? '') : '',
      network: (s.payoutInfo.network as PayoutNetwork) ?? '',
      name: s.payoutInfo.name ?? '',
    })
    setPayoutErr(null)
    setPayoutOpen(true)
  }
  const submitPayout = () => {
    const e = payoutInfoError(payout)
    setPayoutErr(e)
    if (!e) savePayout.mutate()
  }

  return (
    <div className="space-y-4 pb-8">
      {/* ── Bilan financier ── */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
        <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wide"><span>{t('ticketing.manage.netToReceive')}</span></p>
        <p className="text-[28px] font-bold text-gray-900 dark:text-white leading-tight mt-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
          <span>{formatFcfa(s.totals.net)}</span>
        </p>
        <div className="mt-4 space-y-2 text-[13px]">
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>{t('ticketing.manage.gross')}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{formatFcfa(s.totals.gross)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>{t('ticketing.summary.commission', { percent })}</span>
            <span className="font-semibold text-gray-900 dark:text-white">{`− ${formatFcfa(s.totals.fee)}`}</span>
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-800" />
          <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
            <span>{t('ticketing.manage.net')}</span>
            <span className="text-[#FF7A00]">{formatFcfa(s.totals.net)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: t('ticketing.manage.ticketsSold'), value: s.totals.ticketsIssued },
            { label: t('ticketing.manage.orders'), value: s.totals.orders },
            { label: t('ticketing.manage.checkedIn'), value: s.totals.ticketsCheckedIn },
          ].map((k) => (
            <div key={k.label} className="rounded-lg bg-gray-50 dark:bg-[#0F0F10] px-2 py-2 text-center">
              <p className="text-[17px] font-bold text-gray-900 dark:text-white"><span>{k.value.toLocaleString(intlLocale())}</span></p>
              <p className="text-[11px] text-gray-500"><span>{k.label}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Statut du versement ── */}
      <div className={`rounded-xl p-4 border flex gap-3 items-start ${s.payout.status === 'RELEASED'
        ? 'bg-[#ECFDF3] border-[#ABEFC6] dark:bg-[#0B2617] dark:border-[#14532D]'
        : 'bg-white border-gray-100 dark:bg-[#1A1A1A] dark:border-gray-800'}`}>
        {s.payout.status === 'RELEASED'
          ? <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-[1px]" aria-hidden="true" />
          : <Clock className="w-5 h-5 text-[#FF7A00] shrink-0 mt-[1px]" aria-hidden="true" />}
        <div className="flex-1 text-[13px]">
          <p className="font-semibold text-gray-900 dark:text-white">
            <span>{s.payout.status === 'RELEASED' ? t('ticketing.manage.payoutReleased') : t('ticketing.manage.payoutHeld')}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-300 mt-0.5">
            <span>{s.payout.status === 'RELEASED' && s.payout.releasedAt
              ? t('ticketing.manage.payoutReleasedOn', { date: fmtDate(s.payout.releasedAt) })
              : t('ticketing.manage.payoutHeldUntil', { date: fmtDate(s.payout.releaseAvailableAt), hours: s.payout.delayHours })}</span>
          </p>
          {s.payout.status === 'RELEASED' && s.payoutInfo.canEdit && (
            <button type="button" onClick={() => navigate('/wallet')} className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FF7A00]">
              <Wallet className="w-4 h-4" aria-hidden="true" />
              <span>{t('ticketing.manage.openWallet')}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Alerte : billetterie pas encore en vente ── */}
      {s.tiers.length > 0 && !s.payoutInfo.complete && (
        <div className="rounded-xl p-4 border border-[#FCD9BD] bg-[#FFF8F1] dark:bg-[#2A1A0A] dark:border-[#5C3511] flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-[#FF7A00] shrink-0 mt-[1px]" aria-hidden="true" />
          <p className="text-[13px] text-gray-700 dark:text-gray-200">
            <span>{s.payoutInfo.canEdit ? t('ticketing.manage.notOnSaleCreator') : t('ticketing.manage.notOnSaleCohost')}</span>
          </p>
        </div>
      )}
      {kycBlocked && (
        <div className="rounded-xl p-4 border border-[#FCD9BD] bg-[#FFF8F1] dark:bg-[#2A1A0A] dark:border-[#5C3511]">
          <p className="text-[13px] text-gray-700 dark:text-gray-200"><span>{t('ticketing.manage.kycRequired')}</span></p>
          {s.payoutInfo.canEdit && (
            <button type="button" onClick={() => navigate('/verify-profile')} className="mt-2 text-[13px] font-semibold text-[#FF7A00]">
              <span>{t('createEvent.done.verify')}</span>
            </button>
          )}
        </div>
      )}

      {/* ── Catégories ── */}
      <div>
        <p className="text-[15px] font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
          <span>{t('ticketing.manage.categories')}</span>
        </p>
        <div className="space-y-2.5">
          {s.tiers.length === 0 && (
            <p className="text-[13px] text-gray-500 py-2"><span>{t('ticketing.manage.noTiers')}</span></p>
          )}
          {s.tiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              percent={percent}
              busy={toggleTier.isPending || deleteTier.isPending}
              onEdit={() => setEditing({ id: tier.id, name: tier.name, description: tier.description, price: tier.price, totalQuantity: tier.totalQuantity, soldQuantity: tier.soldQuantity })}
              onDelete={tier.soldQuantity === 0 ? () => setDeleting({ id: tier.id, name: tier.name }) : undefined}
              onToggleActive={tier.soldQuantity > 0 ? () => toggleTier.mutate({ id: tier.id, isActive: tier.isActive }) : undefined}
            />
          ))}
          <AddTierButton onClick={() => setEditing('new')} />
        </div>
      </div>

      {/* ── Compte Mobile Money ── */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl p-4 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <span>{t('ticketing.payout.title')}</span>
          </p>
          {s.payoutInfo.canEdit && (
            <button type="button" onClick={openPayout} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#FF7A00]">
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{s.payoutInfo.complete ? t('ticketing.payout.edit') : t('ticketing.payout.configure')}</span>
            </button>
          )}
        </div>
        {s.payoutInfo.complete ? (
          <div className="mt-2 text-[13px] text-gray-600 dark:text-gray-300 space-y-0.5">
            <p><span className="font-semibold text-gray-900 dark:text-white">{s.payoutInfo.network}</span><span>{` · ${s.payoutInfo.phone ?? ''}`}</span></p>
            <p><span>{s.payoutInfo.name}</span></p>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-gray-500"><span>{t('ticketing.payout.notConfigured')}</span></p>
        )}
        {!s.payoutInfo.canEdit && (
          <p className="mt-2 text-[11px] text-gray-400"><span>{t('ticketing.payout.creatorOnly')}</span></p>
        )}
      </div>

      <CommissionNotice percent={percent} delayHours={s.payout.delayHours} />

      {/* ── Feuilles ── */}
      <TierFormSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        initial={editing && editing !== 'new' ? { name: editing.name, description: editing.description ?? '', price: String(editing.price), totalQuantity: String(editing.totalQuantity) } : null}
        minQuantity={editing && editing !== 'new' ? editing.soldQuantity : 0}
        percent={percent}
        saving={saveTier.isPending}
        onSubmit={(v) => saveTier.mutate(v)}
      />

      <BottomSheet title={t('ticketing.payout.title')} open={payoutOpen} onClose={() => setPayoutOpen(false)}>
        <div className="space-y-4">
          <PayoutAccountFields value={payout} onChange={(v) => { setPayout(v); setPayoutErr(null) }} errorField={payoutErr} />
          <PrimaryButton onClick={submitPayout} loading={savePayout.isPending} disabled={savePayout.isPending}>
            <span>{t('ticketing.payout.save')}</span>
          </PrimaryButton>
        </div>
      </BottomSheet>

      <BottomSheet title={t('ticketing.tier.deleteTitle')} open={!!deleting} onClose={() => setDeleting(null)}>
        <p className="text-[14px] text-[var(--color-text-secondary)] mb-5">
          <span>{t('ticketing.tier.deleteConfirm', { name: deleting?.name ?? '' })}</span>
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setDeleting(null)}
            className="flex-1 h-12 rounded-full border border-[var(--border-default)] text-[var(--color-text-primary)] font-semibold text-[14px]">
            <span>{t('tickets.cancel')}</span>
          </button>
          <button type="button" disabled={deleteTier.isPending} onClick={() => deleting && deleteTier.mutate(deleting.id)}
            className="flex-1 h-12 rounded-full bg-[#E02424] text-white font-semibold text-[14px] disabled:opacity-60">
            <span>{t('ticketing.tier.delete')}</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
