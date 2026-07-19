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
import { LocalNotifications } from '@capacitor/local-notifications'
import { chatApi } from '@/features/chat/api'
import { apiClient } from '@/lib/api-client'

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
      // ── 1. RE-REGISTER FCM TOKEN at every launch ─────────────────────────
      // Android can rotate the token — we must always keep the server up to date.
      PushNotifications.checkPermissions().then(async (status) => {
        if (status.receive === 'granted') {
          // Listen for new/refreshed token and save to server
          PushNotifications.addListener('registration', async (token) => {
            console.log('[PushNotifications] Token:', token.value)
            try {
              await apiClient.post('/notifications/device-token', {
                token: token.value,
                platform: Capacitor.getPlatform(),
              })
            } catch (e) {
              console.warn('[PushNotifications] Could not save token:', e)
            }
          })

          // Create the default channel on Android 8+ for background pushes
          if (Capacitor.getPlatform() === 'android') {
            PushNotifications.createChannel({
              id: 'default',
              name: 'Notifications générales',
              description: "Toutes les notifications importantes de Let's Out",
              importance: 5,
              visibility: 1,
            }).catch(() => {})
          }

          // Trigger registration to get fresh token
          await PushNotifications.register()
        }
      }).catch(() => {})

      // ── Helper: navigate based on notification data ────────────────────
      const handleNotificationRouting = (data: any) => {
        if (data?.type === 'INCOMING_CALL') {
          try {
            const offer = data.offer ? JSON.parse(data.offer) : null
            window.dispatchEvent(new CustomEvent('ws:webrtc', {
              detail: {
                type: 'call_offer',
                conversationId: data.conversationId,
                callerId: data.callerId,
                userId: data.callerId,
                mediaType: data.mediaType || 'audio',
                offer,
                callerName: data.callerName || '',
                callerAvatar: data.callerAvatar || '',
                pushOnly: !offer,
              }
            }))
          } catch (e) {
            console.error('[Push] Failed to parse incoming call:', e)
          }
          return
        }

        if (data?.type === 'NEW_MESSAGE') {
          navigate(data?.conversationId ? `/chat/${data.conversationId}` : '/messages')
          return
        }

        if (data?.eventId) { navigate(`/events/${data.eventId}`); return }
        if (data?.bookingId) { navigate(`/payments/${data.bookingId}`); return }
        if (data?.type === 'FRIEND_REQUEST') { navigate('/friend-requests'); return }
      }

      // ── Helper: send a quick reply with auth token refresh fallback ────
      const sendQuickReply = async (conversationId: string, text: string) => {
        let token = useAuthStore.getState().accessToken
        if (!token) {
          try {
            await useAuthStore.getState().refreshUser()
            token = useAuthStore.getState().accessToken
          } catch {
            console.warn('[QuickReply] Could not refresh token')
          }
        }
        if (!token) {
          console.error('[QuickReply] No auth token — aborting')
          return
        }
        await chatApi.sendMessage(conversationId, { content: text, type: 'TEXT' })
        console.log('[QuickReply] Sent to', conversationId)
      }

      // ── 2. Foreground push → show as local notification ────────────────
      PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        const data = notification.data || {}
        if (data.type === 'INCOMING_CALL') return   // CallOverlay handles this

        // Don't show notification for messages sent by the current user
        const currentUserId = useAuthStore.getState().user?.id
        if (data.type === 'NEW_MESSAGE' && data.senderId && data.senderId === currentUserId) return

        // Don't show notification if the user already has that chat open
        if (data.type === 'NEW_MESSAGE' && data.conversationId) {
          const currentPath = window.location.pathname
          if (currentPath === `/chat/${data.conversationId}`) return
        }

        await LocalNotifications.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 100000),
            title: notification.title || "Let's Out",
            body: notification.body || '',
            extra: { ...data },   // spread so Capacitor serialises it correctly
            smallIcon: 'ic_launcher',
            iconColor: '#FF7A00',
            largeIcon: '/logoci.svg',
            actionTypeId: data.type === 'NEW_MESSAGE' ? 'REPLY_ACTION' : undefined,
          }],
        }).catch(() => {})
      })

      // ── 3. Register "Répondre" action type (WhatsApp-style quick reply) ─
      LocalNotifications.registerActionTypes({
        types: [{
          id: 'REPLY_ACTION',
          actions: [{
            id: 'reply',
            title: 'Répondre',
            input: true,
            inputPlaceholder: 'Votre message...',
          }],
        }],
      }).catch(() => {})

      // ── 4. Local notification action (foreground: tap or reply) ─────────
      LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
        const data = action.notification.extra || {}

        if (action.actionId === 'reply') {
          const text = action.inputValue?.trim()
          const conversationId = data.conversationId
          if (conversationId && text) {
            try { await sendQuickReply(conversationId, text) }
            catch (e) { console.error('[LocalNotifications] Quick reply failed:', e) }
          }
          return
        }

        // actionId === 'tap' (or anything else) → open chat/screen
        handleNotificationRouting(data)
      })

      // ── 5. Push notification action (background / killed app) ───────────
      PushNotifications.addListener('pushNotificationActionPerformed', async (action: any) => {
        const data = action.notification?.data || action.data || {}

        if (action.actionId === 'reply') {
          const text = (action.inputValue ?? '').trim()
          const conversationId = data.conversationId
          if (conversationId && text) {
            try { await sendQuickReply(conversationId, text) }
            catch (e) { console.error('[PushNotifications] Quick reply failed:', e) }
          }
          return
        }

        // actionId === 'tap' → open chat/screen
        handleNotificationRouting(data)
      })
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  return null
}
