import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, CheckCircle, XCircle } from 'lucide-react'
import { auditAdminApi, type PayoutRequest } from '@/features/admin/api/audit-admin.api'
import { format } from 'date-fns'
import { toast } from 'sonner'

export function AdminPayoutsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payouts', page, statusFilter],
    queryFn: () => auditAdminApi.getPayouts({ page, limit: 20, status: statusFilter || undefined }),
  })

  const forceApproveMut = useMutation({
    mutationFn: auditAdminApi.forceApprovePayout,
    onSuccess: () => {
      toast.success('Fonds débloqués de force avec succès !')
      queryClient.invalidateQueries({ queryKey: ['admin', 'payouts'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Erreur lors du déblocage')
    }
  })

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => auditAdminApi.rejectPayout(id, reason),
    onSuccess: () => {
      toast.success('Demande de déblocage rejetée')
      queryClient.invalidateQueries({ queryKey: ['admin', 'payouts'] })
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Erreur lors du rejet')
    }
  })

  const handleForceApprove = (req: PayoutRequest) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir forcer le déblocage de ${req.amount.toLocaleString('fr-FR')} F CFA pour l'événement "${req.event?.title}" ?\n\nCette action va prélever la commission et transférer les fonds au créateur sans attendre les votes.`)) {
      return
    }
    forceApproveMut.mutate(req.id)
  }

  const handleReject = (req: PayoutRequest) => {
    const reason = window.prompt("Motif du refus (anti-fraude) :", "Non respect des conditions")
    if (reason) {
      rejectMut.mutate({ id: req.id, reason })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs">Approuvé</span>
      case 'PENDING': return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs">En attente</span>
      case 'VOTING': return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/20 px-2 py-1 rounded text-xs">Vote en cours</span>
      case 'REJECTED': return <span className="bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-1 rounded text-xs">Rejeté</span>
      case 'EXPIRED': return <span className="bg-gray-500/20 text-gray-400 border border-gray-500/20 px-2 py-1 rounded text-xs">Expiré</span>
      default: return <span className="bg-white/10 text-white/60 px-2 py-1 rounded text-xs">{status}</span>
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-8 h-8 text-action-primary" />
            Déblocages FinTech
          </h1>
          <p className="text-white/50 text-sm mt-1">Gérer les demandes de retrait de cagnottes</p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-[#1A1A1A] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-action-primary"
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="VOTING">Vote en cours</option>
            <option value="APPROVED">Approuvé (Débloqué)</option>
            <option value="REJECTED">Rejeté</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="p-8 text-center text-white/40">Chargement...</div>
        ) : data?.data.length === 0 ? (
          <div className="p-8 text-center text-white/40 bg-[#1A1A1A]/[0.02] border border-white/10 rounded-2xl">Aucune demande de déblocage</div>
        ) : (
          data?.data.map((req) => {
            const votesTotal = req.snapshotVoterIds?.length || 0;
            const votesOui = req.approvals?.length || 0;
            const votesNon = req.rejections?.length || 0;

            return (
              <div key={req.id} className="p-5 rounded-2xl border border-white/10 bg-[#1A1A1A]/[0.02] hover:bg-[#1A1A1A]/[0.04] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{req.amount.toLocaleString('fr-FR')} F CFA</span>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="text-sm text-white/70">
                    <span className="font-medium text-white">{req.event?.title || 'Événement inconnu'}</span>
                    {' • '}
                    Demandé par: <span className="font-mono text-xs">{req.requestedBy.slice(0, 8)}...</span>
                  </div>
                  <div className="text-xs text-white/40 flex items-center gap-3">
                    <span>Le {format(new Date(req.createdAt), 'dd/MM/yyyy à HH:mm')}</span>
                    {votesTotal > 0 && (
                      <span className="px-2 py-0.5 bg-white/5 rounded text-white/60">
                        Votes: {votesOui} Oui / {votesNon} Non (sur {votesTotal})
                      </span>
                    )}
                  </div>
                  {req.rejectionReason && (
                    <div className="text-xs text-red-400 mt-2">
                      Raison du refus: {req.rejectionReason}
                    </div>
                  )}
                </div>

                {/* Actions (Only if not already approved or rejected) */}
                {['PENDING', 'VOTING'].includes(req.status) && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleForceApprove(req)}
                      disabled={forceApproveMut.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Forcer Déblocage
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={rejectMut.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors border border-red-500/20"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <span className="text-xs text-white/50">Page {data.page} sur {data.pages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs hover:bg-white/5 disabled:opacity-50">Précédent</button>
            <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs hover:bg-white/5 disabled:opacity-50">Suivant</button>
          </div>
        </div>
      )}
    </div>
  )
}
