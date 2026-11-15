import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Ticket } from 'lucide-react'
import { intlLocale } from '@/lib/locale'
import { ticketingApi, ticketingKeys } from '../api'
import { formatFcfa } from './TicketingFields'

/**
 * Fiche événement — bloc « Participation » d'une billetterie multi-tarifs :
 * catégories (prix, places restantes / épuisé), accès à « Mes billets » et achat.
 */
export function EventTicketingBlock({
  eventId, hasTickets, isEnded, onBuy, onShowTickets,
}: {
  eventId: string
  hasTickets: boolean
  isEnded: boolean
  onBuy: () => void
  onShowTickets: () => void
}) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ticketingKeys.publicTiers(eventId),
    queryFn: () => ticketingApi.publicTiers(eventId),
    staleTime: 15_000,
  })
  const tiers = data?.tiers ?? []
  const allSoldOut = tiers.length > 0 && tiers.every((tr) => tr.soldOut)
  const canBuy = !!data?.onSale && !allSoldOut && !isEnded

  return (
    <div className="space-y-3 bg-[var(--color-background-alt)] p-4 rounded-[12px] border border-[var(--border-default)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-default)] border-dashed pb-3">
        <Ticket className="w-5 h-5 text-[#FF7A00]" aria-hidden="true" />
        <span className="text-[16px] font-semibold font-poppins text-[var(--color-text-primary)]"><span>{t('ticketing.event.title')}</span></span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#FF7A00]" aria-hidden="true" /></div>
      ) : tiers.length === 0 || !data?.onSale ? (
        <p className="text-[13px] text-[var(--color-text-secondary)]"><span>{t('ticketing.purchase.notOnSale')}</span></p>
      ) : (
        <ul className="space-y-2">
          {tiers.map((tr) => (
            <li key={tr.id} className={`flex items-center justify-between gap-3 ${tr.soldOut ? 'opacity-55' : ''}`}>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[var(--color-text-primary)] truncate"><span>{tr.name}</span></p>
                <p className={`text-[11px] ${tr.soldOut ? 'text-[#C81E1E] font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                  <span>{tr.soldOut ? t('ticketing.tier.soldOut') : t('ticketing.purchase.remaining', { count: tr.remaining, formatted: tr.remaining.toLocaleString(intlLocale()) })}</span>
                </p>
              </div>
              <span className="text-[14px] font-bold text-[#FF7A00] shrink-0"><span>{formatFcfa(tr.price)}</span></span>
            </li>
          ))}
        </ul>
      )}

      {allSoldOut && <p className="text-[13px] font-semibold text-[#C81E1E]"><span>{t('ticketing.event.allSoldOut')}</span></p>}

      {(hasTickets || canBuy) && (
        <div className="flex gap-2 pt-1">
          {hasTickets && (
            <button type="button" onClick={onShowTickets}
              className="flex-1 h-11 rounded-full bg-[#FF7A00] text-white font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98]">
              <Ticket className="w-4 h-4" aria-hidden="true" />
              <span>{t('tickets.myTicketsShort')}</span>
            </button>
          )}
          {canBuy && (
            <button type="button" onClick={onBuy}
              className={`flex-1 h-11 rounded-full font-semibold text-[14px] active:scale-[0.98] ${hasTickets ? 'border border-[#FF7A00] text-[#FF7A00]' : 'bg-[#FF7A00] text-white'}`}>
              <span>{hasTickets ? t('ticketing.event.buyMore') : t('ticketing.purchase.buyTickets')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
