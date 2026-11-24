/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * Sends real push notifications to mobile devices via Firebase Admin SDK.
 * Falls back gracefully if Firebase is not configured (dev/test environments).
 */

import type { PrismaClient } from '@prisma/client'

let firebaseApp: any = null

export function getFirebaseApp() {
  if (firebaseApp) return firebaseApp

  try {
    const admin = require('firebase-admin')

    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0]
      return firebaseApp
    }

    // Option 1: Full JSON service account (legacy / Fly.io)
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (serviceAccountRaw) {
      const serviceAccount = JSON.parse(serviceAccountRaw)
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('[FCM] ✅ Initialized with FIREBASE_SERVICE_ACCOUNT')
      return firebaseApp
    }

    // Option 2: Individual vars (Render)
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (projectId && clientEmail && privateKey) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Render escapes newlines — restore them
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      })
      console.log('[FCM] ✅ Initialized with FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY')
      return firebaseApp
    }

    console.warn('[FCM] ⚠️ No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY')
    return null
  } catch (e) {
    console.error('[FCM] Failed to initialize Firebase Admin:', e)
    return null
  }
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
  /** Si true : notification d'appel — TTL court, priorité maximale */
  isCall?: boolean
}

/**
 * Send a push notification to a single device token.
 */
export async function sendToToken(token: string, payload: PushPayload): Promise<boolean> {
  const app = getFirebaseApp()
  if (!app) return false

  try {
    const admin = require('firebase-admin')
    const isCall = payload.isCall === true
    const isMessage = payload.data?.type === 'NEW_MESSAGE'

    await admin.messaging(app).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
        icon: '/logoci.svg',
      },
      data: {
        ...(payload.data || {}),
        // Pour les appels en data-only : inclure title/body dans data
        ...(isCall && {
          notifTitle: payload.title,
          notifBody: payload.body,
        }),
      },
      android: {
        // Priorité maximale pour réveiller l'appareil
        priority: 'high',
        // TTL : 30s pour les appels (inutile de livrer un appel vieux de 2 min)
        ttl: isCall ? 30_000 : 3_600_000,
        notification: {
          channelId: isCall ? 'calls' : isMessage ? 'messages' : payload.data?.eventId ? 'events' : 'default',
          clickAction: isMessage ? 'REPLY_ACTION' : undefined,
          sound: isCall ? 'ringtone' : 'default',
          defaultSound: true,
          defaultVibrateTimings: true,
          priority: 'high',
          icon: 'ic_stat_notification',
          color: '#FF7A00',
        },
      },
      apns: {
        headers: {
          // Priorité maximale pour iOS
          'apns-priority': '10',
          // TTL iOS : 30s pour les appels
          ...(isCall && { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 30) }),
        },
        payload: {
          aps: {
            sound: isCall ? 'ringtone.wav' : 'default',
            badge: 1,
            // content-available = 1 pour réveiller l'app en arrière-plan sur iOS
            'content-available': 1,
            category: isMessage ? 'REPLY_ACTION' : undefined,
          },
        },
      },
    })
    return true
  } catch (e: any) {
    // Token expired/invalid — caller should delete it
    if (
      e.code === 'messaging/registration-token-not-registered' ||
      e.code === 'messaging/invalid-registration-token'
    ) {
      return false // signal to delete this token
    }
    console.error('[FCM] Send error:', e.message)
    return false
  }
}

const ONESIGNAL_API_URL = 'https://api.onesignal.com/notifications'
const ONESIGNAL_TIMEOUT_MS = 8_000

/**
 * Envoie une notification via OneSignal à tous les appareils liés à l'utilisateur
 * (alias `external_id` = id Let's Out, posé côté app par `OneSignal.login(userId)`).
 *
 * Retourne true uniquement si OneSignal a accepté la notification pour au moins un
 * abonnement. false si non configuré, aucun appareil abonné, ou erreur → l'appelant
 * se rabat sur FCM (anciennes versions de l'app sans SDK OneSignal).
 */
