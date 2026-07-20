import { useState } from 'react'
import { Plus, Pencil, Trash2, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

type Badge = {
  id: string
  name: string
  description: string
  icon: string
  conditionsLogic: any
  isActive: boolean
}

export function AdminBadgesPage() {
  const queryClient = useQueryClient()
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: badges = [], isLoading } = useQuery<Badge[]>({
    queryKey: ['admin-badges'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/badges')
      return res.data.data
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (badge: Partial<Badge>) => {
      if (badge.id) {
        return apiClient.put(`/admin/badges/${badge.id}`, badge)
      } else {
        return apiClient.post('/admin/badges', badge)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] })
      setIsModalOpen(false)
      toast.success('Badge sauvegardé avec succès')
    },
    onError: () => toast.error('Erreur lors de la sauvegarde du badge')
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/admin/badges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badges'] })
      toast.success('Badge supprimé')
    },
    onError: () => toast.error('Erreur lors de la suppression')
  })

  const openModal = (badge?: Badge) => {
    if (badge) {
      setEditingBadge(badge)
    } else {
      setEditingBadge({
        id: '',
        name: '',
        description: '',
        icon: '🏅',
        isActive: true,
        conditionsLogic: {
          type: 'AND',
          rules: [{ field: 'eventsCreated', operator: 'GTE', value: 1 }]
        }
      })
    }
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce badge ?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Moteur de Badges</h1>
          <p className="text-white/60 text-sm mt-1">Créez et gérez les badges et leurs règles d'attribution</p>
        </div>
        <Button onClick={() => openModal()} className="bg-action-primary text-black hover:bg-action-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Badge
        </Button>
      </div>

      {isLoading ? (
        <div className="text-white/50 text-center py-10">Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map(badge => (
            <div key={badge.id} className="bg-[#1A1A1A]/40 border border-white/10 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-2xl border border-white/5">
                  {badge.icon}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {badge.isActive ? 'Actif' : 'Inactif'}
                  </span>
                  <button onClick={() => openModal(badge)} className="p-1.5 text-white/40 hover:text-white transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(badge.id)} className="p-1.5 text-white/40 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mt-4">{badge.name}</h3>
              <p className="text-sm text-white/60 mt-1 line-clamp-2">{badge.description}</p>
              
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-xs text-white/40 mb-2 font-mono uppercase tracking-wider">Conditions ({badge.conditionsLogic?.type})</p>
                <div className="space-y-1.5">
                  {badge.conditionsLogic?.rules?.map((rule: any, i: number) => (
                    <div key={i} className="text-xs bg-white/5 px-2.5 py-1.5 rounded-md text-white/80 font-mono">
                      {rule.field} <span className="text-action-primary">{rule.operator}</span> {rule.value}
                    </div>
                  ))}
                  {(!badge.conditionsLogic?.rules || badge.conditionsLogic.rules.length === 0) && (
                    <div className="text-xs text-white/40 italic">Attribution manuelle uniquement</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && editingBadge && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111113] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editingBadge.id ? 'Modifier le badge' : 'Nouveau badge'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="text-sm font-semibold text-white/80 mb-1.5 block">Nom du badge</label>
                <input type="text" value={editingBadge.name} onChange={e => setEditingBadge({ ...editingBadge, name: e.target.value })} className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white" placeholder="Ex: Top Créateur" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">Icône (Emoji)</label>
                  <input type="text" value={editingBadge.icon} onChange={e => setEditingBadge({ ...editingBadge, icon: e.target.value })} className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white text-center text-xl" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white/80 mb-1.5 block">Statut</label>
                  <select value={editingBadge.isActive ? '1' : '0'} onChange={e => setEditingBadge({ ...editingBadge, isActive: e.target.value === '1' })} className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white">
                    <option value="1">Actif</option>
                    <option value="0">Inactif</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-white/80 mb-1.5 block">Description</label>
                <textarea value={editingBadge.description} onChange={e => setEditingBadge({ ...editingBadge, description: e.target.value })} className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white min-h-[80px]" placeholder="Description affichée à l'utilisateur" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-sm font-semibold text-white/80 block">Logique des conditions (JSON)</label>
                  <HelpCircle className="w-4 h-4 text-white/40" />
                </div>
                <p className="text-xs text-white/40 mb-2">Exemple: {`{"type":"AND","rules":[{"field":"eventsCreated","operator":"GTE","value":5}]}`}</p>
                <textarea 
                  value={JSON.stringify(editingBadge.conditionsLogic, null, 2)} 
                  onChange={e => {
                    try {
                      setEditingBadge({ ...editingBadge, conditionsLogic: JSON.parse(e.target.value) })
                    } catch (err) {
                      // Just allow typing invalid JSON temporarily
                      setEditingBadge({ ...editingBadge, conditionsLogic: e.target.value as any })
                    }
                  }} 
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-sm min-h-[150px]" 
                />
              </div>
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-[#111113]">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-white">Annuler</Button>
              <Button onClick={() => saveMutation.mutate({
                id: editingBadge.id || undefined,
                name: editingBadge.name,
                description: editingBadge.description,
                icon: editingBadge.icon,
                isActive: editingBadge.isActive,
                conditionsLogic: typeof editingBadge.conditionsLogic === 'string' ? JSON.parse(editingBadge.conditionsLogic) : editingBadge.conditionsLogic
              })} disabled={saveMutation.isPending} className="bg-action-primary text-black">
                {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
