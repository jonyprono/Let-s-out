import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2, Tag, User, Calendar, Banknote, ShieldCheck, ShieldX } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export function PayoutApprovalScreen() {
  const { id, payoutId } = useParams<{ id: string, payoutId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<'view' | 'approve-sheet' | 'reject-sheet' | 'success-approve' | 'success-reject'>('view');
  const [note, setNote] = useState('');

  // Fetch the payout request directly (includes reason, approvalsList, event)
  const { data: payoutReq, isLoading } = useQuery({
    queryKey: ['events', id, 'payout', payoutId],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}/payout/${payoutId}`);
      return res.data?.data;
    },
    enabled: !!id && !!payoutId,
  });

  const approveMut = useMutation({
    mutationFn: async () =>
      apiClient.post(`/events/${id}/payout/${payoutId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      setStep('success-approve');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Erreur lors de l'approbation");
    }
  });

  const rejectMut = useMutation({
    mutationFn: async () =>
      apiClient.post(`/events/${id}/payout/${payoutId}/reject`, { reason: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      setStep('success-reject');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Erreur lors du refus");
    }
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    );
  }

  if (!payoutReq) return null;

  const amount = payoutReq.amount ?? 0;
  const reason = payoutReq.reason ?? 'Non précisé';
  const initiatorName = payoutReq.event?.creator?.profile?.displayName ?? 'Organisateur';
  const requestDate = payoutReq.createdAt ?? new Date().toISOString();
  const eventTitle = payoutReq.event?.title ?? '';
  const poolDescription = payoutReq.event?.poolDescription ?? 'Frais Généraux';

  const approvals = payoutReq.approvalsList ?? [];
  const approvedCount = approvals.filter((a: any) => a.status === 'APPROVED').length;
  const totalApprovers = approvals.length;

  if (step === 'success-approve' || step === 'success-reject') {
    const isApprove = step === 'success-approve';
    return (
      <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm ${isApprove ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            {isApprove ? (
              <ShieldCheck className="w-10 h-10 text-[#10B981]" />
            ) : (
              <ShieldX className="w-10 h-10 text-[#EF4444]" />
            )}
          </div>
          <h2 className={`text-[20px] font-bold mb-2 ${isApprove ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {isApprove ? 'Retrait approuvé !' : 'Déblocage refusé !'}
          </h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-[280px]">
            {isApprove
              ? "Top ! Votre validation a bien été prise en compte."
              : "Le refus de déblocage a bien été enregistré."}
          </p>
          <button
            onClick={() => navigate(`/events/${id}/manage?tab=cagnotte`)}
            className="w-full max-w-sm h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-semibold active:scale-95 transition-transform"
          >
            Retour à la cagnotte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
      {/* Header */}
      <div className="flex items-center px-4 h-14 bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
        <BackButton />
        <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white ml-2">Demande de déblocage</h1>
      </div>

      <div className="flex-1 p-4 pb-28 overflow-y-auto space-y-4">
        {/* Amount hero card */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-[18px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{eventTitle}</p>
          <p className="text-[32px] font-bold text-gray-900 dark:text-white">
            {amount.toLocaleString('fr-FR')} <span className="text-[18px] text-gray-400">F CFA</span>
          </p>
          <p className="text-[12px] text-gray-400 mt-1">Demandé le {format(new Date(requestDate), 'dd MMMM yyyy', { locale: fr })}</p>
        </div>

        {/* Reason – highlighted prominently */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-[16px] p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
            <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Motif du déblocage</p>
            <p className="text-[15px] font-semibold text-gray-900 dark:text-white">{reason}</p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h4 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Détails</h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 flex justify-between">
                <span className="text-[13px] text-gray-500">Initiateur</span>
                <span className="text-[13px] text-gray-900 dark:text-white font-medium">{initiatorName}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Banknote className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 flex justify-between">
                <span className="text-[13px] text-gray-500">Cagnotte</span>
                <span className="text-[13px] text-gray-900 dark:text-white font-medium">{poolDescription}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1 flex justify-between">
                <span className="text-[13px] text-gray-500">Date de la demande</span>
                <span className="text-[13px] text-gray-900 dark:text-white font-medium">{format(new Date(requestDate), 'dd/MM/yyyy')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Approvals progress */}
        {totalApprovers > 0 && (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">Approbations</h4>
              <span className="text-[13px] font-bold text-[#FF7A00]">{approvedCount}/{totalApprovers}</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF7A00] rounded-full transition-all duration-500"
                style={{ width: `${totalApprovers > 0 ? (approvedCount / totalApprovers) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-3 space-y-2">
              {approvals.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      {a.user?.profile?.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-[13px] text-gray-700 dark:text-gray-300">
                      {a.user?.profile?.displayName ?? 'Inconnu'}
                    </span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    a.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    a.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    'bg-gray-100 text-gray-500 dark:bg-gray-800'
                  }`}>
                    {a.status === 'APPROVED' ? 'Approuvé' : a.status === 'REJECTED' ? 'Refusé' : 'En attente'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800 fixed bottom-0 left-0 right-0 max-w-[768px] mx-auto z-10 pb-safe flex gap-3">
        <button
          onClick={() => setStep('reject-sheet')}
          className="flex-1 h-[48px] bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl text-[15px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <ShieldX className="w-4 h-4" />
          Refuser
        </button>
        <button
          onClick={() => setStep('approve-sheet')}
          className="flex-1 h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-4 h-4" />
          Approuver
        </button>
      </div>

      {/* Approve Bottom Sheet */}
      <BottomSheet open={step === 'approve-sheet'} onClose={() => setStep('view')}>
        <div className="p-5 pb-10">
          <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-[18px] font-bold text-center text-gray-900 dark:text-white mb-2">Approuver le retrait ?</h3>
          <p className="text-[14px] text-gray-500 text-center mb-1">
            <strong className="text-gray-900 dark:text-white">{amount.toLocaleString('fr-FR')} F CFA</strong>
          </p>
          {/* Show the reason in the confirmation sheet too */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[13px] text-amber-700 dark:text-amber-400">Motif : <strong>{reason}</strong></p>
          </div>
          <div className="mb-5">
            <label className="text-[13px] text-gray-500 mb-2 block">Note (optionnel)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ajouter une note..."
              className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-[14px] h-20 resize-none focus:ring-2 focus:ring-[#FF7A00] focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => approveMut.mutate()}
            disabled={approveMut.isPending}
            className="w-full h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {approveMut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            Confirmer l'approbation
          </button>
        </div>
      </BottomSheet>

      {/* Reject Bottom Sheet */}
      <BottomSheet open={step === 'reject-sheet'} onClose={() => setStep('view')}>
        <div className="p-5 pb-10">
          <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-[18px] font-bold text-center text-gray-900 dark:text-white mb-4">Refuser le déblocage ?</h3>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-2.5 mb-5 flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-[13px] text-amber-700 dark:text-amber-400">Motif demandé : <strong>{reason}</strong></p>
          </div>
          <div className="mb-5">
            <label className="text-[13px] text-gray-500 mb-2 block">Motif du refus <span className="text-red-500">*</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Indiquer pourquoi vous refusez..."
              className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-[14px] h-24 resize-none focus:ring-2 focus:ring-[#FF7A00] focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => rejectMut.mutate()}
            disabled={rejectMut.isPending || !note.trim()}
            className="w-full h-[48px] bg-red-500 text-white rounded-xl text-[15px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {rejectMut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            Confirmer le refus
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
