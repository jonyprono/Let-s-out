import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { useAuthStore } from '@/stores/auth.store';

import { Button } from '@/components/ui/button';

const VoteBoxIcon = () => (
  <svg width="77" height="128" viewBox="0 0 77 128" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[77px] h-[128px]">
    <path d="M65.0108 55.3145L41.572 126.662L39.2642 128L62.7029 56.6454L65.0108 55.3145Z" fill="#455A64"/>
    <path d="M39.264 128L38.1223 127.34L61.555 55.9922L62.7028 56.6455L39.264 128Z" fill="#263238"/>
    <path d="M71.6045 109.323L70.4628 108.67L47.366 64.6621L48.5138 65.3215L71.6045 109.323Z" fill="#263238"/>
    <path d="M50.8215 63.9844L73.9184 107.992L71.6105 109.323L48.5137 65.3154L50.8215 63.9844Z" fill="#455A64"/>
    <path d="M32.6763 36.6426L9.23755 107.991L6.92969 109.322L30.3684 37.9736L32.6763 36.6426Z" fill="#455A64"/>
    <path d="M6.9298 109.322L5.78809 108.669L29.2268 37.3145L30.3685 37.9738L6.9298 109.322Z" fill="#263238"/>
    <path d="M39.2703 90.6517L38.1286 89.9923L15.0317 45.9844L16.1796 46.6438L39.2703 90.6517Z" fill="#263238"/>
    <path d="M18.4873 45.3086L41.5841 89.3165L39.2702 90.6536L16.1794 46.6457L18.4873 45.3086Z" fill="#455A64"/>
    <path d="M36.9623 73.3187L0 51.9802L39.2701 29.3047L76.2385 50.6432L36.9623 73.3187Z" fill="#455A64"/>
    <path d="M36.9624 75.9862V73.3181L76.2386 50.6426V53.3106L36.9624 75.9862Z" fill="#37474F"/>
    <path d="M36.9623 75.987V73.3189L0 51.9805L0.0122135 54.6363L36.9623 75.987Z" fill="#263238"/>
    <path d="M36.9806 70.6527V38.648L5.50098 20.5332V52.5378L36.9806 70.6527Z" fill="#FF7A00"/>
    <path d="M36.9807 38.6455L70.7437 19.1387V51.1494L36.9807 70.6502V38.6455Z" fill="#FF7A00"/>
    <path opacity="0.15" d="M36.9807 38.6455L70.7437 19.1387V51.1494L36.9807 70.6502V38.6455Z" fill="white"/>
    <path d="M36.9806 38.6474L4.61572 20.0197L39.264 0L71.6228 18.6277L36.9806 38.6474Z" fill="#FF7A00"/>
    <path opacity="0.3" d="M36.9806 38.6474L4.61572 20.0197L39.264 0L71.6228 18.6277L36.9806 38.6474Z" fill="white"/>
    <path d="M36.9806 38.6452V44.3599L4.61572 25.7384V20.0176L36.9806 38.6452Z" fill="#FF7A00"/>
    <path d="M71.6229 18.627L36.9807 38.6466V44.3613L71.6229 24.3477V18.627Z" fill="#FF7A00"/>
    <path opacity="0.15" d="M71.6229 18.627L36.9807 38.6466V44.3613L71.6229 24.3477V18.627Z" fill="white"/>
    <path opacity="0.1" d="M5.53174 26.2475V27.5052L37.0113 45.62V44.3623L5.53174 26.2475ZM70.7743 24.8555L37.0113 44.3928V45.6506L70.7743 26.1132V24.8555Z" fill="black"/>
    <path d="M27.719 22.6379L32.3408 25.306L48.5141 15.9647L43.8923 13.3027L27.719 22.6379Z" fill="#FF7A00"/>
    <path opacity="0.2" d="M47.36 16.6363L48.5139 15.9647L43.8921 13.3027L43.8982 14.6459L47.36 16.6363Z" fill="black"/>
    <path opacity="0.1" d="M28.879 23.3034L43.8923 14.6337V13.3027L27.719 22.6379L28.879 23.3034Z" fill="black"/>
    <path d="M44.1789 57.1695L41.9993 50.2826L43.666 49.3241L44.6063 52.6393C44.9848 53.9459 45.1313 54.4709 45.1374 54.5198H45.168C45.168 54.477 45.3206 53.7627 45.6869 52.0776L46.6394 47.6268L48.2268 46.7109L46.0472 56.1194L44.1789 57.1695Z" fill="#FAFAFA"/>
    <path d="M51.5298 44.6181C53.3981 43.5436 54.7474 44.5083 54.7474 46.9993C54.7474 49.4903 53.3981 52.0118 51.5298 53.1047C49.6616 54.1976 48.3062 53.2146 48.3062 50.7297C48.3062 48.2448 49.6616 45.6988 51.5298 44.6181ZM51.5298 51.2425C52.0824 50.8687 52.532 50.3618 52.8371 49.7686C53.1423 49.1754 53.2932 48.5148 53.276 47.8479C53.276 46.3826 52.5433 45.8759 51.5298 46.4559C50.9759 46.8312 50.5255 47.3401 50.2203 47.9356C49.9151 48.5311 49.7649 49.1939 49.7837 49.8627C49.7837 51.3158 50.5163 51.8287 51.5298 51.2425Z" fill="#FAFAFA"/>
    <path d="M58.3924 42.6327V48.9641L56.921 49.8127V43.4814L55.0588 44.5621V42.7304L60.2546 39.7266V41.5582L58.3924 42.6327Z" fill="#FAFAFA"/>
    <path d="M61.0178 39.3067L65.4687 36.7363V38.568L62.4831 40.2897V41.6878L64.6811 40.4179V42.0481L62.4831 43.318V44.8077L65.5358 43.0554V44.8871L61.0422 47.4819L61.0178 39.3067Z" fill="#FAFAFA"/>
    <path d="M47.9829 14.0596L46.5298 17.0879L32.3408 25.3058L29.3796 23.5963L37.3289 6.8125L47.9829 14.0596Z" fill="#FAFAFA"/>
  </svg>
);

