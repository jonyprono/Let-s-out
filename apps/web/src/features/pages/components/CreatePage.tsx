import { useState } from 'react'
import { useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { pagesApi } from '../api'
import { toast } from 'sonner'
import { Store } from 'lucide-react'

export function CreatePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = name.trim().length >= 3 && category.trim().length >= 3

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await pagesApi.create({
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || undefined
      })
      toast.success('Page créée avec succès !')
      navigate(`/pages/${res.data.id}`, { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création de la page')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins">
      <TopBar title="Créer une page" onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mb-6 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-violet-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Créez votre Page</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
            Une page vous permet de représenter votre marque, votre association ou votre entreprise, et d'interagir avec les Outsters.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Nom de la page</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Mon Restaurant, Association XYZ..."
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[length:var(--font-size-body-medium)] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)]"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Catégorie</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Ex: Restaurant, Artiste, Sport..."
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[length:var(--font-size-body-medium)] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)]"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Que proposez-vous ?"
              rows={4}
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[length:var(--font-size-body-medium)] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-2 focus:border-[var(--border-brand-primary)] resize-none"
            />
          </div>
        </div>
      </div>

      <div className="p-5 bg-[var(--color-background-primary)] border-t border-[var(--border-tertiary)] shrink-0 pb-safe-6">
        <PrimaryButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={loading}
          className="w-full"
        >
          Créer la page
        </PrimaryButton>
      </div>
    </div>
  )
}
