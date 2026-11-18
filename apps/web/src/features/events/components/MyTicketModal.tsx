import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { X, Loader2, CheckCircle2, Share2, Mail } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { toast } from 'sonner'
import { eventsApi } from '@/features/events/api'
import { ticketingApi, ticketingKeys, ticketShareUrl, type MyTicketItem } from '@/features/ticketing/api'
import { useAuthStore } from '@/stores/auth.store'

interface MyTicketModalProps {
  eventId: string
  eventTitle: string
  eventDate?: string | Date
  open: boolean
  onClose: () => void
}

/**
 * « Mes billets » : QR à présenter à l'entrée.
 * - Billetterie multi-tarifs : un billet par place (catégorie + QR individuel + bouton Partager).
 * - Ancien billet (événement gratuit / prix unique) : un QR porté par la réservation.
 * Le QR encode le jeton secret du billet. Fond blanc forcé pour rester lisible par le scanner,
 * même en thème sombre. Rendu dans <body> (portal, cf. iOS).
 */
export function MyTicketModal({ eventId, eventTitle, eventDate, open, onClose }: MyTicketModalProps) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const closeRef = useRef<HTMLButtonElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  // 1) Billets individuels (billetterie). 404 = pas de billetterie pour cette réservation.
  const multi = useQuery({
    queryKey: ticketingKeys.myTickets(eventId),
    queryFn: () => ticketingApi.myTickets(eventId),
    enabled: open,
    staleTime: 30_000,
    retry: (n, err: any) => err?.response?.status !== 404 && n < 2,
  })
  const noIndividualTickets = multi.isError && (multi.error as any)?.response?.status === 404

  // 2) Ancien billet unique — uniquement si la réservation n'a pas de billets individuels
  const single = useQuery({
    queryKey: ['events', eventId, 'my-ticket'],
    queryFn: () => eventsApi.getMyTicket(eventId),
    enabled: open && noIndividualTickets,
    staleTime: 30_000,
  })

  // Renvoi des billets par e-mail (toujours à l'adresse du compte, choisie côté serveur)
  const resendEmail = useMutation({
    mutationFn: () => ticketingApi.resendTicketsEmail(eventId),
    onSuccess: (res) => toast.success(t('tickets.resendEmailSent', { email: res.to })),
    onError: (err: any) => {
      const code = err?.response?.data?.code
      if (code === 'RESEND_COOLDOWN') toast.info(t('tickets.resendEmailCooldown', { seconds: err.response.data.retryAfter ?? 60 }))
      else if (code === 'NO_EMAIL') toast.error(t('tickets.resendEmailNoEmail'))
      else toast.error(t('tickets.resendEmailError'))
    },
  })

  useEffect(() => {
    if (open) { closeRef.current?.focus(); setIndex(0) }
  }, [open])

  if (!open) return null

  const fmt = (d: string | Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language || 'fr', opts).format(new Date(d))

  const tickets = multi.data?.tickets ?? []
  const isLoading = multi.isLoading || (noIndividualTickets && single.isLoading)
  const failed = (multi.isError && !noIndividualTickets) || (noIndividualTickets && (single.isError || (!single.isLoading && !single.data)))

  const share = async (tk: MyTicketItem) => {
    const url = ticketShareUrl(tk.shareToken)
    const text = t('tickets.shareText', { tier: tk.tierName, event: eventTitle })
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: t('tickets.shareTitle'), text, url, dialogTitle: t('tickets.shareTitle') })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: t('tickets.shareTitle'), text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast.success(t('tickets.linkCopied'))
    } catch (err: any) {
      // Partage annulé par l'utilisateur : rien à signaler
      if (err?.name === 'AbortError' || /cancel/i.test(String(err?.message))) return
      try { await navigator.clipboard.writeText(`${text} ${url}`); toast.success(t('tickets.linkCopied')) } catch { toast.error(t('tickets.shareError')) }
    }
  }

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }

  const reload = () => { if (noIndividualTickets) single.refetch(); else multi.refetch() }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-ticket-title"
    >
      <div
        className="w-full sm:max-w-sm max-h-[94dvh] overflow-y-auto bg-white dark:bg-[#1A1A1A] rounded-t-3xl sm:rounded-3xl p-6 flex flex-col items-center gap-4 animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="my-ticket-title" className="font-poppins font-bold text-[18px] text-gray-900 dark:text-white">
              <span>{tickets.length > 1 ? t('tickets.myTickets', { count: tickets.length }) : t('tickets.myTicket')}</span>
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
        ) : failed ? (
          <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-center">
            <p className="font-poppins text-[14px] text-gray-600 dark:text-gray-300"><span>{t('tickets.loadError')}</span></p>
            <button type="button" onClick={reload} className="px-4 py-2 rounded-full bg-[var(--brand-orange-500)] text-white text-[13px] font-semibold">
              <span>{t('tickets.retry')}</span>
            </button>
          </div>
        ) : tickets.length > 0 ? (
          <>
            {/* Un billet par écran, balayage horizontal */}
            <div
              ref={scrollerRef}
              onScroll={onScroll}
              className="w-full flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-1 px-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {tickets.map((tk, i) => (
                <div key={tk.id} className="w-full shrink-0 snap-center flex flex-col items-center gap-3" aria-label={t('tickets.ticketOf', { n: i + 1, total: tickets.length })}>
                  <span className="max-w-full truncate px-4 py-1.5 rounded-full bg-[#FF7A00] text-white font-poppins font-extrabold text-[18px] uppercase tracking-wide">
                    <span>{tk.tierName}</span>
                  </span>
                  <div className={`p-4 bg-white rounded-2xl border border-gray-200 ${tk.checkedInAt ? 'opacity-40' : ''}`}>
                    <QRCodeSVG value={tk.qrPayload} size={224} level="M" marginSize={2} title={t('tickets.qrAlt')} />
                  </div>
                  {tk.checkedInAt ? (
                    <div className="w-full flex items-center gap-2 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-2.5" role="status">
                      <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
                      <p className="font-poppins text-[13px] font-semibold text-green-800 dark:text-green-300">
                        <span>{t('tickets.alreadyUsedOn', { date: fmt(tk.checkedInAt, { day: 'numeric', month: 'long' }), time: fmt(tk.checkedInAt, { hour: '2-digit', minute: '2-digit' }) })}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="font-poppins text-[13px] text-gray-600 dark:text-gray-300 text-center">
                      <span>{t('tickets.showAtEntrance')}</span>
                    </p>
                  )}
                  <div className="w-full flex items-center justify-between rounded-2xl bg-gray-50 dark:bg-white/5 px-4 py-3">
                    <span className="font-poppins text-[13px] text-gray-600 dark:text-gray-300">
                      <span>{t('tickets.ticketOf', { n: i + 1, total: tickets.length })}</span>
                    </span>
                    <span className="font-mono text-[13px] tracking-widest text-gray-500 dark:text-gray-400">{tk.ref}</span>
                  </div>
                  {!tk.checkedInAt && (
                    <button
                      type="button"
                      onClick={() => share(tk)}
                      className="w-full h-11 rounded-full border border-[#FF7A00] text-[#FF7A00] font-poppins font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Share2 className="w-4 h-4" aria-hidden="true" />
                      <span>{t('tickets.share')}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {tickets.length > 1 && (
              <div className="flex gap-1.5" aria-hidden="true">
                {tickets.map((tk, i) => (
                  <span key={tk.id} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-[#FF7A00]' : 'w-1.5 bg-gray-300 dark:bg-white/20'}`} />
                ))}
              </div>
            )}
            <p className="font-poppins text-[11px] text-gray-500 dark:text-gray-400 text-center">
              <span>{tickets.length > 1 ? t('tickets.shareHint') : t('tickets.singleUse')}</span>
            </p>

            {/* Renvoi de TOUS les billets de la commande à l'adresse e-mail du compte */}
            <button
              type="button"
              onClick={() => resendEmail.mutate()}
              disabled={resendEmail.isPending}
              className="w-full h-11 rounded-full bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-100 font-poppins font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
            >
              {resendEmail.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <Mail className="w-4 h-4" aria-hidden="true" />}
              <span>{resendEmail.isPending ? t('tickets.resendEmailSending') : t('tickets.resendEmail')}</span>
            </button>
          </>
        ) : single.data ? (
          <>
            {/* Billet d'accès unique (réservation) : gratuit ou prix d'entrée */}
            {typeof single.data.price === 'number' && (
              <span className="max-w-full truncate px-4 py-1.5 rounded-full bg-[#FF7A00] text-white font-poppins font-extrabold text-[18px] uppercase tracking-wide">
                <span>
                  {single.data.price > 0
                    ? t('tickets.priceAmount', { amount: single.data.price.toLocaleString(i18n.language || 'fr') })
                    : t('tickets.free')}
                </span>
              </span>
            )}
            <div className={`p-4 bg-white rounded-2xl border border-gray-200 ${single.data.checkedInAt ? 'opacity-40' : ''}`}>
              <QRCodeSVG value={single.data.qrPayload} size={232} level="M" marginSize={2} title={t('tickets.qrAlt')} />
            </div>

            {single.data.checkedInAt ? (
              <div className="w-full flex items-center gap-2 rounded-2xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3" role="status">
                <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
                <p className="font-poppins text-[13px] font-semibold text-green-800 dark:text-green-300">
                  <span>{t('tickets.alreadyUsedOn', { date: fmt(single.data.checkedInAt, { day: 'numeric', month: 'long' }), time: fmt(single.data.checkedInAt, { hour: '2-digit', minute: '2-digit' }) })}</span>
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
              <span className="font-mono text-[13px] tracking-widest text-gray-500 dark:text-gray-400">{single.data.bookingRef}</span>
            </div>
            <p className="font-poppins text-[11px] text-gray-500 dark:text-gray-400 text-center">
              <span>{t('tickets.singleUse')}</span>
            </p>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
