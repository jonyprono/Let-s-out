import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { SafeImage } from '@/components/shared/SafeImage';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

export function EventPayoutApproval() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((state: any) => state.user);

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
      toast.success("Déblocage approuvé avec succès !");
      qc.invalidateQueries({ queryKey: ['events', id] });
      navigate(`/events/${id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors de l'approbation")
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
        <PrimaryButton onClick={() => navigate(`/events/${id}`)}>Retour à l'événement</PrimaryButton>
      </div>
    );
  }

  const collected = event.poolCollected ?? 0;
  const commission = Math.round(collected * 0.10);
  const totalToReceive = collected - commission;

  const isCoHost = event.coHostIds?.includes(me?.id);
  const isValidator = event.validatorIds?.includes(me?.id);
  const isApprover = !!me?.id && me.id !== event.creatorId && (isCoHost || isValidator);
  const hasApproved = event.payoutRequest.approvals?.includes(me?.id);
  
  // Calculate who needs to approve
  const requiredApprovers = new Set<string>();
  event.coHostIds?.forEach((uid: string) => uid !== event.creatorId && requiredApprovers.add(uid));
  event.validatorIds?.forEach((uid: string) => uid !== event.creatorId && requiredApprovers.add(uid));
  
  const totalApproversCount = requiredApprovers.size;
  const currentApprovalsCount = event.payoutRequest.approvals?.length || 0;

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#F9F9F9] dark:bg-[#0a0a0b]">
      {/* Header */}
      <div className="flex items-center px-4 py-4 bg-white dark:bg-[#1A1A1A] border-b border-gray-100 dark:border-gray-800 shrink-0 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-900 dark:text-white active:scale-95 transition-transform">
          <ArrowLeft01Icon size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-gray-900 dark:text-white flex-1 text-center pr-8">
          Approbation
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6" style={{ scrollbarWidth: 'none' }}>
        
        {/* Intro */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-[#F0FDF4] dark:bg-[#10B981]/10 rounded-full flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2">Demande de déblocage</h2>
          <p className="text-[14px] text-gray-500 max-w-[280px] mx-auto">
            L'organisateur de l'événement <span className="font-semibold text-gray-900 dark:text-white">"{event.title}"</span> a demandé à retirer les fonds.
          </p>
        </div>

        {/* Financial Details */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-4">Détails financiers</h3>
          
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-gray-500">Montant brut récolté</span>
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">{collected.toLocaleString('fr-FR')} F</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-gray-500">Frais de plateforme (10%)</span>
              <span className="text-[15px] font-bold text-red-500">-{commission.toLocaleString('fr-FR')} F</span>
            </div>
            
            <div className="w-full h-px bg-gray-100 dark:bg-gray-800 my-1 border-dashed" />
            
            <div className="flex justify-between items-center">
              <span className="text-[15px] font-semibold text-gray-900 dark:text-white">Montant net versé</span>
              <span className="text-[18px] font-bold text-[#10B981]">{totalToReceive.toLocaleString('fr-FR')} F</span>
            </div>
          </div>
        </div>

        {/* Approvals Progress */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-[16px] p-5 shadow-sm border border-gray-100 dark:border-gray-800 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">Status des approbations</h3>
            <span className="text-[13px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-full">
              {currentApprovalsCount} / {totalApproversCount}
            </span>
          </div>
          <p className="text-[13px] text-gray-500 mb-0">
            Le transfert sera exécuté automatiquement dès que tous les co-organisateurs et validateurs auront approuvé.
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800 pb-8 shrink-0">
        {!isApprover ? (
          <p className="text-center text-[13px] text-gray-500 font-medium">Vous n'êtes pas autorisé à approuver cette demande.</p>
        ) : hasApproved ? (
          <div className="w-full py-3.5 flex items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 font-semibold text-[15px] cursor-not-allowed">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Vous avez déjà approuvé
          </div>
        ) : (
          <PrimaryButton 
            onClick={() => approvePayoutMut.mutate()} 
            loading={approvePayoutMut.isPending}
            className="w-full !bg-[#10B981] active:!scale-95"
          >
            Confirmer et Approuver
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
