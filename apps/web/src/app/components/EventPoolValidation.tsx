import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { AlertTriangle, ShieldX } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/shared/SafeImage';

export function EventPoolValidation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useAuthStore((state: any) => state.user);

  const [mode, setMode] = useState<'VALIDATE' | 'DELEGATE'>('VALIDATE');
  const [selectedDelegatee, setSelectedDelegatee] = useState<string | null>(null);

  const { data: event, isLoading: isLoadingEvent } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: attendeesData, isLoading: isLoadingAttendees } = useQuery({
    queryKey: ['events', id, 'attendees'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}/attendees`);
      return data;
    },
    enabled: !!id,
  });

  const revokeMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${id}/pool/revoke-delegation`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      toast.success('Délégation annulée avec succès');
      navigate(`/events/${id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors de l'annulation")
  });

  const validateMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${id}/pool/validate`, {
      mode,
      delegatedToId: mode === 'DELEGATE' ? selectedDelegatee : undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      toast.success(mode === 'VALIDATE' ? 'Budget validé avec succès' : 'Validation déléguée');
      navigate(`/events/${id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors de la validation")
  });

  if (isLoadingEvent || isLoadingAttendees) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" />
      </div>
    );
  }

  if (!event) return null;

  const collected = event.poolCollected ?? 0;
  const attendees = Array.isArray(attendeesData) ? attendeesData : (attendeesData?.data || []);
  
  const myBooking = attendees.find((b: any) => b.userId === me.id);
  const myDelegatedBookings = attendees.filter((b: any) => b.delegatedToId === me.id);
  
  const myAvailableAmount = myBooking?.remainingAmount ?? 0;
  const isValidatorForActiveDelegator = myDelegatedBookings.some((b: any) => (b.remainingAmount ?? 0) > 0);
  const canValidateOrDelegate = myAvailableAmount > 0 || isValidatorForActiveDelegator;

  const hasDelegated = myBooking?.poolValidationStatus === 'DELEGATED' && myBooking?.delegatedToId;

  // Compute power for selected delegatee
  const computeDelegateePower = (userId: string) => {
    const theirOwn = attendees.find((b: any) => b.userId === userId)?.totalPaid || 0;
    const delegatedToThem = attendees
      .filter((b: any) => b.delegatedToId === userId && b.poolValidationStatus === 'DELEGATED')
      .reduce((sum: number, b: any) => sum + b.totalPaid, 0);
    // Add current user's contribution if they select this delegatee (since they are about to give it)
    const power = theirOwn + delegatedToThem + (myBooking?.totalPaid || 0);
    return power / (collected || 1);
  };

  // Sort attendees: validators first, then by display name
  const sortedAttendees = [...attendees]
    .map((b: any) => b.user || b)
    .filter((u: any) => u.id !== me.id) // Cannot delegate to self
    .sort((a, b) => {
      const aIsValidator = event.validatorIds?.includes(a.id);
      const bIsValidator = event.validatorIds?.includes(b.id);
      if (aIsValidator && !bIsValidator) return -1;
      if (!aIsValidator && bIsValidator) return 1;
      const aName = a.profile?.displayName || a.username || '';
      const bName = b.profile?.displayName || b.username || '';
      return aName.localeCompare(bName);
    });

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-hidden relative">
      {/* Header */}
      <div className="flex-none flex items-center px-4 py-3 bg-[#F9F9F9] dark:bg-[#0a0a0b] z-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={() => navigate(`/events/${id}`)} className="w-9 h-9 -ml-2 flex items-center justify-center bg-transparent active:scale-95 transition-transform">
          <ArrowLeft01Icon className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <span className="ml-2 font-bold text-[16px] text-gray-900 dark:text-white">Validation du budget</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 px-4 font-poppins flex flex-col gap-6 relative z-10">
        
        {!canValidateOrDelegate ? (
          <div className="mt-6 flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
              <ShieldX className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">Aucune validation requise</h3>
            <p className="text-[14px] text-gray-500">
              La totalité de votre part a déjà été débloquée lors de précédents retraits. Vous n'avez plus de fonds en jeu à valider.
            </p>
            <Button 
              onClick={() => navigate(`/events/${id}`)}
              className="mt-4 px-6 rounded-full bg-[#FF7A00] text-white hover:bg-[#FF7A00]/90"
            >
              Retour à l'événement
            </Button>
          </div>
        ) : hasDelegated ? (
          <div className="mt-6 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-2">
              <ShieldX className="w-8 h-8 text-[#FF7A00]" />
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">Vous avez délégué votre voix</h3>
            <p className="text-[14px] text-gray-500">
              Votre pouvoir de validation a été confié à un autre participant. 
              Vous pouvez révoquer cette délégation pour reprendre la main sur la validation de votre part.
            </p>
            
            <Button 
              onClick={() => revokeMut.mutate()}
              disabled={revokeMut.isPending}
              variant="outline"
              className="mt-4 w-full rounded-xl border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 h-14 font-semibold text-[15px]"
            >
              {revokeMut.isPending ? 'Annulation...' : 'Annuler ma délégation'}
            </Button>
          </div>
        ) : (
          <>
        {/* Info Card */}
        <div className="w-full bg-gradient-to-r from-[#FFF2D3] to-[#FFFBA6] rounded-[10px] p-4 flex flex-col gap-3 shadow-sm shrink-0 mt-2">
          <h3 className="font-medium text-[16px] text-[#1B1818] line-clamp-1">{event.title}</h3>
          <div className="flex justify-between items-center w-full mt-2">
            <span className="text-[14px] text-[#737373]">Budget collecté</span>
            <span className="text-[15px] font-bold text-[#FF7A00]">{collected.toLocaleString('fr-FR')} F</span>
          </div>
          <p className="text-[12px] text-gray-700 mt-2">
            L'organisateur souhaite débloquer le budget. En tant que participant, vous devez valider l'utilisation des fonds.
          </p>
        </div>

        {/* Action Selection */}
        <div className="flex flex-col gap-3 mt-2">
          <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white">Que souhaitez-vous faire ?</h4>
          
          <div 
            onClick={() => setMode('VALIDATE')}
            className={`p-4 rounded-xl border-2 transition-colors cursor-pointer flex items-center gap-3 ${mode === 'VALIDATE' ? 'border-[#FF7A00] bg-orange-50 dark:bg-[#FF7A00]/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A]'}`}
          >
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${mode === 'VALIDATE' ? 'border-[#FF7A00]' : 'border-gray-300'}`}>
              {mode === 'VALIDATE' && <div className="w-2.5 h-2.5 rounded-full bg-[#FF7A00]" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-[14px]">
                {(() => {
                  const myDelegatesCount = attendees.filter((b: any) => b.delegatedToId === me.id && b.poolValidationStatus === 'DELEGATED').length;
                  return myDelegatesCount > 0 
                    ? `Je valide pour moi et mes délégués (${myDelegatesCount + 1} parts)`
                    : "Je valide ma part";
                })()}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">Vous acceptez que l'organisateur utilise la contribution.</p>
            </div>
          </div>

          <div 
            onClick={() => setMode('DELEGATE')}
            className={`p-4 rounded-xl border-2 transition-colors cursor-pointer flex items-center gap-3 ${mode === 'DELEGATE' ? 'border-[#FF7A00] bg-orange-50 dark:bg-[#FF7A00]/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1A]'}`}
          >
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${mode === 'DELEGATE' ? 'border-[#FF7A00]' : 'border-gray-300'}`}>
              {mode === 'DELEGATE' && <div className="w-2.5 h-2.5 rounded-full bg-[#FF7A00]" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-[14px]">Je délègue ma validation</p>
              <p className="text-[12px] text-gray-500 mt-1">Vous confiez le droit de valider à un autre participant.</p>
            </div>
          </div>
        </div>

        {/* Delegate Selection */}
        {mode === 'DELEGATE' && (
          <div className="flex flex-col gap-3 mt-4">
            <h4 className="text-[14px] font-semibold text-gray-900 dark:text-white">Choisir un délégataire</h4>
            {selectedDelegatee && computeDelegateePower(selectedDelegatee) > 0.5 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-3 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-[13px] text-yellow-800 leading-snug">
                  <strong>Attention à la concentration :</strong> Ce participant représentera plus de 50% de la cagnotte si vous lui confiez votre voix.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {sortedAttendees.length === 0 ? (
                <p className="text-[13px] text-gray-500 italic">Aucun autre participant disponible.</p>
              ) : (
                sortedAttendees.map(user => (
                  <div 
                    key={user.id}
                    onClick={() => setSelectedDelegatee(user.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${selectedDelegatee === user.id ? 'border-[#FF7A00] bg-orange-50/50 dark:bg-[#FF7A00]/5' : 'border-gray-100 dark:border-gray-800'}`}
                  >
                    <SafeImage src={user.profile?.avatarUrl} alt={user.profile?.displayName || user.username || 'Avatar'} className="w-10 h-10 rounded-full bg-gray-200" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-medium text-gray-900 dark:text-white">{user.profile?.displayName || user.username}</span>
                      {event.validatorIds?.includes(user.id) && (
                        <span className="text-[11px] text-[#FF7A00] font-semibold mt-0.5">⭐ Validateur désigné</span>
                      )}
                    </div>
                    {selectedDelegatee === user.id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-[#FF7A00] flex items-center justify-center text-white text-[12px]">✓</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

          </>
        )}
      </div>

      {/* Footer */}
      {!hasDelegated && (
        <div className="absolute bottom-0 left-0 w-full px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800 z-20">
          <Button 
            onClick={() => validateMut.mutate()}
            disabled={validateMut.isPending || (mode === 'DELEGATE' && !selectedDelegatee)}
            className="w-full h-14 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold text-[16px] shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {validateMut.isPending ? 'Enregistrement...' : 'Confirmer mon choix'}
          </Button>
        </div>
      )}
    </div>
  );
}
