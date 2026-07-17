import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Bot, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export function AdminBotPrompts() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setExpandedId(bot.id);
    setEditPrompt(bot.botPrompt || '');
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, prompt: editPrompt });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-400 dark:text-white/50">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement des agents...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
          <Bot className="w-6 h-6 text-action-primary" />
          Configuration des Agents IA
        </h1>
        <p className="text-gray-500 dark:text-white/60 text-sm">Modifiez la personnalité et les instructions de chaque agent. Les changements sont appliqués immédiatement.</p>
      </div>

      <div className="space-y-4">
        {bots?.map((bot) => (
          <div key={bot.id} className="bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
            {/* Header */}
            <div
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedId(expandedId === bot.id ? null : bot.id)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-[#222]">
                  <img src={bot.profile?.avatarUrl || ''} alt={bot.profile?.displayName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">{bot.profile?.displayName}</h3>
                  <p className="text-sm text-action-primary font-medium">{bot.profile?.bio || 'Agent de support'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {editingId !== bot.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(bot); }}
                    className="px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-xl text-sm font-semibold transition-colors border border-gray-200 dark:border-white/10"
                  >
                    Modifier
                  </button>
                )}
                {expandedId === bot.id
                  ? <ChevronUp className="w-5 h-5 text-gray-400 dark:text-white/40" />
                  : <ChevronDown className="w-5 h-5 text-gray-400 dark:text-white/40" />
                }
              </div>
            </div>

            {/* Expanded content */}
            {expandedId === bot.id && (
              <div className="border-t border-gray-100 dark:border-white/10 p-5 bg-gray-50/50 dark:bg-black/20">
                {editingId === bot.id ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-wider">
                      Instructions Système (Prompt)
                    </label>
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      className="w-full h-48 bg-white dark:bg-[#111] border border-gray-200 dark:border-action-primary/30 rounded-xl p-4 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-action-primary resize-none transition-colors"
                      placeholder="Entrez les instructions pour cet agent..."
                    />
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-gray-500 dark:text-white/50 hover:text-gray-800 dark:hover:text-white rounded-xl text-sm font-semibold transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleSave(bot.id)}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-2 px-5 py-2 bg-action-primary text-white rounded-xl text-sm font-bold hover:bg-action-primary/90 transition-colors disabled:opacity-50"
                      >
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-wider mb-2">
                      Instructions Actuelles
                    </label>
                    <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-xl p-4 text-gray-600 dark:text-white/80 text-sm whitespace-pre-wrap">
                      {bot.botPrompt || 'Aucun prompt défini. L\'agent utilisera un comportement par défaut.'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
