import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { X, Loader2, CheckCircle2 } from 'lucide-react'
import { eventsApi } from '@/features/events/api'
import { useAuthStore } from '@/stores/auth.store'

interface MyTicketModalProps {
  eventId: string
  eventTitle: string
  eventDate?: string | Date
  open: boolean
  onClose: () => void
}

/**
 * « Mon billet » : QR personnel à présenter à l'entrée.
 * Le QR encode le jeton secret du billet (jamais l'id de réservation). Fond blanc forcé pour
 * rester lisible par le scanner, même en thème sombre. Rendu dans <body> (portal, cf. iOS).
 */
export function MyTicketModal({ eventId, eventTitle, eventDate, open, onClose }: MyTicketModalProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const closeRef = useRef<HTMLButtonElement>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['events', eventId, 'my-ticket'],
    queryFn: () => eventsApi.getMyTicket(eventId),
    enabled: open,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  if (!open) return null

  const fmt = (d: string | Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language || 'fr', opts).format(new Date(d))

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-ticket-title"
    >
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-6 flex flex-col items-center gap-4 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="my-ticket-title" className="font-poppins font-bold text-[18px] text-gray-900 dark:text-white">
              <span>{t('tickets.myTicket')}</span>
            </h2>
            <p className="font-poppins text-[13px] text-gray-500 dark:text-gray-400 truncate">
              <span>{eventTitle}</span>
            </p>
            {eventDate && (
              <p className="font-poppins text-[12px] text-gray-500 dark:text-gray-400">
                <span>{fmt(eventDate, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('tickets.close')}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" aria-hidden="true" />
          </button>
        </div>

        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center" role="status">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--brand-orange-500)]" aria-hidden="true" />
            <span className="sr-only">{t('tickets.loading')}</span>
          </div>
        ) : isError || !data ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-center">
            <p className="font-poppins text-[14px] text-gray-600 dark:text-gray-300"><span>{t('tickets.loadError')}</span></p>
            <button type="button" onClick={() => refetch()} className="px-4 py-2 rounded-full bg-[var(--brand-orange-500)] text-white text-[13px] font-semibold">
              <span>{t('tickets.retry')}</span>
            </button>
          </div>
        ) : (
          <>
            {/* Fond blanc forcé : contraste maximal pour le scanner */}
            <div className={`p-4 bg-white rounded-2xl border border-gray-200 ${data.checkedInAt ? 'opacity-40' : ''}`}>
              <QRCodeSVG value={data.qrPayload} size={232} level="M" marginSize={2} title={t('tickets.qrAlt')} />
            </div>

            {data.checkedInAt ? (
              <div className="w-full flex items-center gap-2 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3" role="status">
                <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
                <p className="font-poppins text-[13px] font-semibold text-green-800 dark:text-green-300">
                  <span>{t('tickets.alreadyUsedOn', { date: fmt(data.checkedInAt, { day: 'numeric', month: 'long' }), time: fmt(data.checkedInAt, { hour: '2-digit', minute: '2-digit' }) })}</span>
                </p>
              </div>
            ) : (
              <p className="font-poppins text-[13px] text-gray-600 dark:text-gray-300 text-center">
                <span>{t('tickets.showAtEntrance')}</span>
              </p>
            )}

            <div className="w-full flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-white/5 px-4 py-3">
              <span className="font-poppins text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                {user?.profile?.displayName}
              </span>
              <span className="font-mono text-[13px] tracking-widest text-gray-500 dark:text-gray-400">{data.bookingRef}</span>
            </div>
            <p className="font-poppins text-[11px] text-gray-500 dark:text-gray-400 text-center">
              <span>{t('tickets.singleUse')}</span>
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
