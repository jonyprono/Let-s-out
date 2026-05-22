import { Navigate } from 'react-router'
import { useAuthStore } from '@/stores/auth.store'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.accessToken)
  const role = useAuthStore(s => s.user?.role)

  if (!token) return <Navigate to="/login" replace />
  if (role !== 'ADMIN') return <Navigate to="/home" replace />

  return <>{children}</>
}
