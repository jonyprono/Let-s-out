import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    // Mobile: fills full dynamic viewport height, no scroll
    // Desktop (sm+): centered phone-frame card
    <div
      className="w-full sm:bg-[#F2F2F7] sm:flex sm:items-center sm:justify-center overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      <div
        className="w-full sm:max-w-[430px] sm:max-h-[932px] bg-background overflow-hidden relative flex flex-col sm:shadow-2xl sm:rounded-[40px] transition-colors"
        style={{
          height: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
