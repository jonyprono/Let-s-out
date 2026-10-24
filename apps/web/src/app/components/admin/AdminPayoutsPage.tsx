import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wallet, CheckCircle, XCircle } from 'lucide-react'
import { auditAdminApi, type PayoutRequest } from '@/features/admin/api/audit-admin.api'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useConfirm } from '@/components/shared/ConfirmContext'

export function AdminPayoutsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [rejectTarget, setRejectTarget] = useState<PayoutRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('Non respect des conditions')
  
  const queryClient = useQueryClient()
  const confirm = useConfirm()

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
      setRejectTarget(null)
      setRejectReason('Non respect des conditions')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Erreur lors du rejet')
    }
  })

  const handleForceApprove = async (req: PayoutRequest) => {
    const ok = await confirm({
      title: 'Forcer le déblocage ?',
      description: `Êtes-vous sûr de vouloir forcer le déblocage de ${req.amount.toLocaleString('fr-FR')} F CFA pour l'événement "${req.event?.title}" ?\n\nCette action va prélever la commission et transférer les fonds au créateur sans attendre les votes.`,
      confirmText: 'Forcer le déblocage',
      variant: 'danger',
    })
    if (ok) {
      forceApproveMut.mutate(req.id)
    } else {
      toast.info('Action annulée')
    }
  }

  const handleRejectSubmit = () => {
    if (!rejectTarget || !rejectReason.trim()) return
    rejectMut.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
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
            <span>Déblocages FinTech</span>
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
                    <span>Demandé par :</span> <span className="font-mono text-xs">{req.requestedBy.slice(0, 8)}...</span>
                  </div>
                  <div className="text-xs text-white/40 flex items-center gap-3">
                    <span>Le {format(new Date(req.createdAt), 'dd/MM/yyyy à HH:mm')}</span>
                    {votesTotal > 0 && (
                      <span className="px-2 py-0.5 bg-white/5 rounded text-white/60">
                        <span>Votes : </span><span>{votesOui} Oui / {votesNon} Non (sur {votesTotal})</span>
                      </span>
                    )}
                  </div>
                  {req.rejectionReason && (
                    <div className="text-xs text-red-400 mt-2">
                      <span>Raison du refus : </span><span>{req.rejectionReason}</span>
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
                      <span>Forcer Déblocage</span>
                    </button>
                    <button
                      onClick={() => { setRejectTarget(req); setRejectReason('Non respect des conditions') }}
                      disabled={rejectMut.isPending}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors border border-red-500/20"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Rejeter</span>
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
          <span className="text-xs text-white/50"><span>Page </span><span>{data.page}</span><span> sur </span><span>{data.pages}</span></span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs hover:bg-white/5 disabled:opacity-50"><span>Précédent</span></button>
            <button disabled={page === data.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 bg-[#1A1A1A] border border-white/10 rounded text-xs hover:bg-white/5 disabled:opacity-50"><span>Suivant</span></button>
          </div>
        </div>
      )}

      {/* Modal de saisie du motif de refus */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setRejectTarget(null); toast.info('Action annulée') } }}
        >
          <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h2 className="text-lg font-bold text-white">Rejeter la demande</h2>
              <p className="text-sm text-white/50 mt-1">
                Demande de <span className="text-white font-medium">{rejectTarget.amount.toLocaleString('fr-FR')} F CFA</span> pour « {rejectTarget.event?.title} »
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Motif du refus (anti-fraude)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500/60 resize-none"
                placeholder="Saisissez le motif du refus..."
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setRejectTarget(null); toast.info('Action annulée') }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || rejectMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {rejectMut.isPending ? 'En cours...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
