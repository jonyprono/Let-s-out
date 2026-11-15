import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, RefreshCw } from 'lucide-react'
import { pagesApi } from '../api'

/**
 * Statistiques d'une page (créateur) : tuiles de chiffres + nouveaux abonnés par jour (30 j).
 *
 * Graphique : une seule série → une seule couleur, pas de légende (le titre la nomme).
 * #E06C00 = orange de marque validé (scripts/validate_palette.js) sur fond clair ET sombre ;
 * #FF7A00 échouait en sombre (trop clair) et sous 3:1 en clair. Barres fines, 2 px d'écart,
 * coins arrondis côté données, ancrées à la ligne de base ; valeur du jour au toucher ;
 * tableau équivalent pour les lecteurs d'écran.
 */
const BAR_COLOR = '#E06C00'

export function PageStatsPanel({ pageId }: { pageId: string }) {
  const { t, i18n } = useTranslation()
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pages', pageId, 'stats'],
    queryFn: () => pagesApi.getStats(pageId),
  })
  const [selected, setSelected] = useState<number | null>(null)

  const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language || 'fr', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
  const nf = new Intl.NumberFormat(i18n.language || 'fr')

  const timeline = data?.followersTimeline ?? []
  const max = useMemo(() => Math.max(0, ...timeline.map((d) => d.count)), [timeline])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" aria-hidden="true" />
        <span className="sr-only">{t('myPages.loading')}</span>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-[14px] text-[var(--color-text-muted)]"><span>{t('myPages.statsError')}</span></p>
        <button type="button" onClick={() => refetch()} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF7A00] text-white text-[13px] font-semibold">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /><span>{t('myPages.retry')}</span>
        </button>
      </div>
    )
  }

  const tiles = [
    { label: t('myPages.followers'), value: data.followersCount },
    { label: t('myPages.posts'), value: data.postsCount },
    { label: t('myPages.comments'), value: data.commentsCount },
    { label: t('myPages.new7d'), value: data.newFollowers7d, delta: true },
    { label: t('myPages.new30d'), value: data.newFollowers30d, delta: true },
  ]
  const active = selected !== null ? timeline[selected] : null
  const CHART_H = 120

  return (
    <div className="flex flex-col gap-5">
      {/* Tuiles — le texte reste en encre neutre, jamais dans la couleur de la série */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {tiles.map((tile, i) => (
          <div key={tile.label} className={`rounded-2xl bg-[var(--color-background-secondary)] p-3.5 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
            <p className="text-[12px] text-[var(--color-text-muted)]"><span>{tile.label}</span></p>
            <p className="text-[22px] font-bold text-[var(--color-text-primary)] tabular-nums">
              <span>{tile.delta && tile.value > 0 ? `+${nf.format(tile.value)}` : nf.format(tile.value)}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Nouveaux abonnés par jour */}
      <section className="rounded-2xl bg-[var(--color-background-secondary)] p-4" aria-labelledby="page-stats-chart-title">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 id="page-stats-chart-title" className="text-[14px] font-semibold text-[var(--color-text-primary)]">
            <span>{t('myPages.chartTitle')}</span>
          </h3>
          {/* Valeur du jour touché (ou total 30 j) — lisible même si la barre est fine */}
          <p className="text-[12px] text-[var(--color-text-muted)] tabular-nums" aria-live="polite">
            <span>
              {active
                ? t('myPages.dayValue', { count: active.count, date: fmtDay(active.date, { day: 'numeric', month: 'short' }) })
                : t('myPages.periodTotal', { count: data.newFollowers30d })}
            </span>
          </p>
        </div>

        {max === 0 ? (
          <p className="text-[13px] text-[var(--color-text-muted)] py-8 text-center"><span>{t('myPages.noNewFollowers')}</span></p>
        ) : (
          <>
            <div className="relative" aria-hidden="true">
              {/* Repère recessif : valeur max en haut, ligne de base */}
              <span className="absolute -top-1 right-0 text-[10px] text-[var(--color-text-muted)] tabular-nums">{nf.format(max)}</span>
              <div className="flex items-end gap-[2px] border-b border-[var(--border-default)]" style={{ height: CHART_H }}>
                {timeline.map((d, i) => {
                  const h = d.count === 0 ? 0 : Math.max(4, Math.round((d.count / max) * (CHART_H - 14)))
                  const isSel = selected === i
                  return (
                    <button
                      key={d.date}
                      type="button"
                      tabIndex={-1}
                      onClick={() => setSelected(isSel ? null : i)}
                      onMouseEnter={() => setSelected(i)}
                      onMouseLeave={() => setSelected(null)}
                      // Zone de toucher = toute la colonne (plus grande que la barre)
                      className="flex-1 h-full flex items-end justify-center min-w-0 p-0 !min-h-0 !min-w-0"
                    >
                      <span
                        className="w-full rounded-t-[4px] transition-opacity"
                        style={{ height: h, background: BAR_COLOR, opacity: selected === null || isSel ? 1 : 0.45 }}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                <span>{timeline[0] && fmtDay(timeline[0].date, { day: 'numeric', month: 'short' })}</span>
                <span>{timeline.at(-1) && fmtDay(timeline.at(-1)!.date, { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>

            {/* Équivalent texte (lecteurs d'écran) : jours avec au moins un nouvel abonné */}
            <table className="sr-only">
              <caption>{t('myPages.chartTitle')}</caption>
              <thead><tr><th scope="col">{t('myPages.date')}</th><th scope="col">{t('myPages.newFollowersCol')}</th></tr></thead>
              <tbody>
                {timeline.filter((d) => d.count > 0).map((d) => (
                  <tr key={d.date}><td>{fmtDay(d.date, { day: 'numeric', month: 'long' })}</td><td>{d.count}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  )
}
