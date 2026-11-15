import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Outils FedaPay partagés (paiements Mobile Money).
 *
 * Environnement déduit de la clé secrète :
 *   sk_live_…    → https://api.fedapay.com/v1          (argent réel)
 *   sk_sandbox_… → https://sandbox-api.fedapay.com/v1  (tests)
 */

/** Statuts FedaPay signifiant que l'argent est encaissé */
export const FEDAPAY_APPROVED_STATUSES = ['approved', 'captured', 'transferred']

/** Tolérance anti-rejeu des webhooks (identique au SDK officiel FedaPay) */
export const FEDAPAY_WEBHOOK_TOLERANCE_SEC = 300

export function isFedapayLiveKey(key = process.env.FEDAPAY_SECRET_KEY): boolean {
  return !!key && key.startsWith('sk_live_')
}

export function fedapayBaseUrl(key = process.env.FEDAPAY_SECRET_KEY): string {
  return key?.startsWith('sk_sandbox_') ? 'https://sandbox-api.fedapay.com/v1' : 'https://api.fedapay.com/v1'
}

export type SignatureCheck = { ok: true } | { ok: false; reason: string }

/**
 * Vérifie l'en-tête X-FEDAPAY-SIGNATURE selon le format officiel (SDK fedapay-node) :
 *   en-tête  : « t=<horodatage unix>,s=<signature hex>[,s=<…>] »
 *   signé    : `${t}.${corps brut}`  — HMAC-SHA256, clé = secret du webhook (wh_live_… / wh_sandbox_…)
 *   rejeu    : refusé si l'horodatage a plus de `toleranceSec` secondes
 * Le corps doit être le texte EXACT reçu (pas un JSON re-sérialisé).
 */
export function verifyFedapaySignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  toleranceSec = FEDAPAY_WEBHOOK_TOLERANCE_SEC,
  nowSec = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing-signature' }
  let timestamp = -1
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k === 't') timestamp = parseInt(v, 10)
    if (k === 's') signatures.push(v)
  }
  if (!Number.isFinite(timestamp) || timestamp < 0) return { ok: false, reason: 'missing-timestamp' }
  if (!signatures.length) return { ok: false, reason: 'missing-scheme' }

  const expected = Buffer.from(createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex'), 'utf8')
  const match = signatures.some((sig) => {
    const given = Buffer.from(sig, 'utf8')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
  if (!match) return { ok: false, reason: 'bad-signature' }
  if (toleranceSec > 0 && nowSec - timestamp > toleranceSec) return { ok: false, reason: 'timestamp-too-old' }
  return { ok: true }
}

/** Construit un en-tête valide (tests uniquement) */
export function buildFedapaySignatureHeader(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
  return `t=${timestamp},s=${sig}`
}

export interface FedapayTransaction {
  id: string
  status: string
  amount: number
  metadata: Record<string, any>
}

export function parseFedapayMetadata(tx: any): Record<string, any> {
  try {
    const raw = tx?.metadata ?? tx?.custom_metadata ?? {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export class FedapayError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

/**
 * Lit UNE transaction directement chez FedaPay (source de vérité).
 * Lève FedapayError(404) si elle n'existe pas sur ce compte.
 */
export async function getFedapayTransaction(id: string | number): Promise<FedapayTransaction> {
  const key = process.env.FEDAPAY_SECRET_KEY
  if (!key) throw new FedapayError('FEDAPAY_SECRET_KEY manquante', 500)
  const safeId = encodeURIComponent(String(id))
  const res = await fetch(`${fedapayBaseUrl(key)}/transactions/${safeId}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (res.status === 404) throw new FedapayError('Transaction introuvable', 404)
  if (!res.ok) throw new FedapayError(`FedaPay HTTP ${res.status}`, 502)
  const data = (await res.json()) as any
  const tx = data?.['v1/transaction'] ?? data?.v1?.transaction ?? data?.transaction ?? data
  if (!tx?.id) throw new FedapayError('Réponse FedaPay invalide', 502)
  return { id: String(tx.id), status: String(tx.status || ''), amount: Number(tx.amount), metadata: parseFedapayMetadata(tx) }
}

/** Identifiant de transaction dans un événement webhook FedaPay (formats observés) */
export function webhookTransactionId(body: any): string | null {
  const id = body?.entity?.id ?? body?.transaction?.id ?? body?.data?.id ?? body?.object?.id
  return id !== undefined && id !== null ? String(id) : null
}
