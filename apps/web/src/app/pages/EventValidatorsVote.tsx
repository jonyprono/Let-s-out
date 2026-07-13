import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft01Icon } from 'hugeicons-react';

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

  const voteMut = useMutation({
    mutationFn: async ({ candidateId, vote }: { candidateId: string, vote: boolean }) => {
      await apiClient.post(`/events/${id}/validators/vote`, { candidateId, vote });
    },
    onSuccess: () => {
      toast.success('Vote enregistré');
      qc.invalidateQueries({ queryKey: ['events', id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur lors du vote'),
  });

  if (isLoading) {
    return <div className="w-full h-full flex items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b]"><div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#FF7A00] animate-spin" /></div>;
  }

  if (!event || event.validatorVoteStatus !== 'OPEN') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F9F9F9] dark:bg-[#0a0a0b] p-4">
        <h2 className="text-xl font-bold dark:text-white mb-2">Vote terminé ou inexistant</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-[#FF7A00] text-white rounded-lg">Retour</button>
      </div>
    );
  }

  const attendees = attendeesData?.data || [];
  const candidates = attendees.filter((a: any) => event.validatorCandidates?.includes(a.userId));

  return (
    <div className="flex flex-col w-full h-full bg-[#F9F9F9] dark:bg-[#0a0a0b] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-20 flex flex-col bg-white/80 dark:bg-[#0a0a0b]/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-white dark:bg-black rounded-lg shadow-sm border border-gray-100 dark:border-gray-800">
            <ArrowLeft01Icon className="w-5 h-5 text-gray-700 dark:text-white" />
          </button>
          <span className="ml-3 font-semibold text-gray-900 dark:text-white">Vote des validateurs</span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div className="bg-[#FFF2D3] dark:bg-[#332200] p-4 rounded-xl text-sm text-[#CC6600] dark:text-[#FFB366]">
          Approuvez-vous ces participants comme validateurs de la cagnotte ? 
          Chaque candidat doit obtenir {Math.round((event.validatorThreshold || 0.5) * 100)}% de "Oui" pour être validé.
        </div>

        {candidates.map((cand: any) => {
          const isAccepted = event.validatorIds?.includes(cand.userId);

          return (
            <div key={cand.userId} className="bg-white dark:bg-[#1A1A1A] p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img src={cand.user?.profile?.avatarUrl || `https://ui-avatars.com/api/?name=${cand.user?.profile?.displayName}`} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="font-semibold dark:text-white">{cand.user?.profile?.displayName}</p>
                  <p className="text-sm text-gray-500">@{cand.user?.username}</p>
                </div>
                {isAccepted && (
                  <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs font-bold px-2 py-1 rounded-full">
                    Validé
                  </span>
                )}
              </div>

              {!isAccepted && (
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => voteMut.mutate({ candidateId: cand.userId, vote: true })}
                    disabled={voteMut.isPending}
                    className="flex-1 py-2 bg-gray-50 dark:bg-[#2A2A2A] hover:bg-green-50 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400 font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    Oui
                  </button>
                  <button 
                    onClick={() => voteMut.mutate({ candidateId: cand.userId, vote: false })}
                    disabled={voteMut.isPending}
                    className="flex-1 py-2 bg-gray-50 dark:bg-[#2A2A2A] hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 font-medium rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                  >
                    Non
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
