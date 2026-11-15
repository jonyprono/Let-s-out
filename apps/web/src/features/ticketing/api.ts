import { apiClient } from '@/lib/api-client'

/** Billetterie multi-catégories — routes /events/:id/ticket-tiers, /payout-info, /ticket-sales */

export const PAYOUT_NETWORKS = ['MTN', 'MOOV', 'CELTIIS'] as const
export type PayoutNetwork = (typeof PAYOUT_NETWORKS)[number]

/** Limites identiques à celles du serveur (TIER_LIMITS) — le serveur reste juge final */
export const TIER_LIMITS = { nameMax: 60, descriptionMax: 200, priceMin: 100, priceMax: 10_000_000, quantityMax: 100_000 } as const

export interface TicketTier {
  id: string
  name: string
  description: string | null
  price: number
  sortOrder: number
  isActive: boolean
  totalQuantity: number
  soldQuantity: number
  remaining: number
  soldOut: boolean
}

export interface TierInput {
  name: string
  description?: string | null
  price: number
  totalQuantity: number
  isActive?: boolean
}

export interface PayoutInfo {
  phone: string
  network: PayoutNetwork | ''
  name: string
}

export interface TicketingConfig {
  commissionPercent: number
  payoutDelayHours: number
  maxPerOrder: number
  networks: string[]
}

export interface TicketSales {
  commissionPercent: number
  totals: { gross: number; fee: number; net: number; orders: number; ticketsIssued: number; ticketsCheckedIn: number }
  tiers: (TicketTier & { revenue: number })[]
  payout: { status: 'HELD' | 'RELEASED'; releasedAt: string | null; releaseAvailableAt: string; delayHours: number }
  payoutInfo: { complete: boolean; network: string | null; name: string | null; phone: string | null; canEdit: boolean }
}

export interface PublicTiers {
  ticketingEnabled: boolean
  onSale: boolean
  maxPerOrder: number
  tiers: TicketTier[]
}

export interface MyTicketItem {
  id: string
  tierName: string
  price: number
  ref: string
  qrPayload: string
  shareToken: string
  checkedInAt: string | null
}

export interface MyTickets {
  bookingRef: string
  tickets: MyTicketItem[]
}

/** Lien public d'un billet (page servie par l'API : s'ouvre sans l'application) */
export function ticketShareUrl(token: string) {
  const base = String(apiClient.defaults.baseURL ?? '').replace(/\/$/, '')
  const abs = /^https?:\/\//.test(base) ? base : `${window.location.origin}${base.startsWith('/') ? '' : '/'}${base}`
  return `${abs}/tickets/${encodeURIComponent(token)}/view`
}

export const ticketingApi = {
  publicTiers: (eventId: string) => apiClient.get<PublicTiers>(`/events/${eventId}/ticket-tiers`).then((r) => r.data),
  myTickets: (eventId: string) => apiClient.get<MyTickets>(`/events/${eventId}/my-tickets`).then((r) => r.data),
  config: () => apiClient.get<TicketingConfig>('/payments/ticket-config').then((r) => r.data),
  sales: (eventId: string) => apiClient.get<TicketSales>(`/events/${eventId}/ticket-sales`).then((r) => r.data),
  createTier: (eventId: string, input: TierInput) => apiClient.post<TicketTier>(`/events/${eventId}/ticket-tiers`, input).then((r) => r.data),
  updateTier: (eventId: string, tierId: string, input: Partial<TierInput>) =>
    apiClient.patch<TicketTier>(`/events/${eventId}/ticket-tiers/${tierId}`, input).then((r) => r.data),
  deleteTier: (eventId: string, tierId: string) => apiClient.delete(`/events/${eventId}/ticket-tiers/${tierId}`).then((r) => r.data),
  savePayoutInfo: (eventId: string, info: PayoutInfo) => apiClient.put(`/events/${eventId}/payout-info`, info).then((r) => r.data),
}

export const ticketingKeys = {
  config: ['ticketing', 'config'] as const,
  publicTiers: (eventId: string) => ['events', eventId, 'ticket-tiers'] as const,
  myTickets: (eventId: string) => ['events', eventId, 'my-tickets'] as const,
  sales: (eventId: string) => ['events', eventId, 'ticket-sales'] as const,
}

/** Validation locale d'une catégorie : renvoie le champ en erreur, ou null */
export function tierInputError(t: { name: string; price: string | number; totalQuantity: string | number }, minQuantity = 1): 'name' | 'price' | 'totalQuantity' | null {
  const name = String(t.name ?? '').trim()
  if (!name || name.length > TIER_LIMITS.nameMax) return 'name'
  const p = Number(t.price)
  if (!Number.isInteger(p) || p < TIER_LIMITS.priceMin || p > TIER_LIMITS.priceMax) return 'price'
  const q = Number(t.totalQuantity)
  if (!Number.isInteger(q) || q < Math.max(1, minQuantity) || q > TIER_LIMITS.quantityMax) return 'totalQuantity'
  return null
}

/** Même normalisation que le serveur (espaces / tirets / points retirés) */
export function normalizePhone(raw: string) {
  return String(raw ?? '').replace(/[\s.-]/g, '')
}

export function payoutInfoError(p: PayoutInfo): 'phone' | 'network' | 'name' | null {
  if (!/^\+?\d{8,15}$/.test(normalizePhone(p.phone))) return 'phone'
  if (!(PAYOUT_NETWORKS as readonly string[]).includes(p.network)) return 'network'
  const n = p.name.trim()
  if (n.length < 2 || n.length > 80) return 'name'
  return null
}

/** Message d'erreur serveur lisible (le serveur renvoie { error, code, field }) */
export function apiErrorMessage(err: any, fallback: string): string {
  const m = err?.response?.data?.error || err?.response?.data?.message
  return typeof m === 'string' && m ? m : fallback
}
