import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft01Icon } from 'hugeicons-react';
import { Search } from 'lucide-react';

export function ValidatorVoteForm({ event, attendees, onBack }: any) {
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(50);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const startVoteMut = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/events/${event.id}/validators/start`, {
        candidates: selectedCandidates,
        threshold: threshold / 100, // API expects e.g., 0.5
      });
    },
    onSuccess: () => {
      toast.success('Le vote a été lancé avec succès !');
      qc.invalidateQueries({ queryKey: ['events', event.id] });
      onBack();
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

  return (
    <div className="flex flex-col w-full h-full bg-[#F9F9F9] dark:bg-[#0a0a0b] absolute inset-0 z-10 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 flex flex-col bg-white/80 dark:bg-[#0a0a0b]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center px-4 py-3">
          <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-black rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <ArrowLeft01Icon className="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
          <span className="ml-3 font-semibold text-gray-900 dark:text-white">Vote des validateurs</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
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
            <span className="font-bold text-lg dark:text-white w-12 text-right">{threshold}%</span>
          </div>
        </div>

        <button
          onClick={() => startVoteMut.mutate()}
          disabled={selectedCandidates.length === 0 || startVoteMut.isPending}
          className="w-full h-[48px] bg-[#FF7A00] hover:bg-[#E66E00] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 mt-4 mb-8"
        >
          {startVoteMut.isPending ? 'Lancement...' : `Lancer le vote (${selectedCandidates.length} candidat${selectedCandidates.length > 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  );
}
