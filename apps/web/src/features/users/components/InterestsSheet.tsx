import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { usersApi } from '@/features/users/api'
import { useAuthStore } from '@/stores/auth.store'
import { interestIcon, interestLabel, PROFILE_INTEREST_OPTIONS } from '@/lib/interests'

interface InterestsSheetProps {
  open: boolean
  onClose: () => void
  /** Centres d'intérêt actuels (pré-sélectionnés) */
  initial: string[]
}

/**
 * Feuille dédiée aux centres d'intérêt (bouton « + Ajouter » du profil) : sélection par pastilles
 * puis « Enregistrer », sans ouvrir le formulaire complet « Modifier mon profil ».
 * Seul `interests` est envoyé (mise à jour partielle : les autres champs du profil sont intacts).
 * Un intérêt enregistré absent de la liste proposée (ancienne valeur) reste affiché et conservé.
 */
export function InterestsSheet({ open, onClose, initial }: InterestsSheetProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const refreshUser = useAuthStore((s) => s.refreshUser)
  const [selected, setSelected] = useState<string[]>(initial)
  const [saving, setSaving] = useState(false)

  // À chaque ouverture : on repart des intérêts enregistrés
  useEffect(() => {
    if (open) setSelected(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isSelected = (v: string) => selected.some((s) => s.toLowerCase() === v.toLowerCase())
  const toggle = (v: string) =>
    setSelected((prev) => (isSelected(v) ? prev.filter((s) => s.toLowerCase() !== v.toLowerCase()) : [...prev, v]))

  // Options proposées + anciennes valeurs déjà enregistrées (jamais perdues)
  const legacy = initial.filter((v) => !PROFILE_INTEREST_OPTIONS.some((o) => o.toLowerCase() === v.toLowerCase()))
  const options = [...PROFILE_INTEREST_OPTIONS, ...legacy]

  const save = async () => {
    setSaving(true)
    try {
      await usersApi.updateProfile({ interests: selected })
      await refreshUser()
      qc.invalidateQueries({ queryKey: ['public-profile'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success(t('interestsSheet.saved'))
      onClose()
    } catch {
      toast.error(t('interestsSheet.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={() => { if (!saving) onClose() }} title={t('interestsSheet.title')}>
      <div className="flex flex-col gap-4 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-gray-500 dark:text-gray-400"><span>{t('editProfileModal.choisissezVosCentresDInteret')}</span></p>
          <span className="text-[12px] font-medium text-[#FF7A00] shrink-0 ml-2">
            <span>{t('editProfileModal.selectedCount', { count: selected.length })}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5" role="group" aria-label={t('interestsSheet.title')}>
          {options.map((interest) => {
            const on = isSelected(interest)
            return (
              <button
                key={interest}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(interest)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95 ${
                  on
                    ? 'bg-[#FF7A00] text-white shadow-sm border border-[#FF7A00]'
                    : 'bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-[14px]" aria-hidden="true">{interestIcon(interest)}</span>
                <span>{interestLabel(t, interest)}</span>
                {on && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
                    <X className="w-3 h-3 text-white" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full h-12 rounded-full bg-[#FF7A00] text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          <span>{t('interestsSheet.save')}</span>
        </button>
      </div>
    </BottomSheet>
  )
}
