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

          // Trigger registration to get fresh token
          await PushNotifications.register()
        }
      }).catch(() => {})

      // ── 2. FOREGROUND notifications — show as local notification ─────────
      // On Android, push notifications are silent when the app is in foreground.
      // We must display them manually.
      PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        const data = notification.data || {}
        // Don't show calls as local notifications — CallOverlay handles them
        if (data.type === 'INCOMING_CALL') return

        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Math.random() * 100000),
              title: notification.title || "Let's Out",
              body: notification.body || '',
              extra: data,
              smallIcon: 'ic_launcher',
              actionTypeId: data.type === 'NEW_MESSAGE' ? 'REPLY_ACTION' : undefined,
            },
          ],
        }).catch(() => {})
      })

      // Configuration des Actions Locales (Pour la réponse rapide type WhatsApp)
      const actionTypes = {
        types: [
          {
            id: 'REPLY_ACTION',
            actions: [
              {
                id: 'reply',
                title: 'Répondre',
                input: true,
                inputPlaceholder: 'Votre message...'
              }
            ]
          }
        ]
      };
      
      LocalNotifications.registerActionTypes(actionTypes).catch(() => {});

      // Écoute des actions de notifications locales
      LocalNotifications.addListener('localNotificationActionPerformed', async (notificationAction) => {
        const data = notificationAction.notification.extra || {};
        
        // Si l'utilisateur a utilisé le bouton "Répondre"
        if (notificationAction.actionId === 'reply' && notificationAction.inputValue) {
           const conversationId = data.conversationId;
           if (conversationId) {
             try {
               await chatApi.sendMessage(
                 conversationId, 
                 notificationAction.inputValue,
                 'TEXT'
               );
               console.log('[LocalNotifications] Reply sent seamlessly!');
             } catch (e) {
               console.error('[LocalNotifications] Failed to send reply:', e);
             }
           }
           return;
        }

        // Sinon, routage classique comme pour les pushs
        handleNotificationRouting(data);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', async (notificationAction: any) => {
        const data = notificationAction.notification?.data || notificationAction.data || {}
        
        // Si l'utilisateur a utilisé le bouton "Répondre" depuis le Push en background
        if (notificationAction.actionId === 'reply' && notificationAction.inputValue) {
           const conversationId = data.conversationId;
           if (conversationId) {
             try {
               await chatApi.sendMessage(
                 conversationId, 
                 notificationAction.inputValue,
                 'TEXT'
               );
               console.log('[PushNotifications] Reply sent seamlessly from background!');
             } catch (e) {
               console.error('[PushNotifications] Failed to send reply:', e);
             }
           }
           return;
        }

        handleNotificationRouting(data);
      });

      const handleNotificationRouting = (data: any) => {

        // ── INCOMING CALL (background) ───────────────────────────────────
        if (data?.type === 'INCOMING_CALL') {
          // The WebSocket may have already relayed the offer if the app was alive.
          // In all cases, dispatch the call_offer event so the CallOverlay can show.
          // If the WS had already delivered it, this is a no-op (the overlay is already shown).
          try {
            const offer = data.offer ? JSON.parse(data.offer) : null
            window.dispatchEvent(new CustomEvent('ws:webrtc', {
              detail: {
                type: 'call_offer',
                conversationId: data.conversationId,
                callerId: data.callerId,
                // ⚠️ userId est requis par useWebRTC pour identifier l'appelant (data.userId)
                userId: data.callerId,
                mediaType: data.mediaType || 'audio',
                offer,
                callerName: data.callerName || '',
                callerAvatar: data.callerAvatar || '',
                // If no offer available (app was killed before WS sent it),
                // we mark it as a "push-only" call — the WS reconnection will retry
                pushOnly: !offer,
              }
            }))
          } catch (e) {
            console.error('[Push] Failed to parse incoming call:', e)
          }
          return
        }

        // ── NEW MESSAGE → open specific chat ────────────────────────────
        if (data?.type === 'NEW_MESSAGE') {
          if (data?.conversationId) {
            navigate(`/chat/${data.conversationId}`)
          } else {
            navigate('/messages')
          }
          return
        }

        // ── EVENT deep link ──────────────────────────────────────────────
        if (data?.eventId) {
          navigate(`/events/${data.eventId}`)
          return
        }

        // ── PAYMENT deep link ────────────────────────────────────────────
        if (data?.bookingId) {
          navigate(`/payments/${data.bookingId}`)
          return
        }

        // ── FRIEND REQUEST ───────────────────────────────────────────────
        if (data?.type === 'FRIEND_REQUEST') {
          navigate('/friend-requests')
          return
        }
      }
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  return null
}
