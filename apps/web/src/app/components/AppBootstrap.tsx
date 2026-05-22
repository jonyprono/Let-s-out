import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useSettingsStore } from '@/stores/settings.store'
import { isOnline } from '@/lib/offline'

/**
 * AppBootstrap — mounted at root level.
 * On every app load, if we have an access token we silently re-fetch
 * the current user so profile data stays fresh.
 * 
 * If the device is offline, we skip the network call entirely and
 * use the cached user data from the auth store (persisted in localStorage).
 */
import { useNavigate } from 'react-router'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

export function AppBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken)
  const isLoggingOut = useAuthStore((s) => s.isLoggingOut)
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const navigate = useNavigate()

  useEffect(() => {
    // Initialize language from persisted store
    const language = useSettingsStore.getState().language;
    if (language) {
      import('@/lib/i18n').then(({ default: i18n }) => {
        i18n.changeLanguage(language);
      });
    }

    if (accessToken && !isLoggingOut && isOnline()) {
      // Fire-and-forget: don't block the UI if this fails
      refreshUser().catch(() => {
        console.warn('[AppBootstrap] Could not refresh user — using cached data')
      })
    }

    // Capacitor Push Notification deep linking
    if (Capacitor.isNativePlatform()) {
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: any) => {
        const data = notification.notification.data
        if (data?.eventId) {
          navigate(`/events/${data.eventId}`)
        } else if (data?.bookingId) {
          navigate(`/payments/${data.bookingId}`)
        } else if (data?.type === 'FRIEND_REQUEST') {
          navigate('/friend-requests')
        } else if (data?.type === 'NEW_MESSAGE') {
          navigate('/messages')
        }
      })
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  return null
}
