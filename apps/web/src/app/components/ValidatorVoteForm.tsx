import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { Search } from 'lucide-react';

export function ValidatorVoteForm({ event, attendees, onBack }: any) {
  const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(50);
  const [search, setSearch] = useState('');
  const [voteDeadline, setVoteDeadline] = useState('');
  const [showDeadlineInput, setShowDeadlineInput] = useState(false);
  const qc = useQueryClient();

  const startVoteMut = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/events/${event.id}/validators/start`, {
        candidates: selectedCandidates,
        threshold: threshold / 100, // API expects e.g., 0.5
        voteDeadline: voteDeadline ? new Date(voteDeadline).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      setStep('success');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors du lancement du vote'),
  });

  const toggleCandidate = (id: string) => {
    setSelectedCandidates(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const eligibleAttendees = attendees.filter((a: any) => a.userId !== event.creatorId);
  const filteredAttendees = eligibleAttendees.filter((a: any) => 
    a.user?.profile?.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    a.user?.username?.toLowerCase().includes(search.toLowerCase())
  );

  if (step === 'success') {
    return (
      <div className="flex flex-col w-full h-full bg-[#F9F9F9] dark:bg-[#0a0a0b] absolute inset-0 z-50 overflow-hidden items-center justify-center p-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#9EE83C] to-[#E3F962] rounded-full flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
        <h2 className="text-[24px] font-bold text-[#14C93F] mb-4">Vote lancé !</h2>
        <p className="text-center text-gray-500 text-[14px] leading-relaxed mb-8 max-w-[280px]">
          Les participants ont été notifiés. Les validateurs seront retenus dès la fin ou la cloture du vote.
        </p>
        <button
          onClick={onBack}
          className="w-full max-w-[320px] h-[48px] bg-[#FF7A00] text-white font-bold rounded-full transition-transform active:scale-95 shadow-sm"
        >
          Retour à la cagnotte
        </button>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div 
        className="flex flex-col w-full h-full bg-black/40 absolute inset-0 z-50 justify-end"
        onClick={() => setStep('select')}
      >
        <div 
          className="bg-white dark:bg-[#1C1C1E] w-full rounded-t-3xl pt-2 pb-8 px-6 animate-in slide-in-from-bottom-full duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6"></div>
          
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setStep('select')} className="text-gray-400">
              <ArrowLeft01Icon className="w-6 h-6" />
            </button>
            <h3 className="font-bold text-[16px] text-gray-900 dark:text-white">Lancer le vote des validateurs</h3>
            <div className="w-6"></div>
          </div>

          <div className="mb-6">
            <h4 className="text-[18px] font-bold text-gray-900 dark:text-white">{event.title}</h4>
            <p className="text-[14px] text-gray-500 mt-1">Cagnotte Frais généraux</p>
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-gray-800 my-6"></div>

          <p className="text-[14px] text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
            Lancer le vote de sélection des validateurs de confiance par les membres participants. Un sondage sera envoyé dans le groupe de discussion de l'événement.
          </p>

          {!showDeadlineInput ? (
            <button 
              onClick={() => setShowDeadlineInput(true)}
              className="flex items-center gap-2 text-[14px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#2A2A2A] px-4 py-2.5 rounded-full mb-8 hover:opacity-80 transition-opacity"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Ajouter une date limite de vote
            </button>
          ) : (
            <div className="flex flex-col mb-8">
              <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date et heure limite de vote</p>
              <input
                type="datetime-local"
                value={voteDeadline}
                onChange={e => setVoteDeadline(e.target.value)}
                className="w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-xl text-[14px] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white focus:outline-none focus:border-[#FF7A00]"
              />
            </div>
          )}

          <button
            onClick={() => startVoteMut.mutate()}
            disabled={startVoteMut.isPending}
            className="w-full h-[52px] bg-[#FF7A00] text-white font-bold rounded-full transition-transform active:scale-95 text-[15px] shadow-sm flex items-center justify-center"
          >
            {startVoteMut.isPending ? "Lancement..." : "Lancer le vote"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-[#F9F9F9] dark:bg-[#0a0a0b] absolute inset-0 z-40 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col bg-white dark:bg-[#0a0a0b] border-b border-gray-200 dark:border-gray-800 pt-12">
        <div className="flex items-center px-4 py-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-black rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <ArrowLeft01Icon className="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
          <span className="ml-3 font-semibold text-gray-900 dark:text-white">Vote des validateurs</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 pb-24">
        <div className="bg-white dark:bg-[#1A1A1A] p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-[15px] mb-2 dark:text-white">Sélection des candidats</h3>
          <p className="text-gray-500 text-[13px] mb-4">Choisissez les participants qui pourraient valider le déblocage des fonds. Un vote sera soumis à tous les participants.</p>
          
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Rechercher un participant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-gray-50 dark:bg-[#2A2A2A] text-sm border-none focus:ring-1 focus:ring-[#FF7A00] outline-none dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {filteredAttendees.length === 0 && <p className="text-center text-sm text-gray-500 py-4">Aucun participant trouvé.</p>}
            {filteredAttendees.map((att: any) => (
              <div key={att.userId} onClick={() => toggleCandidate(att.userId)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2A2A2A] cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedCandidates.includes(att.userId)} 
                  readOnly 
                  className="w-4 h-4 rounded border-gray-300 text-[#FF7A00] focus:ring-[#FF7A00]"
                />
                <img src={att.user?.profile?.avatarUrl || `https://ui-avatars.com/api/?name=${att.user?.profile?.displayName}`} alt="" className="w-8 h-8 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium dark:text-white">{att.user?.profile?.displayName}</p>
                  <p className="text-xs text-gray-500">@{att.user?.username}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#1A1A1A] p-4 rounded-xl border border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-[15px] mb-2 dark:text-white">Seuil de validation</h3>
          <p className="text-gray-500 text-[13px] mb-4">Pourcentage de "Oui" requis pour qu'un candidat soit accepté comme validateur.</p>
          
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="1" 
              max="100" 
              value={threshold} 
              onChange={e => setThreshold(Number(e.target.value))}
              className="flex-1 accent-[#FF7A00]"
            />
            <span className="font-bold text-gray-900 dark:text-white min-w-[3ch]">{threshold}%</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-[#0a0a0b] border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => {
            if (selectedCandidates.length === 0) return toast.error("Sélectionnez au moins un candidat");
            setStep('confirm');
          }}
          className="w-full h-12 bg-[#FF7A00] text-white font-semibold rounded-lg hover:bg-[#E66E00] transition-colors active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
