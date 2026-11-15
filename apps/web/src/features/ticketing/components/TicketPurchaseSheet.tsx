import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, Ticket } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { apiClient } from '@/lib/api-client'
import { hapticFeedback } from '@/lib/haptics'
import { intlLocale } from '@/lib/locale'
import { openFedapayCheckout } from '@/lib/fedapay-checkout'
import { apiErrorMessage, ticketingApi, ticketingKeys } from '../api'
import { formatFcfa } from './TicketingFields'

/**
 * Achat de billets (billetterie multi-tarifs) : choix des catégories et des quantités,
 * un seul paiement FedaPay pour tout le panier. Le montant est recalculé par le serveur.
 */
export function TicketPurchaseSheet({ event, open, onClose }: { event: { id: string; title: string }; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [qty, setQty] = useState<Record<string, number>>({})
  const [paying, setPaying] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ticketingKeys.publicTiers(event.id),
    queryFn: () => ticketingApi.publicTiers(event.id),
    enabled: open,
    staleTime: 10_000,
  })

  // Nouveau panier à chaque ouverture
  useEffect(() => { if (open) setQty({}) }, [open])

  const tiers = data?.tiers ?? []
  const maxPerOrder = data?.maxPerOrder ?? 0
  const count = useMemo(() => Object.values(qty).reduce((a, b) => a + b, 0), [qty])
  const total = useMemo(() => tiers.reduce((sum, tr) => sum + (qty[tr.id] ?? 0) * tr.price, 0), [tiers, qty])

  const change = (tierId: string, delta: number, remaining: number) => {
    hapticFeedback.impact()
    setQty((prev) => {
      const current = prev[tierId] ?? 0
      const next = Math.max(0, Math.min(remaining, current + delta))
      if (delta > 0 && count >= maxPerOrder) return prev
      return { ...prev, [tierId]: next }
    })
  }

  const finish = (amount: number, ticketCount: number) => {
    qc.invalidateQueries({ queryKey: ['chat'] })
    qc.invalidateQueries({ queryKey: ['events', event.id] })
    qc.invalidateQueries({ queryKey: ['events', event.id, 'my-booking'] })
    qc.invalidateQueries({ queryKey: ticketingKeys.myTickets(event.id) })
    qc.invalidateQueries({ queryKey: ticketingKeys.publicTiers(event.id) })
    setPaying(false)
    onClose()
    navigate(`/events/${event.id}/success`, { state: { amountPaid: amount, ticketCount } })
  }

  const pay = async () => {
    if (count === 0 || paying) return
    hapticFeedback.impact()
    setPaying(true)
    const ticketLines = Object.entries(qty).filter(([, q]) => q > 0).map(([tierId, quantity]) => ({ tierId, quantity }))
    const payload = { eventId: event.id, ticketLines }
    try {
      const { data: tx } = await apiClient.post('/payments/fedapay/initiate', payload)
      if (tx.devMode) {
        await apiClient.post('/payments/dev/confirm-booking', payload)
        finish(tx.amount, tx.ticketCount ?? count)
        return
      }
      await openFedapayCheckout(tx, {
        onDismissed: () => { toast.error(t('payment.toasts.cancelled')); setPaying(false) },
        onCompleted: async () => {
          try {
            await apiClient.post('/payments/sync-missed', { eventId: event.id, transactionId: tx.transactionId })
          } catch {
            // Le webhook FedaPay confirmera la commande : les billets apparaîtront dans « Mes billets »
            toast.info(t('ticketing.purchase.confirming'))
          }
          finish(tx.amount, tx.ticketCount ?? count)
        },
      })
    } catch (err: any) {
      setPaying(false)
      const code = err?.response?.data?.code
      if (code === 'TICKET_SOLD_OUT' || code === 'TICKET_NOT_ENOUGH' || code === 'TICKET_TIER_UNAVAILABLE') {
        toast.error(t('ticketing.purchase.stockChanged'))
        refetch()
        return
      }
      toast.error(apiErrorMessage(err, t('payment.errors.generic')))
    }
  }

  return (
    <BottomSheet title={t('ticketing.purchase.title')} open={open} onClose={() => !paying && onClose()}>
      <div className="flex flex-col gap-4 font-poppins">
        <p className="text-[13px] text-[var(--color-text-secondary)] -mt-1 truncate"><span>{event.title}</span></p>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" aria-hidden="true" /></div>
        ) : isError || !data ? (
          <div className="text-center py-6">
            <p className="text-[14px] text-[var(--color-text-secondary)]"><span>{t('ticketing.purchase.loadError')}</span></p>
            <button type="button" onClick={() => refetch()} className="mt-2 text-[13px] font-semibold text-[#FF7A00]"><span>{t('tickets.retry')}</span></button>
          </div>
        ) : !data.onSale || tiers.length === 0 ? (
          <div className="rounded-[12px] bg-[var(--color-background-secondary)] p-4 text-center text-[13px] text-[var(--color-text-secondary)]">
            <span>{t('ticketing.purchase.notOnSale')}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 max-h-[50dvh] overflow-y-auto -mx-1 px-1">
              {tiers.map((tier) => {
                const q = qty[tier.id] ?? 0
                const canAdd = !tier.soldOut && q < tier.remaining && count < maxPerOrder
                return (
                  <div key={tier.id}
                    className={`rounded-[14px] border p-3.5 flex items-center gap-3 transition-colors ${q > 0 ? 'border-[#FF7A00] bg-[#FFF8F1] dark:bg-[#2A1A0A]' : 'border-[var(--border-default)] bg-[var(--color-background-primary)]'} ${tier.soldOut ? 'opacity-55' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--color-text-primary)] truncate"><span>{tier.name}</span></p>
                      {tier.description ? <p className="text-[12px] text-[var(--color-text-secondary)] line-clamp-2"><span>{tier.description}</span></p> : null}
                      <p className="text-[15px] font-bold text-[#FF7A00] mt-0.5"><span>{formatFcfa(tier.price)}</span></p>
                      <p className={`text-[11px] font-medium ${tier.soldOut ? 'text-[#C81E1E]' : tier.remaining <= 10 ? 'text-[#B45309]' : 'text-[var(--color-text-muted)]'}`}>
                        <span>{tier.soldOut ? t('ticketing.tier.soldOut') : t('ticketing.purchase.remaining', { count: tier.remaining, formatted: tier.remaining.toLocaleString(intlLocale()) })}</span>
                      </p>
                    </div>
                    {!tier.soldOut && (
                      <div className="flex items-center gap-2 shrink-0" role="group" aria-label={t('ticketing.purchase.quantityFor', { name: tier.name })}>
                        <button type="button" onClick={() => change(tier.id, -1, tier.remaining)} disabled={q === 0 || paying}
                          aria-label={t('ticketing.purchase.decrease')}
                          className="w-9 h-9 rounded-full border border-[var(--border-default)] flex items-center justify-center disabled:opacity-35 active:scale-95">
                          <Minus className="w-4 h-4 text-[var(--color-text-primary)]" />
                        </button>
                        <span className="w-6 text-center text-[16px] font-bold text-[var(--color-text-primary)]" aria-live="polite">{q}</span>
                        <button type="button" onClick={() => change(tier.id, 1, tier.remaining)} disabled={!canAdd || paying}
                          aria-label={t('ticketing.purchase.increase')}
                          className="w-9 h-9 rounded-full bg-[#FF7A00] flex items-center justify-center disabled:opacity-35 active:scale-95">
                          <Plus className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-[var(--color-text-muted)] text-center">
              <span>{count >= maxPerOrder ? t('ticketing.purchase.maxReached', { max: maxPerOrder }) : t('ticketing.purchase.maxPerOrder', { max: maxPerOrder })}</span>
            </p>

            <div className="rounded-[12px] border border-dashed border-[#CED1D3] p-3.5 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] text-[var(--color-text-secondary)]">
                <Ticket className="w-4 h-4 text-[#FF7A00]" aria-hidden="true" />
                <span>{t('ticketing.purchase.ticketCount', { count })}</span>
              </span>
              <span className="text-[18px] font-bold text-[var(--color-text-primary)]"><span>{formatFcfa(total)}</span></span>
            </div>

            <button type="button" onClick={pay} disabled={count === 0 || paying}
              className="w-full min-h-[48px] rounded-full text-white font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
              style={{ background: count === 0 || paying ? 'var(--color-button-disabled, #FBCF9E)' : 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)' }}>
              {paying ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : null}
              <span>{count === 0 ? t('ticketing.purchase.select') : t('ticketing.purchase.pay', { amount: formatFcfa(total) })}</span>
            </button>
            <p className="text-[11px] text-center text-[#6B7280]"><span>{t('payment.securePci')}</span><span>{' · FedaPay'}</span></p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
