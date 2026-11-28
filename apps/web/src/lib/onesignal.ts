import { Capacitor } from '@capacitor/core'
import type { OneSignalPlugin } from '@onesignal/capacitor-plugin'
import { isConversationOpen } from './active-conversation'

/**
 * OneSignal (push natif Android / iOS) — plugin Capacitor officiel @onesignal/capacitor-plugin.
 * - Actif uniquement dans l'app native ; no-op sur le web.
 * - Rétrocompatible : si le binaire installé (APK / build iOS) n'embarque pas encore le plugin
 *   natif, rien n'est chargé ni appelé (aucune erreur, l'app démarre normalement).
 * - L'utilisateur Let's Out est lié via `OneSignal.login(userId)` → alias `external_id`,
 *   que le serveur cible (push.service.ts → sendOneSignalPush).
 * L'App ID est un identifiant public (la clé REST, elle, reste exclusivement côté serveur).
 */
const ONESIGNAL_APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined)
  || '14cb6201-b51e-4d53-a3b5-bb3e7e479fb4'

/** Nom d'enregistrement natif du plugin (@CapacitorPlugin(name = "OneSignalCapacitor") / jsName iOS). */
const NATIVE_PLUGIN_NAME = 'OneSignalCapacitor'

let sdkPromise: Promise<OneSignalPlugin | null> | null = null
let clickHandler: ((data: Record<string, any>) => void) | null = null
let pendingClick: Record<string, any> | null = null
/** Utilisateur à lier dès que le SDK est prêt (login appelé avant la fin de l'init). */
let pendingUserId: string | null = null

/** true seulement dans l'app native ET si le binaire contient le plugin OneSignal. */
function isOneSignalAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(NATIVE_PLUGIN_NAME)
  } catch {
    return false
  }
}

/** Initialise OneSignal une seule fois (idempotent). Ne lève jamais : retourne le SDK, ou null. */
export function initOneSignal(): Promise<OneSignalPlugin | null> {
  if (sdkPromise) return sdkPromise
  if (!isOneSignalAvailable()) {
    try {
      if (Capacitor.isNativePlatform()) console.warn('[OneSignal] Plugin not available on this binary build. Skipping.')
    } catch { /* ignore */ }
    return Promise.resolve(null)
  }

  sdkPromise = (async () => {
    try {
      const { default: OneSignal } = await import('@onesignal/capacitor-plugin')
      await OneSignal.initialize(ONESIGNAL_APP_ID)

      // Tap sur une notification OneSignal → même routage que les push FCM.
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = (event?.notification?.additionalData ?? {}) as Record<string, any>
        // App lancée par le tap : le routeur n'est peut-être pas encore monté → rejoué à l'enregistrement.
        if (!clickHandler) { pendingClick = data; return }
        try { clickHandler(data) } catch (e) { console.error('[OneSignal] click handler error:', e) }
      })

      // Premier plan : OneSignal affiche la notification par défaut → masquée pour un message
      // de la discussion déjà ouverte à l'écran (le message apparaît directement dans le fil).
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event) => {
        try {
          const data = (event.getNotification()?.additionalData ?? {}) as Record<string, any>
          if (data.type === 'NEW_MESSAGE' && isConversationOpen(data.conversationId)) event.preventDefault()
        } catch (e) { console.warn('[OneSignal] foregroundWillDisplay error:', e) }
      })

      // Demande la permission (true : renvoie vers les réglages si refusée auparavant). Non bloquant.
      OneSignal.Notifications.requestPermission(true).catch(() => {})

      if (pendingUserId) {
        const userId = pendingUserId
        pendingUserId = null
        await OneSignal.login(userId).catch((e) => console.warn('[OneSignal] login failed:', e))
      }
      return OneSignal
    } catch (e: any) {
      console.warn('[OneSignal] Init non-fatal failure:', e?.message ?? e)
      return null
    }
  })()

  return sdkPromise
}

/** Lie l'appareil à l'utilisateur Let's Out (alias external_id). */
export function setOneSignalUser(userId: string): void {
  if (!userId || !isOneSignalAvailable()) return
  if (!sdkPromise) { pendingUserId = userId; return }
  sdkPromise.then((OneSignal) => {
    OneSignal?.login(userId).catch((e) => console.warn('[OneSignal] login failed:', e))
  }).catch(() => {})
}

/** Délie l'appareil de l'utilisateur (déconnexion) : il ne recevra plus ses notifications. */
export function clearOneSignalUser(): void {
  pendingUserId = null
  if (!sdkPromise) return
  sdkPromise.then((OneSignal) => {
    OneSignal?.logout().catch((e) => console.warn('[OneSignal] logout failed:', e))
  }).catch(() => {})
}

/** Enregistre la fonction de navigation appelée au tap sur une notification OneSignal. */
export function setOneSignalClickHandler(handler: (data: Record<string, any>) => void): void {
  clickHandler = handler
  if (pendingClick) {
    const data = pendingClick
    pendingClick = null
    try { handler(data) } catch (e) { console.error('[OneSignal] click handler error:', e) }
  }
}
