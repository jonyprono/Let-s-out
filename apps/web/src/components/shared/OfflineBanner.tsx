import { WifiOff } from 'lucide-react'
import { useIsOnline } from '@/hooks/useIsOnline'

/**
 * Displays a subtle offline banner at the top of the screen
 * when the device has no internet connection.
 */
export function OfflineBanner() {
  const online = useIsOnline()

  if (online) return null

  return (
    <div
      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white"
      style={{ background: 'linear-gradient(90deg, #FF6B6B, #FF9F1C)', zIndex: 100 }}
    >
      <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
      <span>Hors ligne — données affichées depuis le cache</span>
    </div>
  )
}
