/**
 * Apple Push Notification service (APNs) — envoi direct aux iPhone.
 *
 * Sur iOS, @capacitor/push-notifications renvoie un jeton APNs (64 caractères hexadécimaux),
 * pas un jeton FCM : Firebase Admin le refuse. Ces jetons sont donc envoyés ici, directement
 * à Apple, via HTTP/2 et une clé d'authentification .p8 (Apple Developer → Keys → APNs).
 *
 * Variables d'environnement :
 *   APNS_KEY_ID     — identifiant de la clé .p8 (10 caractères)
 *   APNS_TEAM_ID    — Team ID Apple Developer
 *   APNS_KEY        — contenu de la clé .p8 (les retours à la ligne peuvent être échappés en \n)
 *   APNS_BUNDLE_ID  — identifiant de l'app iOS (topic APNs)
 *   APNS_PRODUCTION — "false" pour le bac à sable (build Xcode de développement) ; production par défaut
 */

import http2 from 'node:http2'
import crypto from 'node:crypto'
import type { PushPayload } from './push.service'

export type ApnsResult = 'ok' | 'invalid' | 'error' | 'unconfigured'

const APNS_TIMEOUT_MS = 8_000
/** Apple refuse un jeton d'authentification de plus d'une heure : renouvelé toutes les 50 min. */
const JWT_TTL_MS = 50 * 60 * 1000

let cachedJwt: { value: string; createdAt: number } | null = null

/** Un jeton APNs est une chaîne hexadécimale (64 caractères aujourd'hui). Un jeton FCM contient ':'. */
export function isApnsToken(token: string): boolean {
  return /^[0-9a-f]{64,200}$/i.test(token)
}

function getConfig() {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const key = process.env.APNS_KEY
  const bundleId = process.env.APNS_BUNDLE_ID
  if (!keyId || !teamId || !key || !bundleId) return null
  return {
    keyId,
    teamId,
    key: key.replace(/\\n/g, '\n'),
    bundleId,
    host: process.env.APNS_PRODUCTION === 'false' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com',
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function getJwt(cfg: NonNullable<ReturnType<typeof getConfig>>): string {
  if (cachedJwt && Date.now() - cachedJwt.createdAt < JWT_TTL_MS) return cachedJwt.value
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }))
  const claims = base64url(JSON.stringify({ iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }))
  const signingInput = `${header}.${claims}`
  // ES256 au format JOSE (r||s, 64 octets) exigé par Apple.
  const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: cfg.key, dsaEncoding: 'ieee-p1363' })
  const value = `${signingInput}.${base64url(signature)}`
  cachedJwt = { value, createdAt: Date.now() }
  return value
}

export function isApnsConfigured(): boolean {
  return getConfig() !== null
}

/** Envoie une notification à un jeton APNs. 'invalid' = jeton à supprimer (app désinstallée, jeton périmé). */
export async function sendApnsPush(token: string, payload: PushPayload): Promise<ApnsResult> {
  const cfg = getConfig()
  if (!cfg) return 'unconfigured'

  let jwt: string
  try {
    jwt = getJwt(cfg)
  } catch (e: any) {
    console.error('[APNs] Clé APNS_KEY invalide :', e?.message)
    return 'error'
  }

  const isCall = payload.isCall === true
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
      'mutable-content': 1,
      ...(payload.data?.type === 'NEW_MESSAGE' && { category: 'REPLY_ACTION' }),
    },
    // Données lues par l'app au tap (même routage que FCM / OneSignal).
    ...(payload.data || {}),
  })

  return new Promise<ApnsResult>((resolve) => {
    let settled = false
    const done = (r: ApnsResult) => { if (!settled) { settled = true; resolve(r) } }

    const client = http2.connect(cfg.host)
    client.on('error', (e) => { console.warn('[APNs] Connexion :', e.message); done('error') })
    client.setTimeout(APNS_TIMEOUT_MS, () => { console.warn('[APNs] Timeout'); client.destroy(); done('error') })

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + (isCall ? 30 : 3600)),
      'content-type': 'application/json',
    })

    let status = 0
    let raw = ''
    req.on('response', (headers) => { status = Number(headers[':status']) })
    req.setEncoding('utf8')
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      client.close()
      if (status === 200) return done('ok')
      let reason = ''
      try { reason = JSON.parse(raw)?.reason ?? '' } catch { /* corps vide */ }
      console.warn(`[APNs] HTTP ${status} ${reason}`)
      // 410 Unregistered / 400 BadDeviceToken → jeton à supprimer.
      // ExpiredProviderToken → clé à renouveler (pas le jeton de l'appareil).
      if (reason === 'ExpiredProviderToken') cachedJwt = null
      done(status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' ? 'invalid' : 'error')
    })
    req.on('error', (e) => { console.warn('[APNs] Requête :', e.message); client.close(); done('error') })
    req.end(body)
  })
}
