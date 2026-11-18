import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { requestScrollToTop } from '@/lib/scroll-to-top'
import { BottomNav } from '@/components/shared/BottomNav'
import { OfflineBanner } from '@/components/shared/OfflineBanner'

export function AppLayout() {
  const location = useLocation()
  const isChatDetails = location.pathname.startsWith('/chat/')
  const isEventDetails = location.pathname.startsWith('/events/') && location.pathname !== '/events/create'
  const isCreateEvent = location.pathname === '/events/create'
  const isSearchScreen = location.search.includes('screen=search')

  // iOS : appui sur la barre d'état / l'encoche → retour en haut. Le défilement natif de WKWebView
  // ne s'applique pas (la page ne défile pas, ce sont des conteneurs internes) ; @capacitor/status-bar
  // relaie l'appui en événement `statusTap` sur window. Jamais émis sur Android ni sur le web.
  useEffect(() => {
    window.addEventListener('statusTap', requestScrollToTop)
    return () => window.removeEventListener('statusTap', requestScrollToTop)
  }, [])

  const hideBottomNav =
    isChatDetails ||
    isEventDetails ||
    isCreateEvent ||
    isSearchScreen ||
    location.pathname === '/verify-profile' ||
    location.pathname === '/notifications' ||
    location.pathname.endsWith('/pay') ||
    location.pathname.startsWith('/pages/')

  return (
    <div
      id="app-layout-wrapper"
      className="h-[100dvh] w-full bg-gray-100 dark:bg-black flex items-center justify-center overflow-hidden"
    >
      {/* lg:will-change-transform : sur grand écran (cadre téléphone de 430 px), garde les écrans
          `fixed` non portalisés DANS le cadre, comme avant. Sur téléphone, plus aucun ancêtre ne
          capture les `fixed` (cause de la fiche commentaires invisible sur iOS). */}
      <div id="app-layout-inner" className="w-full h-full lg:max-w-[430px] lg:h-[100dvh] lg:max-h-[932px] bg-background text-foreground overflow-hidden relative flex flex-col shadow-2xl transition-colors lg:will-change-transform">
        {/* Offline indicator — shown at the very top when no network */}
        <OfflineBanner />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <Outlet />
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </div>
  )
}
