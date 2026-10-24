import { useState, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/ui/TopBar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { pagesApi } from '../api'
import { toast } from 'sonner'
import { ChevronDown, Loader2, Camera, X } from 'lucide-react'
import { SafeImage } from '@/components/shared/SafeImage'

// 15 Catégories (12 existantes + 3 nouvelles)
const PAGE_CATEGORIES = [
  { label: 'Art et culture',               value: 'CULTURE'   },
  { label: 'Comédie',                      value: 'GAMING'    },
  { label: 'Sport',                        value: 'SPORT'     },
  { label: 'Santé et bien-être',           value: 'WELLNESS'  },
  { label: 'Cuisine et gastronomie',       value: 'FOOD'      },
  { label: 'Boissons',                     value: 'LIFESTYLE' },
  { label: 'Réseautage professionnel',     value: 'SOCIAL'    },
  { label: 'Fêtes',                        value: 'NIGHTLIFE' },
  { label: 'Religion',                     value: 'OTHER'     },
  { label: 'Shopping',                     value: 'TECH'      },
  { label: 'Musique et son',              value: 'MUSIC'     },
  { label: 'Télévision et cinéma',         value: 'ART'       },
  { label: 'Jeux vidéos & jeux de société', value: 'GAMING'    },
  { label: 'Concerts & festivals',         value: 'CONCERTS'  },
  { label: 'Voyages et découverte',        value: 'TRAVEL'    },
]

export function CreatePage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCategorySheet, setShowCategorySheet] = useState(false)

  // Photo de profil de la page
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  // Bannière de la page
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const selectedCat = PAGE_CATEGORIES.find((c) => c.value === category)
  const canSubmit = name.trim().length >= 2 && category !== '' && !loading

  const handlePickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handlePickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleCreate = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      // 1. Créer la page (sans images d'abord)
      const res = await pagesApi.create({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
      })
      const pageId = res.data.id

      // 2. Upload photo de profil si sélectionnée
      if (avatarFile) {
        try {
          await pagesApi.uploadImage(pageId, avatarFile, 'avatar')
        } catch {
          toast.error("Erreur lors de l'upload de la photo de profil, vous pourrez la modifier plus tard")
        }
      }

      // 3. Upload bannière si sélectionnée
      if (coverFile) {
        try {
          await pagesApi.uploadImage(pageId, coverFile, 'cover')
        } catch {
          toast.error("Erreur lors de l'upload de la bannière, vous pourrez la modifier plus tard")
        }
      }

      toast.success('Page créée avec succès !')
      qc.invalidateQueries({ queryKey: ['pages'] })
      navigate(`/pages/${pageId}`, { replace: true })
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
      {/* Top Header */}
      <TopBar
        title="Créer une page"
        onBack={() => navigate(-1)}
        containerClassName="pt-safe-4 pt-4 shrink-0 border-b border-gray-100 dark:border-gray-800"
      />

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 max-w-lg mx-auto w-full pb-10" style={{ scrollbarWidth: 'none' }}>

        {/* ── Bannière ── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Bannière</label>
            <span className="text-[11px] text-gray-400">Facultatif</span>
          </div>
          <div
            className="relative w-full h-32 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center"
            onClick={() => coverInputRef.current?.click()}
          >
            {coverPreview ? (
              <>
                <SafeImage src={coverPreview} alt="Bannière" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null) }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[11px] font-medium">
                  <Camera className="w-3 h-3" />
                  Modifier
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-[12px] font-medium">Ajouter une bannière</span>
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickCover}
            />
          </div>
        </div>

        {/* ── Photo de profil ── */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Photo de profil de la page</label>
            <span className="text-[11px] text-gray-400">Facultatif</span>
          </div>
          <div className="flex items-center gap-4">
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-pointer border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center shrink-0"
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarPreview ? (
                <>
                  <SafeImage src={avatarPreview} alt="Photo de profil" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400">
                  <Camera className="w-5 h-5" />
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePickAvatar}
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] text-gray-600 dark:text-gray-400">
                {avatarPreview ? 'Photo sélectionnée ✓' : 'Aucune photo sélectionnée'}
              </p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="text-[12px] text-[#FF7A00] font-semibold text-left"
              >
                {avatarPreview ? 'Changer la photo' : 'Choisir une photo'}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}
                  className="text-[12px] text-red-500 font-medium text-left"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Séparateur ── */}
        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Field: Nom */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Nom de la page</label>
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

        {/* Bottom Sticky Button */}
        <div className="pt-2 pb-6 mt-auto">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit}
            className={`w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              canSubmit
                ? 'bg-[#FF7A00] hover:bg-[#E06C00] active:scale-[0.99] text-white shadow-md shadow-[#FF7A00]/20'
                : 'bg-[#FF7A00]/40 text-white/80 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Création en cours...</span>
              </>
            ) : 'Créer la page'}
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
