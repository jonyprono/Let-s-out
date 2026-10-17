import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/ui/TopBar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { pagesApi } from '../api'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'

// 12 Catégories existantes du projet (identiques à CreateEvent)
const PAGE_CATEGORIES = [
  { label: 'Art et culture',            value: 'CULTURE'   },
  { label: 'Comédie',                   value: 'GAMING'    },
  { label: 'Sport',                     value: 'SPORT'     },
  { label: 'Santé et bien-être',        value: 'WELLNESS'  },
  { label: 'Cuisine et gastronomie',    value: 'FOOD'      },
  { label: 'Boissons',                  value: 'LIFESTYLE' },
  { label: 'Réseautage professionnel',  value: 'SOCIAL'    },
  { label: 'Fêtes',                     value: 'NIGHTLIFE' },
  { label: 'Religion',                  value: 'OTHER'     },
  { label: 'Shopping',                  value: 'TECH'      },
  { label: 'Musique et son',            value: 'MUSIC'     },
  { label: 'Télévision et cinéma',      value: 'ART'       },
]

export function CreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)

  const selectedCat = PAGE_CATEGORIES.find((c) => c.value === category)
  const canSubmit = name.trim().length >= 2 && category !== '' && !loading

  const handleCreate = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await pagesApi.create({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
      })
      toast.success('Page créée avec succès !')
      qc.invalidateQueries({ queryKey: ['pages'] })
      navigate(`/pages/${res.data.id}`, { replace: true })
    } catch (err: any) {
      console.error('CreatePage Error:', err)
      const apiMsg = err?.response?.data?.error || err?.response?.data?.message
      const msg = Array.isArray(apiMsg) ? apiMsg[0] : apiMsg
      let errorStr = typeof msg === 'string' ? msg : (err?.message || 'Erreur lors de la création de la page')
      if (
        !errorStr ||
        String(errorStr).includes('ProgressEvent') ||
        String(err).includes('ProgressEvent')
      ) {
        errorStr = 'Erreur de connexion au serveur. Vérifiez votre connexion et réessayez.'
      }
      toast.error(errorStr)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-black text-gray-900 dark:text-white overflow-hidden">
      {/* Top Header - Safe Area Aware */}
      <TopBar
        title="Créer une page"
        onBack={() => navigate(-1)}
        containerClassName="pt-safe-4 pt-4 shrink-0 border-b border-gray-100 dark:border-gray-800"
      />

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col justify-between max-w-lg mx-auto w-full pb-10" style={{ scrollbarWidth: 'none' }}>
        <div className="flex flex-col gap-5">
          {/* Field: Nom */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la page"
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>

          {/* Field: Catégorie */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Catégorie</label>
            <button
              type="button"
              onClick={() => setShowCategorySheet(true)}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] text-sm flex items-center justify-between text-left focus:outline-none focus:border-[#FF7A00] transition-colors"
            >
              <span className={selectedCat ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                {selectedCat ? selectedCat.label : 'Sélectionnez une catégorie...'}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          </div>

          {/* Field: Description */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Description</label>
              <span className="text-[11px] text-gray-400">Facultatif</span>
            </div>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bio..."
              className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:border-[#FF7A00] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Bottom Sticky Button */}
        <div className="pt-6 pb-6 mt-auto">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className={`w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center transition-all ${
              canSubmit
                ? 'bg-[#FF7A00] hover:bg-[#E06C00] active:scale-[0.99] text-white shadow-md shadow-[#FF7A00]/20'
                : 'bg-[#FF7A00]/40 text-white/80 cursor-not-allowed'
            }`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : 'Créer'}
          </button>
        </div>
      </div>

      {/* Category BottomSheet */}
      <BottomSheet
        title="Sélectionner une catégorie"
        open={showCategorySheet}
        onClose={() => setShowCategorySheet(false)}
      >
        <div className="divide-y divide-[var(--border-tertiary)]">
          {PAGE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => {
                setCategory(cat.value)
                setShowCategorySheet(false)
              }}
              className={`w-full flex items-center justify-between px-1 py-[15px] text-left transition-colors active:bg-[var(--color-background-secondary)] ${
                category === cat.value ? 'bg-[#FF7A00]/5' : ''
              }`}
            >
              <span
                className={`flex-1 text-[14px] font-medium text-left ${
                  category === cat.value
                    ? 'text-[#FF7A00] font-semibold'
                    : 'text-[var(--color-text-primary)]'
                }`}
              >
                {cat.label}
              </span>
              <div
                className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  category === cat.value
                    ? 'border-[#FF7A00] bg-[#FF7A00]'
                    : 'border-[var(--border-default)]'
                }`}
              >
                {category === cat.value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
