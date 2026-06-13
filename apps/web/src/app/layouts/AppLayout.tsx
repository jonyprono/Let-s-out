import { Outlet, useLocation } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { OfflineBanner } from '@/components/shared/OfflineBanner'


export function AppLayout() {
  const location = useLocation()
  const isChatDetails = location.pathname.startsWith('/chat/')
  const isEventDetails = location.pathname.startsWith('/events/') && location.pathname !== '/events/create'
  const isCreateEvent = location.pathname === '/events/create'
  
  const hideBottomNav =
    isChatDetails ||
    isEventDetails ||
    isCreateEvent ||
    location.pathname === '/verify-profile' ||
    location.pathname.endsWith('/pay')

  return (
    <div id="app-layout-wrapper" className="h-[100dvh] w-full bg-gray-100 dark:bg-black flex items-center justify-center overflow-hidden">
      <div id="app-layout-inner" className="w-full h-full sm:max-w-[430px] sm:h-[100dvh] sm:max-h-[932px] bg-background text-foreground overflow-hidden relative flex flex-col shadow-2xl transition-colors">
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
