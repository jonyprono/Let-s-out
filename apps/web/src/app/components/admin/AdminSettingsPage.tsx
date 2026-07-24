import { useState } from 'react'
import { useAdminSystemSettings } from '@/features/admin/useAdminSystemSettings'
import { toast } from 'sonner'
import { Save, Loader2 } from 'lucide-react'

export default function AdminSettingsPage() {
  const { settings, isLoading, updateSetting, isUpdating } = useAdminSystemSettings()
  
  // Local state for edits
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})

  const handleValueChange = (key: string, val: string) => {
    setEditedValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = (key: string) => {
    const newVal = editedValues[key]
    if (newVal === undefined) return
    updateSetting({ key, value: newVal }, {
      onSuccess: () => {
        toast.success('Paramètre mis à jour avec succès')
      },
      onError: () => {
        toast.error('Erreur lors de la mise à jour')
      }
    })
  }

  // Define the expected settings we want to show
  const EXPECTED_SETTINGS = [
    {
      key: 'PAYOUT_APPROVAL_DEADLINE_HOURS',
      label: 'Délai d\'approbation des déblocages (heures)',
      description: 'Délai en heures avant qu\'une demande de déblocage de fonds ne soit automatiquement approuvée ou rejetée par le système selon les votes des participants.',
      type: 'number',
      defaultValue: '48'
    },
    {
      key: 'PAYOUT_COMMISSION_RATE',
      label: 'Taux de commission plateforme',
      description: 'Taux de commission prélevé lors du déblocage d\'une cagnotte (ex: 0.10 pour 10%).',
      type: 'number',
      defaultValue: '0.10'
    },
    {
      key: 'FEDAPAY_WITHDRAWAL_FEE_RATE',
      label: 'Frais de retrait FedaPay (Mobile Money)',
      description: 'Taux de frais FedaPay lors d\'un virement vers Mobile Money (ex: 0.02 pour 2%). Utilisé pour informer l\'utilisateur avant son retrait.',
      type: 'number',
      defaultValue: '0.02'
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Paramètres Système</h1>
        <p className="text-white/50 text-sm mb-4">
          Configurez les variables globales de l'application. Les changements affecteront les nouveaux événements ou les nouvelles demandes.
        </p>

        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-3">
          <div className="w-1 h-full bg-blue-500 rounded-full flex-shrink-0" />
          <div>
            <h4 className="text-blue-400 font-semibold text-sm mb-1">Impact des taux financiers</h4>
            <p className="text-blue-300/80 text-xs leading-relaxed">
              Le <strong>Taux de commission plateforme</strong> s'applique au moment où la cagnotte est débloquée vers le portefeuille de l'organisateur. <br/>
              Les <strong>Frais de retrait FedaPay</strong> s'appliqueront plus tard, au moment où l'organisateur transférera l'argent de son portefeuille Let's Out vers son compte Mobile Money. <br/>
              <em>Les valeurs doivent être des décimales (ex: 0.10 pour 10%, 0.02 pour 2%).</em>
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {EXPECTED_SETTINGS.map((def) => {
          const settingInDb = settings.find(s => s.key === def.key)
          const currentValue = settingInDb ? settingInDb.value : def.defaultValue
          const isEdited = editedValues[def.key] !== undefined && editedValues[def.key] !== currentValue
          const displayValue = editedValues[def.key] !== undefined ? editedValues[def.key] : currentValue

          return (
            <div key={def.key} className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-2xl">
              <div className="mb-4">
                <h3 className="text-[16px] font-semibold text-white">{def.label}</h3>
                <p className="text-white/50 text-[13px] mt-1">{def.description}</p>
                <div className="text-white/30 text-[11px] mt-2 font-mono">Clé : {def.key}</div>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type={def.type}
                  step="0.01"
                  className="flex-1 max-w-[200px] h-11 px-4 rounded-xl border border-white/[0.1] bg-black/40 text-white focus:outline-none focus:border-orange-500 transition-colors"
                  value={displayValue}
                  onChange={(e) => handleValueChange(def.key, e.target.value)}
                />
                
                {isEdited && (
                  <button
                    onClick={() => handleSave(def.key)}
                    disabled={isUpdating}
                    className="h-11 px-6 rounded-xl bg-orange-500 text-white font-semibold flex items-center gap-2 hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
