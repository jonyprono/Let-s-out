import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    // Mobile: fills full dynamic viewport height
    // Desktop (lg+): centered phone-frame card
    <div
      className="w-full h-full lg:bg-[#F2F2F7] lg:flex lg:items-center lg:justify-center overflow-hidden"
      style={{ height: '100dvh' }}
    >
      <div
        className="force-light w-full h-full lg:max-w-[430px] lg:max-h-[932px] bg-white text-black relative flex flex-col lg:shadow-2xl lg:rounded-[40px] overflow-hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <Outlet />
      </div>
    </div>
  )
}
