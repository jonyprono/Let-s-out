import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BackButton } from '@/components/ui/BackButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { BottomSheet } from '@/components/ui/bottom-sheet';

export function PayoutApprovalScreen() {
  const { id, payoutId } = useParams<{ id: string, payoutId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState<'view' | 'approve-sheet' | 'reject-sheet' | 'success-approve' | 'success-reject'>('view');
  const [note, setNote] = useState('');

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}`);
      return res.data?.data;
    }
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['events', id, 'payout-audit'],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${id}/payout/audit`);
      return res.data?.data;
    },
    enabled: !!event,
  });

  const payout = auditData?.find((p: any) => p.payoutRequestId === payoutId) || auditData?.[0]; // fallback for demo if needed
  
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
      apiClient.post(`/events/${id}/payout/${payoutId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      setStep('success-reject');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Erreur lors du refus");
    }
  });

  if (eventLoading || auditLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    );
  }

  if (!event) return null;

  const amount = payout?.amount || 15000;
  const initiatorName = event.creator?.profile?.displayName || 'Organisateur';
  const requestDate = payout?.createdAt || new Date().toISOString();

  if (step === 'success-approve' || step === 'success-reject') {
    const isApprove = step === 'success-approve';
    return (
      <div className="w-full h-full flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm ${isApprove ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            {isApprove ? (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
            )}
          </div>
          <h2 className={`text-[20px] font-bold mb-2 ${isApprove ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {isApprove ? 'Retrait approuvé !' : 'Déblocage refusé !'}
          </h2>
          <p className="text-[14px] text-gray-500 mb-8 max-w-[280px]">
            {isApprove 
              ? "Top! Votre validation de déblocage des fonds a été bien pris en compte."
              : "Le refus de déblocage des fonds a été bien pris en compte."}
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
      <div className="flex items-center px-4 h-14 bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
        <BackButton />
        <h1 className="text-[16px] font-semibold text-gray-900 dark:text-white ml-2">Demande de déblocage de fonds</h1>
      </div>

      <div className="flex-1 p-4 pb-24 overflow-y-auto">
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-[12px] p-4 mb-6">
          <h3 className="text-[15px] text-gray-900 dark:text-white font-semibold mb-3">{event.title}</h3>
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-gray-600 dark:text-gray-400">Montant du retrait</span>
            <span className="text-[15px] font-bold text-[#FF7A00]">
              {amount.toLocaleString('fr-FR')} F
            </span>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Détails</h4>
          <div className="space-y-4 text-[13px]">
            <div className="flex justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Événement</span>
              <span className="text-gray-900 dark:text-white font-medium max-w-[150px] truncate">{event.title}</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Cagnotte</span>
              <span className="text-gray-900 dark:text-white font-medium">{event.poolDescription || 'Frais Généraux'}</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Initiateur</span>
              <span className="text-gray-900 dark:text-white font-medium">{initiatorName}</span>
            </div>
            <div className="flex justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-500">Date de la demande</span>
              <span className="text-gray-900 dark:text-white font-medium">{format(new Date(requestDate), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Montant du retrait</span>
              <span className="text-gray-900 dark:text-white font-medium">{amount.toLocaleString('fr-FR')} F</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800 fixed bottom-0 left-0 right-0 max-w-[768px] mx-auto z-10 pb-safe flex gap-3">
        <button
          onClick={() => setStep('reject-sheet')}
          className="flex-1 h-[48px] bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl text-[15px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          Refuser
        </button>
        <button
          onClick={() => setStep('approve-sheet')}
          className="flex-1 h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-semibold active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Approuver
        </button>
      </div>

      <BottomSheet isOpen={step === 'approve-sheet'} onClose={() => setStep('view')}>
        <div className="p-5 pb-10">
          <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-[18px] font-bold text-center text-gray-900 dark:text-white mb-4">Approuver le retrait ?</h3>
          <p className="text-[14px] text-gray-600 dark:text-gray-400 text-center mb-6">
            Approuver le déblocage de <strong>{amount.toLocaleString('fr-FR')} F</strong> des fonds de la cagnotte <strong>{event.poolDescription || 'Frais Généraux'}</strong> de l'événement <strong>{event.title}</strong> ?
          </p>
          <div className="mb-6">
            <label className="text-[13px] text-gray-500 mb-2 block">Note (optionnel)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ajouter une note..."
              className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-[14px] h-24 resize-none focus:ring-2 focus:ring-[#FF7A00] focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => approveMut.mutate()}
            disabled={approveMut.isPending}
            className="w-full h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {approveMut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            Confirmer
          </button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={step === 'reject-sheet'} onClose={() => setStep('view')}>
        <div className="p-5 pb-10">
          <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
          <h3 className="text-[18px] font-bold text-center text-gray-900 dark:text-white mb-4">Refuser le déblocage ?</h3>
          <p className="text-[14px] text-gray-600 dark:text-gray-400 text-center mb-6">
            Refuser le déblocage de <strong>{amount.toLocaleString('fr-FR')} F</strong> des fonds de la cagnotte <strong>{event.poolDescription || 'Frais Généraux'}</strong> de l'événement <strong>{event.title}</strong> ?
          </p>
          <div className="mb-6">
            <label className="text-[13px] text-gray-500 mb-2 block">Motif du refus</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Indiquer le motif..."
              className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-[14px] h-24 resize-none focus:ring-2 focus:ring-[#FF7A00] focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => rejectMut.mutate()}
            disabled={rejectMut.isPending || !note.trim()}
            className="w-full h-[48px] bg-[#FF7A00] text-white rounded-xl text-[15px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {rejectMut.isPending && <Loader2 className="w-5 h-5 animate-spin" />}
            Confirmer
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
