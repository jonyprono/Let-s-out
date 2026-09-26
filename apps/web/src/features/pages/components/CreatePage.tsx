import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/ui/TopBar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { PrimaryButton } from '@/components/shared/PrimaryButton'
import { pagesApi } from '../api'
import { toast } from 'sonner'
import { LayoutDashboard } from 'lucide-react'

const PAGE_CATEGORIES = [
  { label: 'Art et culture',            value: 'CULTURE' },
  { label: 'Comédie',                   value: 'GAMING' },
  { label: 'Sport',                     value: 'SPORT' },
  { label: 'Santé et bien-être',        value: 'WELLNESS' },
  { label: 'Cuisine et gastronomie',    value: 'FOOD' },
  { label: 'Boissons',                  value: 'LIFESTYLE' },
  { label: 'Réseautage professionnel',  value: 'SOCIAL' },
  { label: 'Fêtes',                     value: 'NIGHTLIFE' },
  { label: 'Religion',                  value: 'OTHER' },
  { label: 'Shopping',                  value: 'TECH' },
  { label: 'Musique et son',            value: 'MUSIC' },
  { label: 'Télévision et cinéma',      value: 'ART' },
]

export function CreatePage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)

  const [step, setStep] = useState<'form' | 'done' | 'published'>('form')
  const [createdPageId, setCreatedPageId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [firstPostText, setFirstPostText] = useState('')
  const qc = useQueryClient()

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
      setCreatedPageId(res.data.id)
      setFirstPostText(`🎉 Bonjour à tous ! Bienvenue sur la nouvelle page de ${name.trim()}. N'hésitez pas à interagir et commenter, on a hâte d'échanger avec vous ! 👇`)
      setStep('done')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création de la page')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!createdPageId || !firstPostText.trim()) return
    setPublishing(true)
    try {
      await pagesApi.createPost(createdPageId, {
        content: firstPostText.trim(),
        mediaUrls: []
      })
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['pages', 'feed'] })
      setStep('published')
      toast.success('Votre page est maintenant visible dans le fil d\'actualité !')
    } catch (err: any) {
      toast.error('Erreur lors de la publication')
    } finally {
      setPublishing(false)
    }
  }

  if (step === 'done' || step === 'published') {
    const isPublished = step === 'published'
    return (
      <div 
        className={`w-full h-full flex flex-col relative overflow-hidden ${isPublished ? 'bg-[var(--color-background-primary)]' : ''}`}
        style={!isPublished ? { background: 'var(--color-bg-warm)' } : {}}
      >
        <div className={`px-4 pt-safe-6 pb-2 shrink-0 ${isPublished ? 'bg-[var(--color-background-primary)]' : ''}`} />

        <div className="flex-1 overflow-y-auto px-4 pb-40">
          <div className="flex flex-col items-center pt-3 gap-5">
            <div className="flex flex-col items-center gap-3 w-full">
              <div 
                className={`flex items-center justify-center mb-1 ${isPublished ? 'w-[72px] h-[72px] rounded-full bg-gradient-to-tr from-[var(--brand-yellow-500)] to-[var(--functional-green-500)]' : 'w-[80px] h-[80px] rounded-[40px]'}`}
                style={!isPublished ? { background: 'var(--gradient-success-orange)' } : {}}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <h1 
                className={`text-center font-semibold ${isPublished ? 'text-[var(--functional-green-500)] text-[24px]' : 'text-[20px] leading-[24px]'}`} 
                style={
                  isPublished 
                    ? { fontFamily: 'Poppins, sans-serif' }
                    : { 
                        fontFamily: 'Poppins, sans-serif',
                        background: 'var(--gradient-success-orange)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text'
                      }
                }
              >
                {isPublished ? 'Publié !' : 'Créée !'}
              </h1>
              <p className="text-[14px] text-[var(--color-text-secondary)] text-center max-w-[300px] leading-[1.6]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                {isPublished
                  ? "Votre page a été publiée avec succès. Vous pouvez maintenant la gérer ou voir les détails."
                  : "Votre page a été bien créée. Publiez ce premier message pour le rendre visible à la communauté dans le fil d'actualité !"}
              </p>
            </div>

            <div className="w-full bg-[var(--color-background-primary)] rounded-[8px] p-4 shadow-sm border border-[var(--border-tertiary)]">
              <h3 className="font-bold text-[15px] text-[var(--color-text-primary)] mb-2 truncate">Votre premier message</h3>
              {!isPublished ? (
                <textarea
                  value={firstPostText}
                  onChange={(e) => setFirstPostText(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border-default)] rounded-xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-secondary)] focus:outline-none focus:border-[#FF7A00] transition-colors resize-none"
                  rows={4}
                />
              ) : (
                <p className="text-[14px] text-[var(--color-text-secondary)]">{firstPostText}</p>
              )}
            </div>
          </div>
        </div>

        <div className={`absolute bottom-0 left-0 right-0 px-5 py-6 space-y-3 bg-gradient-to-t ${isPublished ? 'from-[var(--color-background-primary)] via-[var(--color-background-primary)]' : 'from-[var(--color-background-alt)] via-[var(--color-background-alt)]'} to-transparent`}>
          {!isPublished ? (
            <button
              onClick={handlePublish}
              disabled={publishing || !firstPostText.trim()}
              className="w-full py-[15px] rounded-[100px] bg-[var(--color-action-primary)] font-semibold text-[15px] text-[var(--color-text-inverse)] active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {publishing ? 'Publication en cours...' : 'Publier dans le fil d\'actualité'}
            </button>
          ) : (
            <button
              onClick={() => navigate(`/pages/${createdPageId}`, { replace: true })}
              className="w-full py-[15px] rounded-[100px] bg-[var(--color-action-primary)] font-semibold text-[15px] text-[var(--color-text-inverse)] active:scale-[0.98] transition-transform"
            >
              Gérer la page
            </button>
          )}
          {!isPublished && (
            <button
              onClick={() => navigate(`/pages/${createdPageId}`, { replace: true })}
              className="w-full py-[15px] rounded-[100px] bg-transparent font-medium text-[14px] text-[var(--color-text-secondary)] active:scale-[0.98] transition-transform"
            >
              Plus tard
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins pt-safe-6">
      <div className="pt-2">
        <TopBar title="Créer une page" onBack={() => navigate(-1)} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6" style={{ scrollbarWidth: 'none' }}>
        <div className="mb-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-4">
            <LayoutDashboard className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Créez votre Page</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed max-w-[280px]">
            Une page vous permet de représenter votre marque, votre association ou votre entreprise, et d'interagir avec les Outsters.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
              Nom de la page <span className="text-red-400">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Mon Restaurant, Association XYZ..."
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">
              Catégorie <span className="text-red-400">*</span>
            </label>
            <div
              onClick={() => setShowCategorySheet(true)}
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] cursor-pointer"
            >
              {category || <span className="text-[var(--color-text-muted)]">Sélectionnez une catégorie...</span>}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Que proposez-vous ?"
              rows={4}
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[#FF7A00] transition-colors resize-none"
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

      <BottomSheet title="Sélectionner une catégorie" open={showCategorySheet} onClose={() => setShowCategorySheet(false)}>
        <div className="divide-y divide-[var(--border-tertiary)]">
          {PAGE_CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => { setCategory(cat.value); setShowCategorySheet(false) }}
              className={`w-full flex items-center justify-between px-1 py-[15px] text-left transition-colors active:bg-[var(--color-background-secondary)] ${
                category === cat.value ? 'bg-[var(--brand-orange-500)]/5' : ''
              }`}
            >
              <span className={`flex-1 text-[14px] font-medium text-left ${
                category === cat.value
                  ? 'text-[var(--brand-orange-500)] font-semibold'
                  : 'text-[var(--color-text-primary)]'
              }`}>{cat.label}</span>
              <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                category === cat.value
                  ? 'border-[var(--brand-orange-500)] bg-[var(--brand-orange-500)]'
                  : 'border-[var(--border-default)]'
              }`}>
                {category === cat.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
