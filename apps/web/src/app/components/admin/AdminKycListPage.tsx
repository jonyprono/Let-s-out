import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Search, ChevronRight, ChevronLeft, ShieldCheck } from 'lucide-react'
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      {/* Background glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-action-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-action-primary to-orange-600 flex items-center justify-center shadow-lg shadow-action-primary/20">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              Vérification KYC
            </h1>
          </div>
          <p className="text-white/50 text-sm font-medium">Gérez et validez les identités des utilisateurs. {data?.total ? `${data.total} dossier(s)` : ''}</p>
        </div>
      </div>

      {/* Controls: Search & Filters */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-[#1A1A1A]/[0.02] p-2 rounded-3xl border border-white/5 shadow-2xl backdrop-blur-xl">
        <div className="flex p-1 bg-black/40 rounded-2xl w-full lg:w-auto overflow-x-auto hide-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setStatus(f.key); setPage(1) }}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                status === f.key 
                  ? 'bg-action-primary text-white shadow-lg shadow-action-primary/25' 
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-80 px-2 lg:px-0 lg:pr-2 pb-2 lg:pb-0">
          <Search className="absolute left-6 lg:left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Rechercher nom, téléphone..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/40 border border-white/5 text-sm outline-none focus:border-action-primary/50 focus:ring-2 focus:ring-action-primary/20 placeholder:text-white/30 transition-all text-white font-medium"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-3xl border border-white/10 bg-[#1A1A1A]/[0.02] backdrop-blur-md shadow-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-left text-white/50 text-xs uppercase tracking-wider font-semibold">
              <th className="px-6 py-4">Utilisateur</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Date de soumission</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && (
              <tr><td colSpan={5} className="px-6 py-16 text-center text-white/40 font-medium">Chargement des dossiers...</td></tr>
            )}
            {!isLoading && (data?.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-6 py-16 text-center text-white/40 font-medium">Aucun dossier correspondant</td></tr>
            )}
            {(data?.data ?? []).map(row => (
              <tr key={row.userId} className="hover:bg-[#1A1A1A]/[0.04] transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-white font-bold shadow-inner">
                      {row.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-action-primary transition-colors">{row.displayName}</p>
                      <p className="text-xs text-white/40 mt-0.5">@{row.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-white/80 font-medium">{row.phone || '—'}</span>
                    <span className="text-white/40 text-xs">{row.email || '—'}</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-white/60 font-medium">
                  {row.kycSubmittedAt ? new Date(row.kycSubmittedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </td>
                <td className="px-6 py-5">
                  <div className="inline-block"><KycStatusBadge status={row.kycStatus} /></div>
                </td>
                <td className="px-6 py-5 text-right">
                  <Link 
                    to={`/admin/kyc/${row.userId}`} 
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A1A]/5 hover:bg-action-primary text-white text-xs font-bold transition-all hover:shadow-lg hover:shadow-action-primary/20 active:scale-95"
                  >
                    Examiner <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {(data?.data ?? []).map(row => (
          <Link
            key={row.userId}
            to={`/admin/kyc/${row.userId}`}
            className="block rounded-3xl border border-white/10 bg-[#1A1A1A]/[0.03] p-5 active:scale-[0.98] transition-transform shadow-lg backdrop-blur-md relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-action-primary/0 to-action-primary/0 group-active:from-action-primary/5 group-active:to-transparent transition-colors" />
            <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-white font-bold shrink-0 shadow-inner">
                  {row.displayName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-lg truncate text-white">{row.displayName}</p>
                  <p className="text-xs text-action-primary font-medium truncate">@{row.username}</p>
                </div>
              </div>
              <KycStatusBadge status={row.kycStatus} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm relative z-10 p-3 bg-black/20 rounded-2xl border border-white/5">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Contact</p>
                <p className="text-white/80 font-medium truncate">{row.phone || row.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Soumis le</p>
                <p className="text-white/80 font-medium truncate">
                  {row.kycSubmittedAt ? new Date(row.kycSubmittedAt).toLocaleDateString('fr-FR') : '—'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {(data?.pages ?? 1) > 1 && (
        <div className="flex items-center justify-center gap-6 pt-6">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1A1A1A]/5 border border-white/10 disabled:opacity-30 hover:bg-[#1A1A1A]/10 transition-colors active:scale-95 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-2 rounded-xl bg-black/30 border border-white/5">
            <span className="text-sm font-bold text-white/80">Page {page} <span className="text-white/30 mx-1">/</span> {data?.pages}</span>
          </div>
          <button
            type="button"
            disabled={page >= (data?.pages ?? 1)}
            onClick={() => setPage(p => p + 1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1A1A1A]/5 border border-white/10 disabled:opacity-30 hover:bg-[#1A1A1A]/10 transition-colors active:scale-95 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}
