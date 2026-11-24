import { Capacitor } from '@capacitor/core'
import type { OneSignalPlugin } from 'onesignal-cordova-plugin'

/**
 * OneSignal (push natif Android / iOS).
 * - Actif uniquement dans l'app native Capacitor (no-op sur le web).
 * - L'utilisateur Let's Out est lié via `OneSignal.login(userId)` → alias `external_id`,
 *   que le serveur cible (push.service.ts → sendOneSignalPush).
 * - Le SDK est chargé à la demande pour ne pas alourdir le bundle web.
 * L'App ID est un identifiant public (la clé REST, elle, reste exclusivement côté serveur).
 */
const ONESIGNAL_APP_ID = (import.meta.env.VITE_ONESIGNAL_APP_ID as string | undefined)
  || '14cb6201-b51e-4d53-a3b5-bb3e7e479fb4'

let sdkPromise: Promise<OneSignalPlugin | null> | null = null
let clickHandler: ((data: Record<string, any>) => void) | null = null
let pendingClick: Record<string, any> | null = null
/** Utilisateur à lier dès que le SDK est prêt (login appelé avant la fin de l'init). */
let pendingUserId: string | null = null

function isNative(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

/** Initialise OneSignal une seule fois (idempotent). Retourne le SDK, ou null hors natif / en cas d'échec. */
export function initOneSignal(): Promise<OneSignalPlugin | null> {
  if (!isNative()) return Promise.resolve(null)
  if (sdkPromise) return sdkPromise

  sdkPromise = import('onesignal-cordova-plugin')
    .then(({ default: OneSignal }) => {
      OneSignal.initialize(ONESIGNAL_APP_ID)

      // Tap sur une notification OneSignal → même routage que les push FCM.
      OneSignal.Notifications.addEventListener('click', (event) => {
        const data = (event?.notification?.additionalData ?? {}) as Record<string, any>
        // App lancée par le tap : le routeur n'est peut-être pas encore monté → rejoué à l'enregistrement.
        if (!clickHandler) { pendingClick = data; return }
        try { clickHandler(data) } catch (e) { console.error('[OneSignal] click handler error:', e) }
      })

      // Demande la permission (fallbackToSettings = true : renvoie vers les réglages si refusée auparavant).
      OneSignal.Notifications.requestPermission(true).catch(() => {})

      if (pendingUserId) {
        OneSignal.login(pendingUserId)
        pendingUserId = null
      }
      return OneSignal
    })
    .catch((e) => {
      console.warn('[OneSignal] init failed:', e?.message ?? e)
      return null
    })

  return sdkPromise
}

/** Lie l'appareil à l'utilisateur Let's Out (alias external_id). */
export function setOneSignalUser(userId: string): void {
  if (!isNative() || !userId) return
  if (!sdkPromise) { pendingUserId = userId; return }
  sdkPromise.then((OneSignal) => {
    if (!OneSignal) return
    try { OneSignal.login(userId) } catch (e) { console.warn('[OneSignal] login failed:', e) }
  })
}

/** Délie l'appareil de l'utilisateur (déconnexion) : il ne recevra plus ses notifications. */
export function clearOneSignalUser(): void {
  pendingUserId = null
  if (!isNative() || !sdkPromise) return
  sdkPromise.then((OneSignal) => {
    if (!OneSignal) return
    try { OneSignal.logout() } catch (e) { console.warn('[OneSignal] logout failed:', e) }
  })
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
