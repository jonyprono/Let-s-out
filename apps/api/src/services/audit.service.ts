import type { PrismaClient } from '@prisma/client'

export type AuditAction =
  | 'PAYOUT_REQUEST'
  | 'VOTE_YES'
  | 'VOTE_NO'
  | 'PAYOUT_APPROVED'
  | 'PAYOUT_REJECTED'
  | 'PAYOUT_EXPIRED'
  | 'FUND_RELEASED'
  | 'WALLET_WITHDRAWAL'
  | 'WALLET_DEPOSIT'
  | 'POOL_CLOSED'
  | 'CONTRIBUTION'

export interface AuditEntry {
  actorId?: string
  actorRole?: string
  action: AuditAction
  targetType?: string
  targetId?: string
  eventId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  amount?: number
  ipAddress?: string
  userAgent?: string
  comment?: string
}

/**
 * Write an immutable audit log entry.
 * Accepts a PrismaClient or a Prisma transaction client.
 */
export async function writeAuditLog(
  prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  entry: AuditEntry
): Promise<void> {
  try {
    await (prisma as any).auditLog.create({ data: entry })
  } catch (err) {
    // Never let audit failures break business logic
    console.error('[AuditLog] Failed to write audit entry:', err)
  }
}

/**
 * Resolve vote result given 70% threshold.
 * No abstention concept — only expressed votes count.
 *
 * @param yesCount  - number of YES votes
 * @param noCount   - number of NO votes
 * @param threshold - majority ratio required (default 0.70)
 * @returns 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PENDING'
 */
export function resolveVoteResult(
  yesCount: number,
  noCount: number,
  totalEligible: number,
  threshold = 0.70
): 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'PENDING' {
  const votedCount = yesCount + noCount

  // No votes at all → EXPIRED
  if (votedCount === 0) return 'EXPIRED'

  const yesRatio = yesCount / totalEligible

  if (yesRatio >= threshold) return 'APPROVED'
  if (yesRatio < threshold) return 'REJECTED'

  return 'PENDING'
}
