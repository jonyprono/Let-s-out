import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    // On mobile: fills 100% screen height, no margin/centering
    // On desktop (sm+): centered card like a phone frame
    <div className="h-screen w-full sm:bg-[#F2F2F7] sm:flex sm:items-center sm:justify-center overflow-hidden">
      <div
        className="w-full h-full sm:max-w-[430px] sm:h-screen sm:max-h-[932px] bg-background overflow-hidden relative flex flex-col sm:shadow-2xl sm:rounded-[40px] transition-colors"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Outlet />
      </div>
    </div>
  )
}
