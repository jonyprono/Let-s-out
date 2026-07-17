import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Bot, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AdminBotPrompts() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('');

  const { data: bots, isLoading } = useQuery({
    queryKey: ['admin', 'bots'],
    queryFn: async () => {
      const { data } = await apiClient.get('/chat/admin/bots');
      return data as any[];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, prompt }: { id: string; prompt: string }) => {
      await apiClient.put(`/chat/admin/bots/${id}`, { botPrompt: prompt });
    },
    onSuccess: () => {
      toast.success('Prompt mis à jour avec succès');
      queryClient.invalidateQueries({ queryKey: ['admin', 'bots'] });
      setEditingId(null);
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    }
  });

  const handleEdit = (bot: any) => {
    setEditingId(bot.id);
    setEditPrompt(bot.botPrompt || '');
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, prompt: editPrompt });
  };

  if (isLoading) {
    return <div className="p-8 text-white/50">Chargement des agents...</div>;
  }

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Bot className="w-6 h-6 text-action-primary" />
          Configuration des Agents IA
        </h1>
        <p className="text-white/60">Modifiez la personnalité et les instructions de chaque agent de support.</p>
      </div>

      <div className="space-y-6">
        {bots?.map((bot) => (
          <div key={bot.id} className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#111]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-[#222]">
                  <img src={bot.profile?.avatarUrl || ''} alt={bot.profile?.displayName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{bot.profile?.displayName}</h3>
                  <p className="text-sm text-action-primary">{bot.profile?.bio || 'Agent de support'}</p>
                </div>
              </div>
              
              {editingId !== bot.id ? (
                <button 
                  onClick={() => handleEdit(bot)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  Modifier le Prompt
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-transparent text-white/50 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={() => handleSave(bot.id)}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-action-primary text-black rounded-xl text-sm font-bold hover:bg-action-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              )}
            </div>

            <div className="p-5">
              {editingId === bot.id ? (
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Instructions Système (Prompt)</label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    className="w-full h-48 bg-[#111] border border-action-primary/30 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-action-primary resize-none"
                    placeholder="Entrez les instructions pour cet agent..."
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Instructions Actuelles</label>
                  <div className="bg-[#111] border border-white/5 rounded-xl p-4 text-white/80 text-sm whitespace-pre-wrap">
                    {bot.botPrompt || 'Aucun prompt défini. L\'agent utilisera un comportement par défaut.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
