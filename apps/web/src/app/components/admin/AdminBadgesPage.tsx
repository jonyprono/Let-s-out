import { useState, useRef } from 'react'
import { Plus, Pencil, Trash2, HelpCircle, Upload, Activity, Calendar, Star, Users, CheckCircle, Vote, Medal, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { chatApi } from '@/features/chat/api'

// Define the fields and their friendly names
const METRICS = [
  { value: 'eventsCreated', label: 'Événements Créés', icon: Calendar },
  { value: 'eventsJoined', label: 'Événements Rejoints', icon: Activity },
  { value: 'friendsCount', label: 'Amis (Acceptés)', icon: Users },
  { value: 'rating', label: 'Note Moyenne (Étoiles)', icon: Star },
  { value: 'accountAgeDays', label: 'Ancienneté (Jours)', icon: CheckCircle },
  { value: 'votesParticipated', label: 'Votes Participés', icon: Vote },
  { value: 'timesAppointedValidator', label: 'Désigné Validateur', icon: ShieldCheck },
  { value: 'validationsPerformed', label: 'Validations Effectuées', icon: Medal },
]

const OPERATORS = [
  { value: 'EQ', label: 'Égal à (=)' },
  { value: 'GT', label: 'Supérieur à (>)' },
  { value: 'GTE', label: 'Sup. ou égal à (≥)' },
  { value: 'LT', label: 'Inférieur à (<)' },
  { value: 'LTE', label: 'Inf. ou égal à (≤)' },
]

const EMOJI_LIST = ['🏅', '🏆', '🚀', '⭐', '🎉', '🎁', '🎖️', '⏰', '🤗', '✅', '👑', '🔥', '💎', '💡', '🌟', '🛡️', '🎧', '🤝', '🌎', '⚡']

type Rule = { field: string; operator: string; value: number }
type ConditionLogic = { type: 'AND' | 'OR'; rules: Rule[] }

type Badge = {
  id: string
  name: string
  description: string
  icon: string
  category: 'standard' | 'rare' | 'legendary'
  xpReward: number
  conditionsLogic: ConditionLogic
  isActive: boolean
  endDate?: string | null
}

// Hexagon wrapper for preview
const Hexagon = ({ color, children, size = 'w-16 h-16' }: { color: string, children: React.ReactNode, size?: string }) => (
  <div className={`relative ${size} flex items-center justify-center`}>
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-md" style={{ fill: color }}>
      <path d="M50 0 L93.3 25 L93.3 75 L50 100 L6.7 75 L6.7 25 Z" />
    </svg>
    <div className="relative z-10 text-2xl">
      {typeof children === 'string' && children.startsWith('http') ? (
        <img src={children} alt="icon" className="w-1/2 h-1/2 object-contain" />
      ) : (
        children
      )}
    </div>
  </div>
)

export function AdminBadgesPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBadge, setEditingBadge] = useState<Partial<Badge>>({})
  const [iconMode, setIconMode] = useState<'emoji' | 'upload'>('emoji')
  const [isUploading, setIsUploading] = useState(false)

  const { data: badges = [], isLoading } = useQuery<Badge[]>({
    queryKey: ['admin-badges'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/badges')
      return res.data.data
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (badge: Partial<Badge>) => {
      if (badge.id) return apiClient.put(`/admin/badges/${badge.id}`, badge)
      return apiClient.post('/admin/badges', badge)
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
    }
  })

  const openModal = (badge?: Badge) => {
    if (badge) {
      setEditingBadge({ ...badge })
      setIconMode(badge.icon?.startsWith('http') ? 'upload' : 'emoji')
    } else {
      setEditingBadge({
        name: '',
        description: '',
        icon: '🏅',
        category: 'standard',
        xpReward: 100,
        isActive: true,
        endDate: null,
        conditionsLogic: { type: 'AND', rules: [{ field: 'eventsCreated', operator: 'GTE', value: 1 }] }
      })
      setIconMode('emoji')
    }
    setIsModalOpen(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const url = await chatApi.uploadMedia(file)
      setEditingBadge(prev => ({ ...prev, icon: url }))
      toast.success('Icône uploadée')
    } catch (err) {
      toast.error("Erreur d'upload")
    } finally {
      setIsUploading(false)
    }
  }

  const addRule = () => {
    setEditingBadge(prev => ({
      ...prev,
      conditionsLogic: {
        ...prev.conditionsLogic!,
        rules: [...(prev.conditionsLogic?.rules || []), { field: 'eventsCreated', operator: 'GTE', value: 1 }]
      }
    }))
  }

  const updateRule = (index: number, field: string, value: any) => {
    setEditingBadge(prev => {
      const rules = [...(prev.conditionsLogic?.rules || [])]
      rules[index] = { ...rules[index], [field]: value }
      return { ...prev, conditionsLogic: { ...prev.conditionsLogic!, rules } }
    })
  }

  const removeRule = (index: number) => {
    setEditingBadge(prev => {
      const rules = prev.conditionsLogic?.rules.filter((_, i) => i !== index) || []
      return { ...prev, conditionsLogic: { ...prev.conditionsLogic!, rules } }
    })
  }

  const categoryColors = {
    standard: '#3B82F6', // Blue
    rare: '#8B5CF6',     // Purple
    legendary: '#FBBF24' // Gold
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Moteur de Badges</h1>
          <p className="text-white/50 text-sm mt-1.5">Gérez les badges et leurs règles d'attribution automatiques.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-[#FF7A00] hover:bg-[#E86E00] text-black font-bold px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(255,122,0,0.35)] transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau Badge
        </button>
      </div>

      {isLoading ? (
        <div className="text-white/50 text-center py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-action-primary border-t-transparent rounded-full animate-spin"></div>
          Chargement des badges...
        </div>
      ) : badges.length === 0 ? (
        <div className="bg-[#111113]/80 border border-white/5 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6">
            <Medal className="w-10 h-10 text-white/20" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Aucun badge créé</h3>
          <p className="text-white/50 max-w-md mb-8">Les badges permettent de récompenser l'engagement de vos utilisateurs. Créez votre premier badge pour commencer !</p>
          <Button onClick={() => openModal()} className="bg-white/10 text-white hover:bg-white/20 border border-white/10">
            Créer un badge
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {badges.map(badge => (
            <div key={badge.id} className="bg-[#1A1A1A] border border-white/10 hover:border-white/20 transition-all rounded-[24px] p-6 flex flex-col group relative overflow-hidden shadow-xl">
              {/* Glow background based on category */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ backgroundColor: categoryColors[badge.category] }}></div>
              
              <div className="flex items-start justify-between relative z-10">
                <Hexagon color={categoryColors[badge.category]}>
                  {badge.icon}
                </Hexagon>
                <div className="flex gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.isActive ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                    {badge.isActive ? 'Actif' : 'Inactif'}
                  </span>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur rounded-lg border border-white/10">
                    <button onClick={() => openModal(badge)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-l-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => { if(confirm('Supprimer ce badge ?')) deleteMutation.mutate(badge.id) }} className="p-2 text-white/60 hover:text-red-500 hover:bg-white/10 rounded-r-lg transition-colors border-l border-white/5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              <div className="mt-5 relative z-10">
                <h3 className="text-[18px] font-bold text-white leading-tight">{badge.name}</h3>
                <p className="text-sm text-white/60 mt-2 line-clamp-2 min-h-[40px] leading-relaxed">{badge.description}</p>
              </div>
              
              <div className="mt-5 pt-5 border-t border-white/10 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-1 bg-white/5 rounded-md text-[11px] font-semibold text-white/70 capitalize border border-white/5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: categoryColors[badge.category] }}></span>
                    {badge.category}
                  </div>
                  <div className="px-2 py-1 bg-[#FF7A00]/10 text-[#FF7A00] rounded-md text-[11px] font-bold border border-[#FF7A00]/20">
                    +{badge.xpReward} XP
                  </div>
                </div>
                <div className="text-[10px] text-white/30 font-medium bg-black/20 px-2 py-1 rounded border border-white/5">
                  {badge.conditionsLogic?.rules?.length || 0} condition(s)
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && editingBadge && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 lg:p-10" style={{ overflowY: 'auto' }}>
          <div className="bg-[#111113] border border-white/10 rounded-[32px] w-full max-w-5xl overflow-hidden flex flex-col md:flex-row md:max-h-[90vh] my-auto shadow-2xl">
            
            {/* Left side: Form */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,122,0,0.3) transparent' }}>
              <div className="p-6 md:p-8 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{editingBadge.id ? 'Modifier le badge' : 'Créer un badge'}</h2>
                  <p className="text-white/50 text-sm">Configurez l'apparence et les règles d'attribution de ce badge.</p>
                </div>

                {/* Section: Informations */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">Informations Générales</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-white/90 mb-2 block">Nom du badge</label>
                      <input type="text" value={editingBadge.name} onChange={e => setEditingBadge({ ...editingBadge, name: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:border-action-primary focus:ring-1 focus:ring-action-primary rounded-xl px-4 py-3 text-white transition-all outline-none" placeholder="Ex: Top Créateur" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-white/90 mb-2 block">Description</label>
                      <textarea value={editingBadge.description} onChange={e => setEditingBadge({ ...editingBadge, description: e.target.value })} className="w-full bg-white/5 border border-white/10 focus:border-action-primary focus:ring-1 focus:ring-action-primary rounded-xl px-4 py-3 text-white transition-all outline-none min-h-[100px]" placeholder="Description affichée à l'utilisateur..." />
                    </div>
                  </div>
                </section>

                {/* Section: Visuel & Catégorie */}
                <section className="space-y-4">
                  <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest border-b border-white/10 pb-2">Visuel & Attributs</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Icon Selection */}
                    <div>
                      <label className="text-sm font-semibold text-white/90 mb-2 block flex justify-between">
                        Icône du badge
                        <div className="flex gap-2">
                          <button onClick={() => setIconMode('emoji')} className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${iconMode === 'emoji' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}>Emoji</button>
                          <button onClick={() => setIconMode('upload')} className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${iconMode === 'upload' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}>Image</button>
                        </div>
                      </label>
                      
                      {iconMode === 'emoji' ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 grid grid-cols-5 gap-2 max-h-[160px] overflow-y-auto">
                          {EMOJI_LIST.map(emoji => (
                            <button 
                              key={emoji} 
                              onClick={() => setEditingBadge({ ...editingBadge, icon: emoji })}
                              className={`h-10 rounded-lg text-xl flex items-center justify-center transition-all ${editingBadge.icon === emoji ? 'bg-action-primary/20 border border-action-primary/50 scale-110 z-10' : 'hover:bg-white/10 border border-transparent'}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="bg-white/5 border-2 border-dashed border-white/20 hover:border-action-primary/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all h-[160px]"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={handleFileUpload} />
                          {isUploading ? (
                            <div className="w-6 h-6 border-2 border-action-primary border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-white/30 mb-2" />
                              <span className="text-sm text-white/50 text-center">Cliquez pour uploader<br/><span className="text-xs text-white/30">(PNG, SVG, JPG)</span></span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Category & XP */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-white/90 mb-2 block">Catégorie</label>
                        <select 
                          value={editingBadge.category} 
                          onChange={e => setEditingBadge({ ...editingBadge, category: e.target.value as any })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="standard" className="bg-[#111113]">Standard (Bleu)</option>
                          <option value="rare" className="bg-[#111113]">Rare (Violet)</option>
                          <option value="legendary" className="bg-[#111113]">Légendaire (Or)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-white/90 mb-2 block">Récompense XP</label>
                        <div className="relative">
                          <input type="number" min="0" value={editingBadge.xpReward} onChange={e => setEditingBadge({ ...editingBadge, xpReward: parseInt(e.target.value) || 0 })} className="w-full bg-white/5 border border-white/10 focus:border-action-primary rounded-xl px-4 py-3 text-white transition-all outline-none pl-12" />
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">XP</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <label className="text-sm font-semibold text-white/90 cursor-pointer" htmlFor="isActive">Activer ce badge</label>
                        <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${editingBadge.isActive ? 'bg-action-primary' : 'bg-white/20'}`} onClick={() => setEditingBadge({ ...editingBadge, isActive: !editingBadge.isActive })}>
                          <div className={`w-4 h-4 rounded-full bg-black transition-transform ${editingBadge.isActive ? 'translate-x-6' : 'translate-x-0 bg-white'}`} />
                        </div>
                      </div>
                      <div className="pt-2">
                        <label className="text-sm font-semibold text-white/90 mb-2 block">
                          Date de fin de validité <span className="text-white/40 font-normal">(Optionnel)</span>
                        </label>
                        <input 
                          type="datetime-local" 
                          value={editingBadge.endDate ? new Date(new Date(editingBadge.endDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} 
                          onChange={e => setEditingBadge({ ...editingBadge, endDate: e.target.value ? new Date(e.target.value).toISOString() : null })} 
                          className="w-full bg-white/5 border border-white/10 focus:border-action-primary rounded-xl px-4 py-3 text-white transition-all outline-none" 
                        />
                        <p className="text-[10px] text-white/40 mt-1">Passé cette date, ce badge ne sera plus attribué (ex: Early Adopter).</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section: Conditions builder */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest flex items-center gap-2">
                      Règles d'attribution automatiques
                      <HelpCircle className="w-4 h-4 text-white/30" />
                    </h3>
                    <select 
                      value={editingBadge.conditionsLogic?.type}
                      onChange={e => setEditingBadge(p => ({...p, conditionsLogic: {...p.conditionsLogic!, type: e.target.value as any}}))}
                      className="bg-white/10 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value="AND" className="bg-black">Toutes les conditions (ET)</option>
                      <option value="OR" className="bg-black">Au moins une condition (OU)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    {editingBadge.conditionsLogic?.rules?.map((rule, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                        <div className="flex-1 w-full relative">
                          <select value={rule.field} onChange={e => updateRule(idx, 'field', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white appearance-none outline-none">
                            {METRICS.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full md:w-[160px]">
                          <select value={rule.operator} onChange={e => updateRule(idx, 'operator', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white appearance-none outline-none">
                            {OPERATORS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full md:w-[100px]">
                          <input type="number" value={rule.value} onChange={e => updateRule(idx, 'value', parseFloat(e.target.value) || 0)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none" />
                        </div>
                        <button onClick={() => removeRule(idx)} className="p-2.5 text-white/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    
                    {editingBadge.conditionsLogic?.rules?.length === 0 && (
                      <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-white/40 text-sm">
                        Attribution 100% manuelle. Aucune règle définie.
                      </div>
                    )}
                    
                    <button onClick={addRule} className="flex items-center gap-2 text-action-primary text-sm font-semibold hover:bg-action-primary/10 px-4 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-action-primary/30">
                      <Plus className="w-4 h-4" /> Ajouter une condition
                    </button>
                  </div>
                </section>
              </div>
            </div>

            {/* Right side: Preview & Actions */}
            <div className="w-full md:w-[360px] bg-[#0A0A0B] border-l border-white/5 p-6 md:p-8 flex flex-col">
              <h3 className="text-sm font-bold text-white/80 uppercase tracking-widest mb-6">Aperçu en direct</h3>
              
              <div className="flex-1 flex items-center justify-center">
                {/* Simulated App Card */}
                <div className="w-[180px] bg-white border border-gray-100 rounded-[20px] p-5 flex flex-col items-center text-center shadow-xl relative">
                  <div className="mb-4">
                    <Hexagon color={categoryColors[editingBadge.category || 'standard']} size="w-20 h-20">
                      {editingBadge.icon}
                    </Hexagon>
                  </div>
                  <span className="text-[14px] font-bold text-black leading-tight mb-2 min-h-[34px] flex items-center justify-center">
                    {editingBadge.name || 'Nom du badge'}
                  </span>
                  <span className="text-[11px] text-gray-500 leading-tight line-clamp-3 mb-4">
                    {editingBadge.description || 'Description du badge qui explique comment l\'obtenir.'}
                  </span>
                  <div className="mt-auto px-3 py-1.5 bg-[#FFF8F3] text-[#FF7A00] font-bold text-[10px] rounded-lg w-full border border-orange-100">
                    +{editingBadge.xpReward || 0} XP
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 space-y-3">
                <Button 
                  onClick={() => saveMutation.mutate(editingBadge as Partial<Badge>)} 
                  disabled={saveMutation.isPending || !editingBadge.name || !editingBadge.icon} 
                  className="w-full bg-action-primary text-black font-bold h-12 rounded-xl text-base hover:bg-action-primary/90"
                >
                  {saveMutation.isPending ? 'Enregistrement...' : (editingBadge.id ? 'Mettre à jour' : 'Créer le badge')}
                </Button>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="w-full text-white/60 hover:text-white h-12 rounded-xl">
                  Annuler
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
