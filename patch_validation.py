import re

with open("apps/web/src/app/components/EventPoolValidation.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports: add AlertTriangle
imports_search = "import { ArrowLeft01Icon } from 'hugeicons-react';"
imports_inject = "import { ArrowLeft01Icon } from 'hugeicons-react';\nimport { AlertTriangle, ShieldX } from 'lucide-react';"
content = content.replace(imports_search, imports_inject)

# 2. Add queries and revokation logic
mut_search = """  const validateMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${id}/pool/validate`, {"""
mut_inject = """  const revokeMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${id}/pool/revoke-delegation`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', id] });
      toast.success('Délégation annulée avec succès');
      navigate(`/events/${id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || "Erreur lors de l'annulation")
  });

  const validateMut = useMutation({
    mutationFn: async () => apiClient.post(`/events/${id}/pool/validate`, {"""
content = content.replace(mut_search, mut_inject)

# 3. Add myBooking and power computing logic
render_search = """  // Sort attendees: validators first, then by display name
  const sortedAttendees = [...attendees]"""
render_inject = """  const myBooking = attendees.find((b: any) => b.userId === me.id);
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
  const sortedAttendees = [...attendees]"""
content = content.replace(render_search, render_inject)

# 4. Alter the main return UI to handle `hasDelegated`
ui_search = """      <div className="flex-1 overflow-y-auto pb-28 px-4 font-poppins flex flex-col gap-6 relative z-10">
        
        {/* Info Card */}"""
ui_inject = """      <div className="flex-1 overflow-y-auto pb-28 px-4 font-poppins flex flex-col gap-6 relative z-10">
        
        {hasDelegated ? (
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
        {/* Info Card */}"""
content = content.replace(ui_search, ui_inject)

# 5. Add closing tag for the `hasDelegated` condition just before footer
footer_search = """      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 w-full px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white dark:bg-[#1A1A1A] border-t border-gray-100 dark:border-gray-800 z-20">
        <Button 
          onClick={() => validateMut.mutate()}
          disabled={validateMut.isPending || (mode === 'DELEGATE' && !selectedDelegatee)}
          className="w-full h-14 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold text-[16px] shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {validateMut.isPending ? 'Enregistrement...' : 'Confirmer mon choix'}
        </Button>
      </div>"""
footer_inject = """          </>
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
      )}"""
content = content.replace(footer_search, footer_inject)

# 6. Add Concentration Warning for the selected delegatee
warning_search = """            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">"""
warning_inject = """            {selectedDelegatee && computeDelegateePower(selectedDelegatee) > 0.5 && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex gap-3 animate-in fade-in">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <p className="text-[13px] text-yellow-800 leading-snug">
                  <strong>Attention à la concentration :</strong> Ce participant représentera plus de 50% de la cagnotte si vous lui confiez votre voix.
                </p>
              </div>
            )}
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">"""
content = content.replace(warning_search, warning_inject)

with open("apps/web/src/app/components/EventPoolValidation.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched EventPoolValidation.tsx")
