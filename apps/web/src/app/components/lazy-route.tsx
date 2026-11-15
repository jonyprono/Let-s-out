import { lazy, Suspense, type ComponentType } from 'react'
import { PageLoader } from './adapters'

/**
 * Écran chargé à la demande : son code n'est téléchargé qu'à la première visite
 * de la route (au lieu d'alourdir le bundle de démarrage). Chaque écran a son propre
 * Suspense : la mise en page parente (barre du bas, menu admin…) reste affichée
 * pendant le chargement.
 */
export function lazyRoute<P extends object>(loader: () => Promise<ComponentType<P>>) {
  const Lazy = lazy(() => loader().then((C) => ({ default: C })))
  function LazyRoute(props: P) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Lazy {...(props as any)} />
      </Suspense>
    )
  }
  return LazyRoute
}
