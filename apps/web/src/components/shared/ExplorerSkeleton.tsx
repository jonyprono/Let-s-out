import { useTranslation } from 'react-i18next'

/**
 * Squelette d'Explorer affiché PENDANT le chargement des événements, à la place de
 * « Aucun résultat ». Mêmes dimensions que SquareEventCard (« En vedette ») et
 * RowEventCard (« Près de vous ») pour éviter tout saut de mise en page à l'arrivée des données.
 */
export function ExplorerSkeleton({ rows = 3, showFeatured = true }: { rows?: number; showFeatured?: boolean }) {
  const { t } = useTranslation()
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{t('explorer.loading')}</span>

      {showFeatured && (
        <div className="mb-3 -mx-4" aria-hidden="true">
          <div className="px-4 mb-3">
            <div className="h-6 w-32 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="flex gap-3 overflow-hidden px-4 pb-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="shrink-0 rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse"
                style={{ width: 'clamp(145px, 40vw, 175px)', height: 'clamp(155px, 21vh, 190px)' }}
              />
            ))}
          </div>
        </div>
      )}

      <div aria-hidden="true">
        <div className="mb-3 h-6 w-48 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <div
              key={i}
              className="flex w-full min-h-[190px] bg-white dark:bg-[#1A1A1A] rounded-[24px] overflow-hidden border border-gray-100 dark:border-white/5 animate-pulse"
            >
              <div className="w-[43%] shrink-0 bg-gray-200 dark:bg-gray-700 rounded-[20px]" />
              <div className="flex-1 p-4 space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-2/3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
