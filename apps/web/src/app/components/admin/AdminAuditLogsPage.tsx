import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, Filter } from 'lucide-react'
import { auditAdminApi } from '@/features/admin/api/audit-admin.api'
import { format } from 'date-fns'
import { useAuthStore } from '@/stores/auth.store'

export function AdminAuditLogsPage() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState<string>('')
  
  const token = useAuthStore(s => s.accessToken)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-logs', page, actionFilter],
    queryFn: () => auditAdminApi.getLogs({ page, limit: 50, action: actionFilter || undefined }),
  })

  const handleExport = () => {
    // Generate an export by directing the browser to download the CSV directly from the API endpoint
    const url = auditAdminApi.getExportUrl()
    // Append access token since it's a direct browser download
    const fullUrl = `${url}?token=${token}`
    
    const a = document.createElement('a')
    a.href = fullUrl
    a.download = 'audit_logs.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-8 h-8 text-action-primary" />
            Logs d'Audit FinTech
          </h1>
          <p className="text-white/50 text-sm mt-1">Trace immuable des transactions et actions de sécurité</p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-action-primary appearance-none"
            >
              <option value="">Toutes les actions</option>
              <option value="PAYOUT_REQUEST">Demande de déblocage</option>
              <option value="VOTE_YES">Vote validateur: Oui</option>
              <option value="VOTE_NO">Vote validateur: Non</option>
              <option value="PAYOUT_APPROVED">Déblocage Approuvé</option>
              <option value="FUND_RELEASED">Fonds Transférés</option>
              <option value="COMMISSION_CHARGED">Commission Prélevée</option>
            </select>
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-action-primary text-white rounded-lg text-sm font-medium hover:bg-action-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#1A1A1A]/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-white/80">
            <thead className="bg-[#1A1A1A]/50 text-white/60 text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Acteur</th>
                <th className="px-6 py-4">Event ID</th>
                <th className="px-6 py-4">Montant (F CFA)</th>
                <th className="px-6 py-4">Commentaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-white/40">Chargement des logs...</td>
                </tr>
              ) : data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-white/40">Aucun log trouvé</td>
                </tr>
              ) : (
                data?.data.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-white/50">
                      {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-white/10 text-xs font-medium text-white border border-white/5">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-white/60">
                      {log.actorId ? (
                        <div className="flex flex-col">
                          <span className="font-mono">{log.actorId.slice(0, 8)}...</span>
                          <span className="text-[10px] text-action-primary">{log.actorRole}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-white/50 font-mono">
                      {log.eventId ? log.eventId.slice(0, 10) + '...' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-emerald-400">
                      {log.amount ? `${log.amount.toLocaleString('fr-FR')}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-xs text-white/70 max-w-xs truncate" title={log.comment || ''}>
                      {log.comment || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
            <span className="text-xs text-white/50">
              Page {data.page} sur {data.pages}
            </span>
            <div className="flex gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs hover:bg-white/5 disabled:opacity-50"
              >
                Précédent
              </button>
              <button 
                disabled={page === data.pages}
                onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs hover:bg-white/5 disabled:opacity-50"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
