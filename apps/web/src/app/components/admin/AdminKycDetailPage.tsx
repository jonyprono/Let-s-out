import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Phone, Mail, Calendar, ShieldAlert } from 'lucide-react'
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
        <Loader2 className="w-10 h-10 animate-spin text-action-primary" />
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
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-40 space-y-8 animate-in fade-in duration-500 relative">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-action-primary/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-5">
          <Link 
            to="/admin/kyc" 
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-action-primary hover:text-white hover:border-action-primary/50 transition-all active:scale-95 group"
          >
            <ArrowLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-white font-bold text-xl shadow-inner">
              {data.displayName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{data.displayName}</h1>
              <p className="text-action-primary font-medium">@{data.username}</p>
            </div>
          </div>
        </div>
        <div className="scale-110 origin-left sm:origin-right">
          <KycStatusBadge status={data.kycStatus} />
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Phone, label: "Téléphone", value: data.phone || '—', color: "text-blue-400", bg: "bg-blue-400/10" },
          { icon: Mail, label: "Email", value: data.email || '—', color: "text-purple-400", bg: "bg-purple-400/10" },
          { icon: Calendar, label: "Soumis le", value: data.kycSubmittedAt ? new Date(data.kycSubmittedAt).toLocaleString('fr-FR') : '—', color: "text-emerald-400", bg: "bg-emerald-400/10" },
          { icon: ShieldAlert, label: "Compte vérifié", value: data.user.isVerified ? 'Oui' : 'Non', color: data.user.isVerified ? "text-action-primary" : "text-red-400", bg: data.user.isVerified ? "bg-action-primary/10" : "bg-red-400/10" }
        ].map((item, idx) => (
          <div key={idx} className="p-5 rounded-3xl border border-white/5 bg-black/20 backdrop-blur-md shadow-lg flex items-start gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg}`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">{item.label}</p>
              <p className="font-semibold text-white truncate text-sm">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rejection Reason (If any) */}
      {data.kycRejectedReason && (
        <div className="rounded-3xl border border-red-500/20 bg-gradient-to-r from-red-500/10 to-transparent p-6 flex gap-4 items-start shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/30">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide mb-1">Dossier rejeté</h3>
            <p className="text-white/80 leading-relaxed font-medium">{data.kycRejectedReason}</p>
          </div>
        </div>
      )}

      {/* Documents Section */}
      <div>
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-2 h-8 rounded-full bg-action-primary" />
          <h2 className="text-2xl font-bold text-white">Documents justificatifs</h2>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { src: docs.selfie, label: "Selfie Portrait" },
            { src: docs.selfieWithId, label: "Selfie + Pièce d'identité" },
            { src: docs.idFront, label: "Pièce d'identité — Recto" },
            { src: docs.idBack, label: "Pièce d'identité — Verso" }
          ].map((doc, idx) => (
            <div key={idx} className="group flex flex-col gap-3">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 bg-black/40 shadow-xl transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:shadow-action-primary/20">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
                <ImageLightbox src={doc.src} label={doc.label} />
              </div>
              <div className="px-2">
                <span className="inline-flex px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white/70 shadow-sm">
                  {doc.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action Bar (Only for pending) */}
      {isPending && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl p-3 md:p-4 border border-white/10 bg-[#1A1A1A]/80 backdrop-blur-2xl shadow-2xl shadow-black/50 rounded-[2rem] z-50">
          {showRejectForm ? (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
              <div className="relative">
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Veuillez expliquer la raison du rejet. Ce message sera envoyé à l'utilisateur..."
                  rows={3}
                  className="w-full rounded-2xl bg-black/40 border border-white/10 px-5 py-4 text-sm outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 resize-none text-white font-medium placeholder:text-white/30"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="flex-1 py-4 rounded-xl border border-white/10 font-bold text-sm hover:bg-white/5 transition-colors text-white/70 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={rejectReason.trim().length < 3 || rejectMut.isPending}
                  onClick={() => rejectMut.mutate(rejectReason.trim())}
                  className="flex-[2] py-4 rounded-xl bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-red-500/20"
                >
                  {rejectMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  Confirmer le rejet
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                className="flex-1 py-4.5 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-500/10 hover:border-red-500/40 transition-all active:scale-[0.98]"
              >
                <XCircle className="w-5 h-5" />
                Rejeter le dossier
              </button>
              <button
                type="button"
                disabled={approveMut.isPending}
                onClick={() => approveMut.mutate()}
                className="flex-[1.5] py-4.5 rounded-2xl bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#10B981]/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {approveMut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Approuver & Vérifier le profil
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
