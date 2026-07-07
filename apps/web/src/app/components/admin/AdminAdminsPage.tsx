import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminsApi, type AdminUser } from '@/features/admin/api/admins.api'
import { CountryPicker } from '@/components/shared/CountryPicker'
import { COUNTRIES } from '@/lib/countries'
import { usePhoneFormatter } from '@/lib/usePhoneFormatter'

export function AdminAdminsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  
  const [country, setCountry] = useState(COUNTRIES[0])
  const [name, setName] = useState('')
  const { displayValue: formattedPhone, rawValue: phone, handleChange: handlePhoneChange, reset: resetPhone } = usePhoneFormatter()

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: adminsApi.list,
  })

  const addMut = useMutation({
    mutationFn: () => adminsApi.add(`${country.code}${phone}`, name),
    onSuccess: () => {
      toast.success('Administrateur ajouté avec succès')
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] })
      setShowAdd(false)
      resetPhone()
      setName('')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Erreur lors de l'ajout")
    }
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => adminsApi.remove(id),
    onSuccess: () => {
      toast.success('Administrateur supprimé')
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Erreur lors de la suppression")
    }
  })

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Administrateurs</h1>
          </div>
          <p className="text-white/50 text-sm font-medium">Gérez les accès au Dashboard Admin. {admins?.length ? `${admins.length} admin(s)` : ''}</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-action-primary hover:bg-action-primary/90 text-white font-bold transition-all shadow-lg shadow-action-primary/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Ajouter un Admin
        </button>
      </div>

      {showAdd && (
        <div className="p-6 rounded-3xl border border-white/10 bg-white dark:bg-[#1A1A1A]/[0.02] backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-4 space-y-4">
          <h2 className="text-lg font-bold text-white mb-2">Nouvel Administrateur</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wide mb-2 block">Nom (optionnel)</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div className="flex-[2]">
              <label className="text-xs font-bold text-white/50 uppercase tracking-wide mb-2 block">Numéro de téléphone *</label>
              <div className="flex gap-2">
                <CountryPicker value={country} onChange={setCountry} />
                <input
                  type="tel"
                  value={formattedPhone}
                  onChange={handlePhoneChange}
                  placeholder="Numéro"
                  className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-red-500/50"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-bold text-white/50 hover:bg-white dark:bg-[#1A1A1A]/5 transition-colors">Annuler</button>
            <button
              onClick={() => addMut.mutate()}
              disabled={phone.length < 6 || addMut.isPending}
              className="px-6 py-3 rounded-xl bg-red-500 text-white font-bold disabled:opacity-50 flex items-center gap-2"
            >
              {addMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmer l'ajout
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && (
          <div className="col-span-full py-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        )}
        
        {admins?.map((admin: AdminUser) => (
          <div key={admin.id} className="p-5 rounded-3xl border border-white/10 bg-white dark:bg-[#1A1A1A]/[0.02] backdrop-blur-md shadow-lg group hover:bg-white dark:bg-[#1A1A1A]/[0.04] transition-colors flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 flex items-center justify-center text-white font-bold shrink-0 shadow-inner">
                {admin.name ? admin.name.charAt(0).toUpperCase() : <Shield className="w-5 h-5 text-red-400" />}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{admin.name || 'Sans nom'}</p>
                <p className="text-sm font-medium text-red-400 truncate">{admin.phone}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (window.confirm("Voulez-vous vraiment retirer l'accès à ce numéro ?")) {
                  removeMut.mutate(admin.id)
                }
              }}
              disabled={removeMut.isPending}
              className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors active:scale-95 shrink-0"
              title="Supprimer l'accès"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
