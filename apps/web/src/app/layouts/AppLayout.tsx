import { Outlet, useLocation } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { PendingEvaluationModal } from '@/features/events/components/PendingEvaluationModal'
import { eventsApi } from '@/features/events/api'
import { useEffect, useState } from 'react'


export function AppLayout() {
  const location = useLocation()
  const isChatDetails = location.pathname.startsWith('/chat/')
  const isEventDetails = location.pathname.startsWith('/events/') && location.pathname !== '/events/create'
  const isCreateEvent = location.pathname === '/events/create'
  const isSearchScreen = location.search.includes('screen=search')
  
  const hideBottomNav =
    isChatDetails ||
    isEventDetails ||
    isCreateEvent ||
    isSearchScreen ||
    location.pathname === '/verify-profile' ||
    location.pathname === '/notifications' ||
    location.pathname.endsWith('/pay')

  const [pendingEvent, setPendingEvent] = useState<any>(null)
  
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await eventsApi.getPendingEvaluations()
        if (res.data && res.data.data && res.data.data.length > 0) {
          setPendingEvent(res.data.data[0])
        }
      } catch (e) {
        console.error('Failed to fetch pending evaluations', e)
      }
    }
    // Only check once on mount of AppLayout
    fetchPending()
  }, [])

  return (
    <div
      id="app-layout-wrapper"
      className="h-[100dvh] w-full bg-gray-100 dark:bg-black flex items-center justify-center overflow-hidden"
    >
      <div id="app-layout-inner" className="w-full h-full lg:max-w-[430px] lg:h-[100dvh] lg:max-h-[932px] bg-background text-foreground overflow-hidden relative flex flex-col shadow-2xl transition-colors">
        {/* Offline indicator — shown at the very top when no network */}
        <OfflineBanner />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <Outlet />
        </main>
        {!hideBottomNav && <BottomNav />}
        
        {pendingEvent && (
          <PendingEvaluationModal 
            event={pendingEvent} 
            onClose={() => setPendingEvent(null)}
            onSubmit={() => setPendingEvent(null)}
          />
        )}
      </div>
    </div>
  )
}
