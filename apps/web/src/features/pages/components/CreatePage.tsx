import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi } from '../api'
import { toast } from 'sonner'
import { ChevronDown, Loader2 } from 'lucide-react'

const CATEGORIES = [
  'Aucune',
  'Evénements',
  'Art et culture',
  'Musique et son',
  'Sport',
  'Cuisine et gastronomie',
  'Santé et bien-être',
  'Fêtes et vie nocturne',
  'Technologie',
  'Mode et shopping',
  'Autre',
]

export function CreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('Aucune')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  const canSubmit = name.trim().length >= 2 && !loading

  const handleCreate = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await pagesApi.create({
        name: name.trim(),
        category: category === 'Aucune' ? 'Général' : category,
        description: description.trim() || undefined,
      })
      toast.success('Page créée avec succès !')
      qc.invalidateQueries({ queryKey: ['pages'] })
      navigate(`/pages/${res.data.id}`, { replace: true })
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création de la page')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      {/* Top Header */}
      <TopBar title="Créer une page" onBack={() => navigate(-1)} />

      {/* Main Form Body */}
      <div className="flex-1 px-4 py-4 flex flex-col justify-between max-w-lg mx-auto w-full">
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
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Catégorie</label>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#141414] text-gray-900 dark:text-white text-sm flex items-center justify-between text-left focus:outline-none focus:border-[#FF7A00] transition-colors"
            >
              <span>{category}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-[72px] left-0 right-0 z-30 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat)
                      setShowCategoryDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      category === cat ? 'text-[#FF7A00] font-semibold bg-[#FFF2D3]/30 dark:bg-[#FF7A00]/10' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
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
    </div>
  )
}
