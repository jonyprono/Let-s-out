import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { Ban, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EventPayoutApproval() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((state: any) => state.user);

  const [sheetState, setSheetState] = useState<'none' | 'approve' | 'refuse'>('none');
  const [note, setNote] = useState('');
  const [successState, setSuccessState] = useState<'none' | 'approved' | 'refused'>('none');

  const { data: event, isLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const approvePayoutMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${id}/payout/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      setSheetState('none');
      setSuccessState('approved');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors de l'approbation")
  });

  const refusePayoutMut = useMutation({
    mutationFn: async (reason: string) => apiClient.post(`/events/${id}/payout/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      setSheetState('none');
      setSuccessState('refused');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors du refus")
  });

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" />
      </div>
    );
  }

  if (!event || !event.payoutRequest) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b] p-4">
        <p className="text-gray-500 mb-4">Aucune demande de déblocage trouvée pour cet événement.</p>
        <Button onClick={() => navigate(`/events/${id}`)} className="bg-[#FF7A00] text-white">Retour à l'événement</Button>
      </div>
    );
  }

  const payoutReq = event.payoutRequest;
  const collected = event.poolCollected ?? 0;
  const commission = Math.round(collected * 0.10);
  const totalToReceive = collected - commission;

  const isCoHost = event.coHostIds?.includes(me?.id);
  const isValidator = event.validatorIds?.includes(me?.id);
  const isApprover = !!me?.id && me.id !== event.creatorId && (isCoHost || isValidator);
  const hasApproved = payoutReq.approvals?.includes(me?.id);
  const isRejected = payoutReq.status === 'REJECTED';

  const initiatorName = event.creator?.profile?.displayName || event.creator?.username || "L'organisateur";
  const requestDate = new Date(payoutReq.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });

  if (successState !== 'none') {
    const isApprove = successState === 'approved';
    return (
      <div className="w-full h-[100dvh] bg-[#F9F9F9] dark:bg-[#0a0a0b] flex flex-col items-center justify-between p-6">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full max-w-sm">
          {isApprove ? (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E0F98A] to-[#14C93F] flex items-center justify-center shadow-sm">
              <Check className="text-white w-10 h-10 stroke-[3px]" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-transparent border-4 border-[#FF5B5B] flex items-center justify-center">
              <Ban className="text-[#FF5B5B] w-12 h-12 stroke-[2.5px]" />
            </div>
          )}

          <h2 className={`text-[20px] font-bold ${isApprove ? 'text-[#14C93F]' : 'text-[#FF5B5B]'}`}>
            {isApprove ? 'Retrait approuvé !' : 'Déblocage refusé !'}
          </h2>
          <p className="text-center text-[14px] text-gray-600 dark:text-gray-400 font-medium">
            {isApprove 
              ? "Top! Votre validation de déblocage des fonds a été bien pris en compte."
              : "Le refus de déblocage des fonds a été bien pris en compte."}
          </p>
        </div>
        
        <Button 
          onClick={() => navigate(`/events/${id}`)}
          className="w-full h-14 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold text-[16px] shadow-sm active:scale-[0.98] transition-transform pb-safe"
        >
          Retour à la cagnotte
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-hidden relative">
      {/* Header */}
      <div className="flex-none flex items-center px-4 py-3 bg-[#F9F9F9] dark:bg-[#0a0a0b] z-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={() => navigate(`/events/${id}`)} className="w-9 h-9 -ml-2 flex items-center justify-center bg-transparent active:scale-95 transition-transform">
          <ArrowLeft01Icon className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <span className="ml-2 font-bold text-[16px] text-gray-900 dark:text-white">Demande de déblocage de fonds</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 px-4 font-poppins flex flex-col gap-6 relative z-10">
        
        {/* Yellow Card */}
        <div className="w-full bg-gradient-to-r from-[#FFF2D3] to-[#FFFBA6] rounded-[10px] p-4 flex flex-col gap-3 shadow-sm shrink-0">
          <h3 className="font-medium text-[16px] text-[#1B1818] line-clamp-1">{event.title}</h3>
          <div className="flex justify-between items-center w-full mt-2">
            <span className="text-[14px] text-[#737373]">Montant du retrait</span>
            <span className="text-[15px] font-bold text-[#FF7A00]">{totalToReceive.toLocaleString('fr-FR')} F</span>
          </div>
        </div>

        {/* Détails Section */}
        <div className="flex flex-col gap-4">
          <h4 className="text-[14px] font-semibold text-gray-900 dark:text-white">Détails</h4>
          <div className="w-full h-[1px] border-b border-dashed border-gray-200 dark:border-gray-800" />
          
          <div className="flex flex-col gap-3.5">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-gray-500">Evénement</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-white max-w-[180px] text-right truncate">{event.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-gray-500">Cagnotte</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-white">Frais Généraux</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-gray-500">Initiateur</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-white">{initiatorName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-gray-500">Date de la demande</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-white">{requestDate}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[14px] font-medium text-gray-500">Montant du retrait</span>
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">{totalToReceive.toLocaleString('fr-FR')} F</span>
            </div>
          </div>
        </div>

        {/* Explanatory text requested by user */}
        <div className="bg-blue-50 dark:bg-blue-900/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
          <p className="text-[13px] text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
            Le transfert sera exécuté automatiquement dès que tous les co-organisateurs et validateurs auront approuvé.
          </p>
        </div>

        {/* Current status display if already answered */}
        {(!isApprover || hasApproved || isRejected) && (
          <div className="mt-4 flex flex-col items-center p-4 bg-gray-50 dark:bg-[#1A1A1A] rounded-xl">
            {!isApprover ? (
              <span className="text-gray-500 text-sm">Non autorisé</span>
            ) : hasApproved ? (
              <span className="text-green-600 font-semibold text-sm">Vous avez approuvé cette demande</span>
            ) : isRejected ? (
              <span className="text-red-500 font-semibold text-sm">Demande refusée</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Action Footer */}
      {isApprover && !hasApproved && !isRejected && (
        <div className="absolute bottom-0 left-0 w-full px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[#F9F9F9] via-[#F9F9F9] to-transparent dark:from-[#0a0a0b] dark:via-[#0a0a0b] z-20 flex gap-3">
          <button
            onClick={() => { setSheetState('refuse'); setNote(''); }}
            className="flex-1 h-14 rounded-full bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Ban className="w-5 h-5 opacity-60" />
            Refuser
          </button>
          <button
            onClick={() => { setSheetState('approve'); setNote(''); }}
            className="flex-1 h-14 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            Approuver
          </button>
        </div>
      )}

      {/* Bottom Sheet Backdrop */}
      {sheetState !== 'none' && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 transition-opacity"
          onClick={() => setSheetState('none')}
        />
      )}

      {/* Bottom Sheet */}
      <div 
        className={`fixed left-0 right-0 bottom-0 bg-white dark:bg-[#1A1A1A] z-50 rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-transform duration-300 ease-in-out transform ${sheetState !== 'none' ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6" />
        
        <h3 className="text-[17px] font-bold text-center text-gray-900 dark:text-white mb-6">
          {sheetState === 'approve' ? 'Approuver le retrait ?' : 'Refuser le déblocage ?'}
        </h3>
        
        <p className="text-[14px] text-gray-600 dark:text-gray-400 mb-6 font-inter">
          {sheetState === 'approve' ? 'Approuver' : 'Refuser'} le déblocage de <span className="font-bold text-gray-900 dark:text-white">{totalToReceive.toLocaleString('fr-FR')} F</span> des fonds de la cagnotte <span className="font-bold text-gray-900 dark:text-white">Frais Généraux</span> de l'événement <span className="font-bold text-gray-900 dark:text-white">{event.title}</span> ?
        </p>

        <div className="mb-6">
          <label className="block text-[13px] text-gray-500 mb-2">
            {sheetState === 'approve' ? 'Note (optionnel)' : 'Motif du refus'}
          </label>
          <textarea 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={sheetState === 'approve' ? 'Ajouter une note...' : 'Indiquer le motif...'}
            className="w-full bg-white dark:bg-[#0a0a0b] border border-gray-200 dark:border-gray-800 rounded-xl p-3 text-[14px] text-gray-900 dark:text-white min-h-[100px] resize-none focus:outline-none focus:border-[#FF7A00] transition-colors"
          />
        </div>

        <Button 
          onClick={() => {
            if (sheetState === 'approve') {
              approvePayoutMut.mutate();
            } else {
              refusePayoutMut.mutate(note);
            }
          }}
          disabled={approvePayoutMut.isPending || refusePayoutMut.isPending || (sheetState === 'refuse' && note.trim().length === 0)}
          className="w-full h-14 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold text-[16px] shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {approvePayoutMut.isPending || refusePayoutMut.isPending ? 'En cours...' : 'Confirmer'}
        </Button>
      </div>

    </div>
  );
}
