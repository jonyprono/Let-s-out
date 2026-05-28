import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { kycAdminApi } from '@/features/admin/api/kyc-admin.api'
import { KycStatusBadge } from '@/features/admin/components/KycStatusBadge'
import { ImageLightbox } from '@/features/admin/components/ImageLightbox'
import { resolveUploadUrl } from '@/lib/upload-url'

export function AdminKycDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'kyc', userId],
    queryFn: () => kycAdminApi.detail(userId!),
    enabled: !!userId,
  })

  const approveMut = useMutation({
    mutationFn: () => kycAdminApi.approve(userId!),
    onSuccess: () => {
      toast.success('Profil approuvé et vérifié')
      qc.invalidateQueries({ queryKey: ['admin', 'kyc'] })
      navigate('/admin/kyc')
    },
    onError: () => toast.error('Échec de l\'approbation'),
  })

  const rejectMut = useMutation({
    mutationFn: (reason: string) => kycAdminApi.reject(userId!, reason),
    onSuccess: () => {
      toast.success('Demande rejetée — utilisateur notifié')
      qc.invalidateQueries({ queryKey: ['admin', 'kyc'] })
      navigate('/admin/kyc')
    },
    onError: () => toast.error('Échec du rejet'),
  })

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-action-primary" />
      </div>
    )
  }

  const docs = {
    idFront: resolveUploadUrl(data.documents.idFront),
    idBack: resolveUploadUrl(data.documents.idBack),
    selfie: resolveUploadUrl(data.documents.selfie),
    selfieWithId: resolveUploadUrl(data.documents.selfieWithId),
  }

  const isPending = data.kycStatus === 'pending'

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-32 space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/kyc" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{data.displayName}</h1>
          <p className="text-sm text-white/50">@{data.username}</p>
        </div>
        <KycStatusBadge status={data.kycStatus} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Téléphone</p>
          <p className="font-medium mt-1">{data.phone || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Email</p>
          <p className="font-medium mt-1">{data.email || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Soumis le</p>
          <p className="font-medium mt-1">
            {data.kycSubmittedAt ? new Date(data.kycSubmittedAt).toLocaleString('fr-FR') : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Compte vérifié</p>
          <p className="font-medium mt-1">{data.user.isVerified ? 'Oui' : 'Non'}</p>
        </div>
      </div>

      {data.kycRejectedReason && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-xs font-semibold text-red-400 uppercase">Motif de rejet</p>
          <p className="text-sm mt-1 text-red-200">{data.kycRejectedReason}</p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Documents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ImageLightbox src={docs.selfie} label="Selfie" />
          <ImageLightbox src={docs.selfieWithId} label="Selfie + pièce" />
          <ImageLightbox src={docs.idFront} label="Pièce — recto" />
          <ImageLightbox src={docs.idBack} label="Pièce — verso" />
        </div>
      </div>

      {isPending && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-64 p-4 md:p-6 border-t border-white/10 bg-[#0a0a0b]/95 backdrop-blur-xl space-y-3">
          {showRejectForm ? (
            <div className="max-w-5xl mx-auto space-y-3">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Raison du rejet (visible par l'utilisateur)..."
                rows={3}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-red-500/50 resize-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="flex-1 py-3.5 rounded-2xl border border-white/10 font-semibold text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={rejectReason.trim().length < 3 || rejectMut.isPending}
                  onClick={() => rejectMut.mutate(rejectReason.trim())}
                  className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {rejectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirmer le rejet
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                className="flex-1 py-4 rounded-2xl border border-red-500/40 text-red-400 font-semibold flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
              >
                <XCircle className="w-5 h-5" />
                Rejeter
              </button>
              <button
                type="button"
                disabled={approveMut.isPending}
                onClick={() => approveMut.mutate()}
                className="flex-[1.2] py-4 rounded-2xl bg-[#10B981] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#0d9668] transition-colors disabled:opacity-50"
              >
                {approveMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Approuver
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