export async function sendOneSignalPush(userId: string, payload: PushPayload): Promise<boolean> {
  const appId = process.env.ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ONESIGNAL_TIMEOUT_MS)
  try {
    const res = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: 'push',
        include_aliases: { external_id: [userId] },
        headings: { fr: payload.title, en: payload.title },
        contents: { fr: payload.body, en: payload.body },
        data: payload.data || {},
        small_icon: 'ic_stat_notification',
        ...(payload.imageUrl && { large_icon: payload.imageUrl }),
        accent_color: 'FFFF7A00',
        priority: 10,
      }),
      signal: controller.signal,
    })
    const json: any = await res.json().catch(() => null)
    if (!res.ok) {
      console.warn(`[OneSignal] HTTP ${res.status} for user ${userId}:`, JSON.stringify(json?.errors ?? json))
      return false
    }
    // Aucun abonnement pour cet external_id → id vide et/ou errors renseigné.
    if (!json?.id || (json.errors && Object.keys(json.errors).length > 0)) {
      console.log(`[OneSignal] No subscribed device for user ${userId} — falling back to FCM`)
      return false
    }
    console.log(`[OneSignal] ✅ Push accepted for user ${userId} (notification ${json.id})`)
    return true
  } catch (e: any) {
    console.warn(`[OneSignal] Send error for user ${userId}:`, e?.name === 'AbortError' ? 'timeout' : e?.message)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Send a push notification to ALL registered devices of a user.
 * OneSignal en priorité ; si OneSignal n'a livré à aucun appareil, repli sur FCM.
 * Les appels (isCall) restent sur FCM : ils reposent sur des messages data à TTL court
 * traités par l'app (écran d'appel entrant), que OneSignal ne reproduit pas.
 * Automatically cleans up invalid tokens from the database.
 */
export async function sendPushToUser(
  prisma: PrismaClient,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!payload.isCall && await sendOneSignalPush(userId, payload)) return

  const app = getFirebaseApp()
  if (!app) {
    // FCM not configured — silent no-op in dev
    console.warn('[FCM] ⚠️ Firebase not configured — FIREBASE_SERVICE_ACCOUNT env var missing. Push NOT sent.')
    return
  }

  let tokens: { token: string }[] = []
  try {
    tokens = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    })
  } catch (e) {
    console.error('[FCM] Failed to fetch device tokens for user', userId, e)
    return
  }

  console.log(`[FCM] Sending push to user ${userId} — ${tokens.length} device(s) registered`)

  if (tokens.length === 0) {
    console.warn(`[FCM] ⚠️ No device tokens for user ${userId} — notification NOT sent. User must open app and grant permission first.`)
    return
  }

  const invalidTokens: string[] = []
  const errors: string[] = []

  await Promise.allSettled(
    tokens.map(async ({ token }) => {
      console.log(`[FCM] Sending to token: ${token.slice(0, 20)}...`)
      
      const app = getFirebaseApp()
      try {
        const admin = require('firebase-admin')
        await admin.messaging(app).send({
          token,
          notification: { title: payload.title, body: payload.body },
          data: payload.data
        })
        console.log(`[FCM] ✅ Push sent successfully`)
      } catch (e: any) {
        console.warn(`[FCM] ⚠️ Token error: ${e.code || e.message}`)
        errors.push(e.code || e.message)
        invalidTokens.push(token)
      }
    }),
  )

  if (invalidTokens.length > 0) {
    // Clean up invalid tokens without throwing
    try { await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } }) } catch {}
    console.warn(`[FCM] Removed ${invalidTokens.length} invalid token(s) due to errors: ${errors.join(', ')}`)
  }

  // Clean up stale tokens
  if (invalidTokens.length > 0) {
    try {
      await prisma.deviceToken.deleteMany({
        where: { token: { in: invalidTokens } },
      })
    } catch {}
  }
}

/**
 * Send a push notification to MULTIPLE users at once.
 */
export async function sendPushToUsers(
  prisma: PrismaClient,
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  if (userIds.length === 0) return
  await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(prisma, uid, payload)),
  )
}
