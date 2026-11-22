import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Calendar, MapPin } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { SafeImage } from '@/components/shared/SafeImage'
import { LiveBadge } from '@/components/ui/LiveBadge'
import { isEventLive } from '@/lib/event-status'
import { currentLang, dateLocale } from '@/lib/locale'

export type UpcomingEventRole = 'organizer' | 'cohost' | 'participant'

export interface UpcomingEventItem {
  event: any
  role: UpcomingEventRole
}

/**
 * Liste complète des prochains événements d'un profil (« Voir tout ») : événements organisés,
 * co-organisés ou rejoints (participation confirmée), à venir ou en cours, du plus proche au plus lointain.
 */
export function UpcomingEventsSheet({
  open, onClose, items, onOpenEvent,
}: {
  open: boolean
  onClose: () => void
  items: UpcomingEventItem[]
  onOpenEvent: (eventId: string) => void
}) {
  const { t } = useTranslation()

  const fmtDate = (d: string) => {
    try {
      return format(new Date(d), currentLang() === 'fr' ? "EEE d MMM yyyy, HH'h'mm" : 'EEE d MMM yyyy, p', { locale: dateLocale() })
    } catch {
      return ''
    }
  }

  const roleStyle: Record<UpcomingEventRole, string> = {
    organizer: 'bg-[#FFF3E6] text-[#FF7A00] dark:bg-[#FF7A00]/15',
    cohost: 'bg-[#FFF3E6] text-[#FF7A00] dark:bg-[#FF7A00]/15',
    participant: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('profileV2.upcomingSheetTitle', { count: items.length })}>
      {items.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-gray-500"><span>{t('profileV2.upcomingEmpty')}</span></p>
      ) : (
        <ul className="flex flex-col gap-3 pb-2">
          {items.map(({ event, role }) => {
            const place = [event.city, event.address].filter(Boolean)[0]
            return (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(event.id)}
                  className="w-full flex gap-3 items-stretch text-left p-2.5 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#1A1A1A] active:scale-[0.99] transition-transform"
                >
                  <SafeImage
                    src={event.coverUrl ?? undefined}
                    alt=""
                    className="w-[72px] h-[72px] shrink-0 rounded-xl object-cover"
                    fallback={<div className="w-[72px] h-[72px] shrink-0 rounded-xl bg-gray-200 dark:bg-gray-800" />}
                  />
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isEventLive(event) && <LiveBadge size="sm" />}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${roleStyle[role]}`}>
                        <span>{t(`profileV2.upcomingRole.${role}`)}</span>
                      </span>
                    </div>
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                      <span>{event.title}</span>
                    </p>
                    <p className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-[#FF7A00]" aria-hidden="true" />
                      <span className="truncate capitalize">{fmtDate(event.startAt)}</span>
                    </p>
                    {place && (
                      <p className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#FF7A00]" aria-hidden="true" />
                        <span className="truncate">{place}</span>
                      </p>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </BottomSheet>
  )
}
