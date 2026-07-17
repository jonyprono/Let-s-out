import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Clock, CheckCircle2, XCircle, ShieldCheck, ChevronRight } from 'lucide-react'
import { kycAdminApi } from '@/features/admin/api/kyc-admin.api'
import { KycStatusBadge } from '@/features/admin/components/KycStatusBadge'
import type { KycStatus } from '@/features/admin/api/kyc-admin.api'

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: number
  icon: typeof Clock
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1A1A1A]/[0.03] backdrop-blur-sm p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'kyc', 'stats'],
    queryFn: kycAdminApi.stats,
  })

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 text-white">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard KYC</h1>
        <p className="text-white/50 text-sm mt-1">Vue d&apos;ensemble des demandes de vérification</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-[#1A1A1A]/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="En attente" value={data?.pending ?? 0} icon={Clock} accent="bg-amber-500/20 text-amber-400" />
          <StatCard label="Approuvées" value={data?.approved ?? 0} icon={CheckCircle2} accent="bg-emerald-500/20 text-emerald-400" />
          <StatCard label="Rejetées" value={data?.rejected ?? 0} icon={XCircle} accent="bg-red-500/20 text-red-400" />
          <StatCard label="Total dossiers" value={data?.total ?? 0} icon={ShieldCheck} accent="bg-action-primary/20 text-action-primary" />
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A]/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold">Activité récente</h2>
          <Link to="/admin/kyc" className="text-sm text-action-primary font-medium flex items-center gap-1 hover:underline">
            Voir tout <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-white/5">
          {(data?.recent ?? []).length === 0 && (
            <p className="p-8 text-center text-white/40 text-sm">Aucune demande récente</p>
          )}
          {(data?.recent ?? []).map(row => (
            <Link
              key={row.userId}
              to={`/admin/kyc/${row.userId}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[#1A1A1A]/[0.04] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-action-primary/20 flex items-center justify-center text-action-primary font-bold shrink-0">
                {row.displayName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-white">{row.displayName}</p>
                <p className="text-xs text-white/40 truncate">@{row.username}</p>
              </div>
              <KycStatusBadge status={row.kycStatus as KycStatus} />
              <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