export function EventValidatorsVote() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: attendeesData } = useQuery({
    queryKey: ['events', id, 'attendees'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/events/${id}/attendees`);
      return data;
    },
    enabled: !!id,
  });

  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const currentUser = useAuthStore.getState().user;
  const attendees = attendeesData?.data || [];
  const myBooking = attendees.find((a: any) => a.userId === currentUser?.id);
  const initialDelegatedTo = myBooking?.delegatedToId || null;
  
  const myDelegatedBookings = attendees.filter((b: any) => b.delegatedToId === currentUser?.id);
  const myAvailableAmount = myBooking?.remainingAmount ?? 0;
  const isValidatorForActiveDelegator = myDelegatedBookings.some((b: any) => (b.remainingAmount ?? 0) > 0);
  const canValidateOrDelegate = myAvailableAmount > 0 || isValidatorForActiveDelegator;

  useEffect(() => {
    if (initialDelegatedTo && !selectedCandidate) {
      setSelectedCandidate(initialDelegatedTo);
    }
  }, [initialDelegatedTo]);

  const handleSubmit = async () => {
    if (!selectedCandidate) return;

    setIsSubmitting(true);
    try {
      await apiClient.post(`/events/${id}/pool/validate`, { mode: 'DELEGATE', delegatedToId: selectedCandidate });
      toast.success('Choix enregistré');
      qc.invalidateQueries({ queryKey: ['events', id] });
      qc.invalidateQueries({ queryKey: ['events', id, 'attendees'] });
      setSuccessMessage(`Votre choix a été bien enregistré.\nL'organisateur sera notifié de votre décision.`);
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2500); // Hide success screen after a bit to show the list again
    } catch (err: any) {
      toast.error('Erreur lors de la soumission de votre choix');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]"><div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" /></div>;
  }

  if (!event || !['OPEN', 'CLOSED'].includes(event.validatorVoteStatus)) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b] p-4 pt-[env(safe-area-inset-top)]">
        <h2 className="text-xl font-bold dark:text-white mb-2">Vote inexistant</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-[#FF7A00] text-white rounded-lg">Retour</button>
      </div>
    );
  }

  const candidates = attendees.filter((a: any) => event.validatorCandidates?.includes(a.userId));
  


  const showSuccess = isSuccess;
  
  const hasChangedSelection = selectedCandidate !== initialDelegatedTo;

  return (
    <div className="flex flex-col w-full h-[100dvh] bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-hidden relative">
      {/* Header */}
      <div className="flex-none flex items-center px-4 py-3 bg-[#F9F9F9] dark:bg-[#0a0a0b] z-20" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 -ml-2 flex items-center justify-center bg-transparent">
          <ArrowLeft01Icon className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
        <span className="ml-2 font-bold text-[16px] text-gray-900 dark:text-white">Sélection des validateurs</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-28 px-4 font-poppins flex flex-col gap-5 relative z-10">
        
        {/* Event Card */}
        <div className="w-full h-[80px] bg-gradient-to-r from-[#FFF2D3] to-[#FFFBA6] rounded-[10px] p-4 flex flex-col gap-1 shadow-sm shrink-0">
          <h3 className="font-medium text-[16px] text-[#1B1818] line-clamp-1">{event.title}</h3>
          <div className="flex justify-between items-center w-full mt-auto">
            <span className="text-[14px] text-[#737373]">Cagnotte</span>
            <span className="text-[14px] font-bold text-[#FF7A00]">Frais généraux</span>
          </div>
        </div>

        {!canValidateOrDelegate ? (
          <div className="flex-1 flex flex-col items-center justify-center -mt-10 gap-6 animate-in fade-in zoom-in duration-500 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-2">
              <span className="text-2xl">🛡️</span>
            </div>
            <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">Aucune délégation requise</h3>
            <p className="text-[14px] text-gray-500 max-w-[280px]">
              La totalité de votre part a déjà été débloquée lors de précédents retraits. Vous n'avez plus de fonds en jeu à déléguer.
            </p>
            <button 
              onClick={() => navigate(-1)}
              className="mt-4 px-6 py-2 rounded-full bg-[#FF7A00] text-white hover:bg-[#FF7A00]/90"
            >
              Retour
            </button>
          </div>
        ) : showSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center -mt-10 gap-6 animate-in fade-in zoom-in duration-500">
            <VoteBoxIcon />
            <p className="text-center text-[14px] text-gray-900 dark:text-white font-medium max-w-[250px] leading-relaxed whitespace-pre-line">
              {successMessage}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-[#404040] dark:text-gray-400 font-inter leading-relaxed">
              Choisissez le participant à qui vous souhaitez déléguer la validation du déblocage des fonds de la cagnotte. Vous pouvez modifier votre choix à tout moment.
            </p>

            <div className="flex flex-col gap-1">
              {candidates.map((cand: any) => {

                return (
                  <button 
                    key={cand.userId} 
                    onClick={() => setSelectedCandidate(cand.userId)}
                    className={`w-full bg-[#FEFEFA] dark:bg-[#1A1A1A] border rounded-lg p-2.5 flex items-center gap-3 h-[52px] text-left transition-colors ${selectedCandidate === cand.userId ? 'border-[#FF7A00] bg-[#FF7A00]/5 dark:bg-[#FF7A00]/10' : 'border-[#F5F5F4] dark:border-gray-800'}`}
                  >
                    <img src={cand.user?.profile?.avatarUrl || `https://ui-avatars.com/api/?name=${cand.user?.profile?.displayName}`} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 bg-gray-100" />
                    
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <span className="text-[14px] text-[#1B1818] dark:text-white font-medium line-clamp-1">
                        {cand.user?.profile?.displayName} {initialDelegatedTo === cand.userId && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full ml-1">Choix actuel</span>}
                      </span>
                    </div>

                    <div className="flex items-center shrink-0 h-[28px] pr-1">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedCandidate === cand.userId ? 'border-[#FF7A00]' : 'border-gray-300 dark:border-gray-600'}`}>
                         {selectedCandidate === cand.userId && <div className="w-2.5 h-2.5 bg-[#FF7A00] rounded-full" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bottom Sticky Button */}
      {!showSuccess && (
        <div className="absolute bottom-0 left-0 w-full px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[#F9F9F9] via-[#F9F9F9] to-transparent dark:from-[#0a0a0b] dark:via-[#0a0a0b] z-20 flex flex-col gap-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedCandidate || !hasChangedSelection}
            className="w-full h-14 rounded-full bg-[#FF7A00] hover:bg-[#FF7A00]/90 text-white font-semibold text-[16px] shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {isSubmitting ? 'Enregistrement...' : hasChangedSelection ? 'Valider mon choix' : 'Choix actuel'}
          </Button>
        </div>
      )}
    </div>
  );
}
