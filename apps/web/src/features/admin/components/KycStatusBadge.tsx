import { cn } from '@/lib/utils'
import type { KycStatus } from '../api/kyc-admin.api'

const STYLES: Record<KycStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  verified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const LABELS: Record<KycStatus, string> = {
  pending: 'En attente',
  verified: 'Approuvé',
  rejected: 'Rejeté',
}

export function KycStatusBadge({ status }: { status: KycStatus }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border', STYLES[status])}>
      {LABELS[status]}
    </span>
  )
}
