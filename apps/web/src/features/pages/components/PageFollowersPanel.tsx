import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, Users } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'
import { pagesApi } from '../api'

/** Liste des abonnés d'une page (créateur), du plus récent au plus ancien, paginée. */
export function PageFollowersPanel({ pageId, total }: { pageId: string; total?: number }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const q = useInfiniteQuery({
    queryKey: ['pages', pageId, 'followers'],
    queryFn: ({ pageParam }) => pagesApi.getFollowers(pageId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })

  const fmt = new Intl.DateTimeFormat(i18n.language || 'fr', { day: 'numeric', month: 'short', year: 'numeric' })
  const followers = q.data?.pages.flatMap((p) => p.data) ?? []

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" aria-hidden="true" />
        <span className="sr-only">{t('myPages.loading')}</span>
      </div>
    )
  }
  if (q.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-[14px] text-[var(--color-text-muted)]"><span>{t('myPages.followersError')}</span></p>
        <button type="button" onClick={() => q.refetch()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF7A00] text-white text-[13px] font-semibold">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.retry')}</span>
        </button>
      </div>
    )
  }
  if (followers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-green-500" aria-hidden="true" />
        </div>
        <h3 className="text-[17px] font-bold text-[var(--color-text-primary)] mb-1"><span>{t('myPages.noFollowersTitle')}</span></h3>
        <p className="text-[14px] text-[var(--color-text-muted)] max-w-xs"><span>{t('myPages.noFollowersDesc')}</span></p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {typeof total === 'number' && (
        <p className="text-[13px] text-[var(--color-text-muted)]"><span>{t('myPages.followersCount', { count: total, formatted: new Intl.NumberFormat(i18n.language || 'fr').format(total) })}</span></p>
      )}
      <ul className="rounded-2xl bg-[var(--color-background-secondary)] divide-y divide-[var(--border-tertiary)] overflow-hidden">
        {followers.map((f) => {
          const content = (
            <>
              {f.avatarUrl ? (
                <SafeImage src={f.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#FF7A00]/15 text-[#E06C00] font-bold flex items-center justify-center shrink-0">
                  <span>{(f.displayName || f.username || '?').charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate"><span>{f.displayName}</span></p>
                {f.username && <p className="text-[12px] text-[var(--color-text-muted)] truncate"><span>{`@${f.username}`}</span></p>}
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] shrink-0 text-right">
                <span>{t('myPages.followedOn', { date: fmt.format(new Date(f.followedAt)) })}</span>
              </p>
            </>
          )
          return (
            <li key={f.userId}>
              {f.username ? (
                <button type="button" onClick={() => navigate(`/profile/${f.username}`)} className="w-full flex items-center gap-3 px-4 py-3 active:bg-black/5 dark:active:bg-white/5">
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
      {q.hasNextPage && (
        <button
          type="button"
          onClick={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="self-center flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border-default)] text-[13px] font-semibold text-[var(--color-text-primary)] disabled:opacity-60"
        >
          {q.isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          <span>{t('myPages.loadMore')}</span>
        </button>
      )}
    </div>
  )
}
