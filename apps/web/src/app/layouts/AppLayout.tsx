import { Outlet, useLocation } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const location = useLocation()
  const isChatDetails = location.pathname.startsWith('/chat/')
  const isEventDetails = location.pathname.startsWith('/events/') && location.pathname !== '/events/create'
  const isCreateEvent = location.pathname === '/events/create'
  const isSettingsOrProfile = location.pathname === '/settings' || location.pathname === '/verify-profile'
  
  const hideBottomNav = isChatDetails || isEventDetails || isCreateEvent || isSettingsOrProfile

  return (
    <div
      id="app-layout-wrapper"
      className="h-screen w-full bg-gray-100 flex items-center justify-center overflow-hidden"
    >
      <div
        id="app-layout-inner"
        className="w-full h-full sm:max-w-[430px] sm:h-screen sm:max-h-[932px] bg-white overflow-hidden relative flex flex-col shadow-2xl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Offline indicator — shown at the very top when no network */}
        <OfflineBanner />
        <main className={cn(
          "flex-1 flex flex-col overflow-hidden relative",
          !hideBottomNav && "pb-[calc(64px+env(safe-area-inset-bottom))]"
        )}>
          <Outlet />
        </main>
        {!hideBottomNav && <BottomNav />}
      </div>
    </div>
  )
}

