import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, QrCode, Ticket, CheckCircle2 } from 'lucide-react'
import { TopBar } from '@/components/ui/TopBar'
import { SafeImage } from '@/components/shared/SafeImage'
import { MyTicketModal } from '@/features/events/components/MyTicketModal'
import { ticketingApi, ticketingKeys, type AccessTicketSummary } from '@/features/ticketing/api'

/**
 * Rubrique « Mes billets » : tous les billets d'accès (QR) de l'utilisateur, gratuits ou payants,
 * sans dépendre de ses e-mails. Un appui ouvre le QR (même fenêtre que sur la fiche événement).
 */
export function MyTicketsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [opened, setOpened] = useState<AccessTicketSummary | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ticketingKeys.myAccessTickets,
    queryFn: ticketingApi.myAccessTickets,
    staleTime: 30_000,
  })

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const list = data ?? []
    return {
      upcoming: list.filter((x) => new Date(x.endAt).getTime() >= now),
      // Passés : du plus récent au plus ancien
      past: list.filter((x) => new Date(x.endAt).getTime() < now).reverse(),
    }
  }, [data])

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(i18n.language || 'fr', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

  const priceLabel = (x: AccessTicketSummary) =>
    x.totalPrice > 0 ? t('tickets.priceAmount', { amount: x.totalPrice.toLocaleString(i18n.language || 'fr') }) : t('tickets.free')

  const renderRow = (x: AccessTicketSummary, isPast: boolean) => {
    const cancelled = x.eventStatus === 'CANCELLED'
    return (
      <li key={x.eventId}>
        <button
          type="button"
          onClick={() => setOpened(x)}
          className={`w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-gray-800 text-left active:scale-[0.99] transition-transform ${isPast || cancelled ? 'opacity-70' : ''}`}
          aria-label={t('tickets.showQr')}
        >
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0">
            {x.coverUrl ? (
              <SafeImage src={x.coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Ticket className="w-6 h-6 text-gray-400" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[14px] text-gray-900 dark:text-white truncate"><span>{x.title}</span></p>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate"><span>{fmtDate(x.startAt)}</span></p>
            {x.location && (
              <p className="text-[12px] text-gray-400 dark:text-gray-500 truncate"><span>{x.location}</span></p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FF7A00]/10 text-[#FF7A00]">
                <span>{priceLabel(x)}</span>
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                <span>{t('tickets.count', { count: x.ticketsCount })}</span>
              </span>
              {cancelled ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                  <span>{t('tickets.cancelled')}</span>
                </span>
              ) : x.allUsed ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                  <span>{t('tickets.used')}</span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FF7A00] flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
        </button>
      </li>
    )
  }

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <TopBar
        title={<span>{t('tickets.pageTitle')}</span>}
        onBack={() => (window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/account'))}
        containerClassName="pt-12 pb-2 bg-white dark:bg-[#1A1A1A]"
      />
      <p className="px-4 pb-3 bg-white dark:bg-[#1A1A1A] text-[12px] text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        <span>{t('tickets.pageSubtitle')}</span>
      </p>

      <div className="flex-1 px-4 py-4 pb-28">
        {isLoading ? (
          <div className="flex justify-center py-16" role="status">
            <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" aria-hidden="true" />
            <span className="sr-only">{t('tickets.loading')}</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-[14px] text-gray-600 dark:text-gray-300"><span>{t('tickets.loadError')}</span></p>
            <button type="button" onClick={() => refetch()} className="px-4 py-2 rounded-full bg-[#FF7A00] text-white text-[13px] font-semibold">
              <span>{t('tickets.retry')}</span>
            </button>
          </div>
        ) : upcoming.length === 0 && past.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-[#FF7A00]/10 flex items-center justify-center">
              <Ticket className="w-7 h-7 text-[#FF7A00]" aria-hidden="true" />
            </div>
            <p className="font-semibold text-[15px] text-gray-900 dark:text-white"><span>{t('tickets.empty')}</span></p>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 max-w-[280px]"><span>{t('tickets.emptyHint')}</span></p>
            <button type="button" onClick={() => navigate('/explorer')} className="mt-2 px-5 py-2.5 rounded-full bg-[#FF7A00] text-white text-[14px] font-semibold active:scale-95 transition-transform">
              <span>{t('tickets.explore')}</span>
            </button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section className="mb-6">
                <h2 className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-2"><span>{t('tickets.upcoming')}</span></h2>
                <ul className="space-y-2.5">{upcoming.map((x) => renderRow(x, false))}</ul>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 mb-2"><span>{t('tickets.past')}</span></h2>
                <ul className="space-y-2.5">{past.map((x) => renderRow(x, true))}</ul>
              </section>
            )}
          </>
        )}
      </div>

      {opened && (
        <MyTicketModal
          eventId={opened.eventId}
          eventTitle={opened.title}
          eventDate={opened.startAt}
          open
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  )
}
