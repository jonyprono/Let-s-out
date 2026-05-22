import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Search, ChevronRight, ChevronLeft } from 'lucide-react'
import { kycAdminApi, type KycStatus } from '@/features/admin/api/kyc-admin.api'
import { KycStatusBadge } from '@/features/admin/components/KycStatusBadge'

const FILTERS: { key: KycStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'verified', label: 'Approuvés' },
  { key: 'rejected', label: 'Rejetés' },
]

export function AdminKycListPage() {
  const [status, setStatus] = useState<KycStatus | 'all'>('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'kyc', 'list', status, debouncedSearch, page],
    queryFn: () =>
      kycAdminApi.list({
        status: status === 'all' ? undefined : status,
        search: debouncedSearch || undefined,
        page,
        limit: 20,
      }),
  })

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Demandes KYC</h1>
        <p className="text-white/50 text-sm mt-1">{data?.total ?? 0} dossier(s)</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setStatus(f.key); setPage(1) }}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              status === f.key ? 'bg-[#FF9F1C] text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Rechercher nom, téléphone, email..."
          className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-sm outline-none focus:border-[#FF9F1C]/50 placeholder:text-white/30"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-left text-white/50 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-semibold">Utilisateur</th>
              <th className="px-5 py-3 font-semibold">Contact</th>
              <th className="px-5 py-3 font-semibold">Soumis</th>
              <th className="px-5 py-3 font-semibold">Statut</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-white/40">Chargement...</td></tr>
            )}
            {!isLoading && (data?.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-white/40">Aucun dossier</td></tr>
            )}
            {(data?.data ?? []).map(row => (
              <tr key={row.userId} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#FF9F1C]/20 text-[#FF9F1C] font-bold flex items-center justify-center text-sm">
                      {row.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{row.displayName}</p>
                      <p className="text-xs text-white/40">@{row.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-white/60">{row.phone || row.email || '—'}</td>
                <td className="px-5 py-4 text-white/60">
                  {row.kycSubmittedAt ? new Date(row.kycSubmittedAt).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td className="px-5 py-4"><KycStatusBadge status={row.kycStatus} /></td>
                <td className="px-5 py-4 text-right">
                  <Link to={`/admin/kyc/${row.userId}`} className="inline-flex items-center gap-1 text-[#FF9F1C] font-medium text-xs">
                    Ouvrir <ChevronRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {(data?.data ?? []).map(row => (
          <Link
            key={row.userId}
            to={`/admin/kyc/${row.userId}`}
            className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#FF9F1C]/20 text-[#FF9F1C] font-bold flex items-center justify-center shrink-0">
                  {row.displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{row.displayName}</p>
                  <p className="text-xs text-white/40 truncate">{row.phone || row.email}</p>
                </div>
              </div>
              <KycStatusBadge status={row.kycStatus} />
            </div>
          </Link>
        ))}
      </div>

      {(data?.pages ?? 1) > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="p-2 rounded-xl bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-white/50">{page} / {data?.pages}</span>
          <button
            type="button"
            disabled={page >= (data?.pages ?? 1)}
            onClick={() => setPage(p => p + 1)}
            className="p-2 rounded-xl bg-white/5 disabled:opacity-30"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
