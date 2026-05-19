import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <div className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
      <div className="w-full max-w-[430px] h-screen max-h-[932px] bg-white overflow-hidden relative shadow-2xl">
        <Outlet />
      </div>
    </div>
  )
}

