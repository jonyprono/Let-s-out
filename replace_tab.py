import re

with open("apps/web/src/app/components/ManageEvent.tsx", "r", encoding="utf-8") as f:
    content = f.read()

start_idx = content.find("function TabCagnotteInline")
end_idx = content.find("function TabCagnotteFullscreen", start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    exit(1)

new_component = """function TabCagnotteInline({ event, setStep, attendees }: { event: any, setStep: (s: any) => void, attendees: any[] }) {
  const qc = useQueryClient();
  const hasPot = event.poolTarget && event.poolTarget > 0;

  const [amountToWithdraw, setAmountToWithdraw] = useState<string>('');

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['events', event.id, 'payout-status'],
    queryFn: async () => {
      const res = await apiClient.get(`/events/${event.id}/payout/status`);
      return res.data?.data;
    },
    enabled: hasPot,
  });

  const payoutMut = useMutation({
    mutationFn: async (amount?: number) =>
      apiClient.post(`/events/${event.id}/payout/request`, amount ? { amount } : {}),
    onSuccess: () => {
      toast.success('Demande de déblocage envoyée avec succès');
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      refetchStatus();
      setAmountToWithdraw('');
    },
    onError: (err: any) => {
      if (err.response?.data?.details?.notifiedCount > 0) {
         toast.success(`${err.response.data.details.notifiedCount} participants ont été relancés.`);
         refetchStatus();
      } else {
         toast.error(err.response?.data?.error || 'Erreur lors du déblocage');
      }
    }
  });

  if (!hasPot) return null;

  const totalCollected = statusData?.totalCollected || 0;
  const totalWithdrawn = statusData?.totalWithdrawn || 0;
  const unlockedAmount = statusData?.unlockedAmount || 0;
  const pendingCount = statusData?.pendingCount || 0;
  const poolClosedAt = statusData?.poolClosedAt;

  const maxAvailableNow = Math.min(Math.max(0, unlockedAmount - totalWithdrawn), Math.max(0, totalCollected - totalWithdrawn));
  const totalBlocked = Math.max(0, totalCollected - unlockedAmount);
  
  const isPastDeadline = event.registrationDeadline 
    ? new Date() > new Date(event.registrationDeadline) 
    : new Date() > new Date(event.startAt);

  const handlePayoutClick = () => {
    if (!isPastDeadline) return toast.error("La date limite doit être passée avant de débloquer.");
    const amt = parseFloat(amountToWithdraw);
    if (isNaN(amt) || amt <= 0 || amt > maxAvailableNow) {
      return toast.error("Montant invalide.");
    }
    payoutMut.mutate(amt);
  };

  const handleRemindPending = () => {
    payoutMut.mutate(totalCollected + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Carte solde principal ── */}
      <div className="rounded-[12px] p-4 shadow-sm border bg-white dark:bg-[#1A1A1A] border-gray-100 dark:border-gray-800">
        <p className="text-[14px] text-gray-500 mb-1">Total collecté</p>
        <p className="text-[24px] font-bold text-gray-900 dark:text-white leading-tight">
          {totalCollected.toLocaleString('fr-FR')} F CFA
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
            <p className="text-[12px] text-green-700 dark:text-green-400">Total débloqué</p>
            <p className="text-[16px] font-bold text-green-700 dark:text-green-400">
              {unlockedAmount.toLocaleString('fr-FR')} F
            </p>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900/30">
            <p className="text-[12px] text-[#FF7A00]">Total bloqué</p>
            <p className="text-[16px] font-bold text-[#FF7A00]">
              {totalBlocked.toLocaleString('fr-FR')} F
            </p>
          </div>
        </div>
        
        {totalWithdrawn > 0 && (
          <p className="text-[12px] text-gray-500 mt-3 italic">
            Déjà retiré: {totalWithdrawn.toLocaleString('fr-FR')} F
          </p>
        )}
        
        {poolClosedAt && (
          <div className="mt-3 px-3 py-2 rounded-[8px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <span className="text-[14px] mt-0.5">🔒</span>
            <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">La cagnotte est fermée aux nouveaux versements.</p>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-[12px] p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <h4 className="text-[14px] font-semibold mb-3 text-gray-900 dark:text-white">Déblocage</h4>
        
        {maxAvailableNow > 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[12px] text-gray-500 mb-1 block">Montant à retirer (Max: {maxAvailableNow.toLocaleString('fr-FR')} F)</label>
              <input 
                type="number" 
                value={amountToWithdraw}
                onChange={(e) => setAmountToWithdraw(e.target.value)}
                placeholder="Montant"
                className="w-full bg-gray-50 dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-[14px] text-gray-900 dark:text-white focus:outline-none focus:border-[#FF7A00]"
              />
            </div>
            <button
              onClick={handlePayoutClick}
              disabled={payoutMut.isPending || !amountToWithdraw}
              className="w-full h-10 bg-[#10B981] hover:bg-[#10B981]/90 text-white rounded-lg text-[14px] font-bold active:scale-95 transition-transform disabled:opacity-50"
            >
              {payoutMut.isPending ? "Traitement..." : "Retirer les fonds"}
            </button>
          </div>
        ) : (
          <p className="text-[13px] text-gray-500 text-center py-2">
            Aucun fond n'est disponible pour le retrait.
          </p>
        )}

        {pendingCount > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
             <button
                onClick={handleRemindPending}
                disabled={payoutMut.isPending}
                className="w-full h-10 border border-[#FF7A00] text-[#FF7A00] rounded-lg text-[14px] font-semibold active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Relancer les {pendingCount} indécis
             </button>
             <p className="text-[11px] text-gray-400 mt-2 text-center">
               Envoie une notification aux participants n'ayant pas encore validé.
             </p>
          </div>
        )}
      </div>

    </div>
  );
}

// ----------------------------------------------------------------------
"""

new_content = content[:start_idx] + new_component + content[end_idx:]

with open("apps/web/src/app/components/ManageEvent.tsx", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Done replacing TabCagnotteInline")
