import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi, Page } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { Loader2, Camera, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/shared/PrimaryButton'

export function ManagePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const me = useAuthStore(s => (s as any).user)

  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    pagesApi.getById(id)
      .then(p => {
        if (me?.id !== p.creatorId) {
          navigate(`/pages/${id}`, { replace: true })
          return
        }
        setPage(p)
        setName(p.name)
        setCategory(p.category)
        setDescription(p.description || '')
        setAvatarPreview(p.avatarUrl || null)
        setCoverPreview(p.coverUrl || null)
      })
      .catch(() => navigate('/explorer'))
      .finally(() => setLoading(false))
  }, [id, me?.id, navigate])

  const handleUploadImage = async (file: File, type: 'avatar' | 'cover') => {
    if (!id) return
    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingCover
    const setPreview = type === 'avatar' ? setAvatarPreview : setCoverPreview
    setUploading(true)
    try {
      const preview = URL.createObjectURL(file)
      setPreview(preview)
      const { url } = await pagesApi.uploadImage(id, file, type)
      setPreview(url)
      // Auto-save the url to the page
      await pagesApi.update(id, type === 'avatar' ? { avatarUrl: url } : { coverUrl: url })
      setPage(p => p ? { ...p, [type === 'avatar' ? 'avatarUrl' : 'coverUrl']: url } : null)
      toast.success(`${type === 'avatar' ? 'Photo de profil' : 'Couverture'} mise à jour !`)
    } catch {
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!id || !name.trim() || !category.trim()) return
    setSaving(true)
    try {
      const updated = await pagesApi.update(id, {
        name: name.trim(),
        category: category.trim(),
        description: description.trim() || undefined,
      })
      setPage(updated)
      toast.success('Page mise à jour !')
    } catch {
      toast.error('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await pagesApi.deletePage(id)
      toast.success('Page supprimée')
      navigate('/settings', { replace: true })
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-background-primary)]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  if (!page) return null

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins">
      <TopBar title="Gérer la page" onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Cover Photo */}
        <div className="relative h-36 bg-gradient-to-r from-orange-400 to-orange-600">
          {coverPreview && (
            <SafeImage src={coverPreview} alt="Couverture" className="w-full h-full object-cover" />
          )}
          {uploadingCover && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}
          <button
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-2 right-3 flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-[12px] font-semibold"
          >
            <Camera className="w-3.5 h-3.5" />
            Modifier
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadImage(f, 'cover') }}
          />
        </div>

        {/* Avatar */}
        <div className="px-5 -mt-10 mb-5 relative z-10">
          <div className="relative w-20 h-20">
            <div className="w-20 h-20 rounded-full border-4 border-[var(--color-background-primary)] bg-[var(--color-background-secondary)] overflow-hidden flex items-center justify-center text-xl font-bold text-[var(--color-text-secondary)] shadow-md">
              {avatarPreview
                ? <SafeImage src={avatarPreview} alt={page.name} className="w-full h-full object-cover" />
                : page.name[0]?.toUpperCase()
              }
            </div>
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 bg-[#FF7A00] rounded-full flex items-center justify-center shadow-md"
            >
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadImage(f, 'avatar') }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mx-5 mb-5 p-4 rounded-2xl bg-[var(--color-background-secondary)] flex items-center justify-around">
          <div className="text-center">
            <p className="text-[22px] font-bold text-[var(--color-text-primary)]">{page._count?.followers || 0}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Abonnés</p>
          </div>
          <div className="w-px h-8 bg-[var(--border-default)]" />
          <div className="text-center">
            <p className="text-[22px] font-bold text-[var(--color-text-primary)]">{page._count?.posts || 0}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Publications</p>
          </div>
        </div>

        {/* Edit form */}
        <div className="px-5 space-y-4 pb-6">
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Nom de la page</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Catégorie</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[#FF7A00] transition-colors"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[var(--color-text-secondary)] mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-[var(--border-default)] rounded-2xl text-[14px] text-[var(--color-text-primary)] bg-[var(--color-background-primary)] focus:outline-none focus:border-[#FF7A00] transition-colors resize-none"
            />
          </div>

          <PrimaryButton
            onClick={handleSave}
            disabled={!name.trim() || !category.trim()}
            loading={saving}
            className="w-full"
          >
            Enregistrer les modifications
          </PrimaryButton>

          {/* Danger zone */}
          <div className="pt-4 border-t border-[var(--border-tertiary)]">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 dark:border-red-900/50 text-red-500 text-[14px] font-semibold active:scale-95 transition-transform"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer la page
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50">
                <p className="text-[14px] font-semibold text-red-600 mb-1">Confirmer la suppression ?</p>
                <p className="text-[12px] text-red-400 mb-4">Cette action est irréversible. Toutes les publications seront supprimées.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-xl border border-[var(--border-default)] text-[13px] font-semibold text-[var(--color-text-primary)]"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[13px] font-bold flex items-center justify-center gap-1.5"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Supprimer</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
