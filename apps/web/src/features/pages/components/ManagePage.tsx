import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi, Page, PagePost } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Loader2, Camera, Trash2, Settings, BarChart3, Users, FileText, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/shared/PrimaryButton'

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

export function ManagePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const me = useAuthStore(s => (s as any).user)

  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [currentSection, setCurrentSection] = useState<'menu' | 'settings' | 'stats' | 'posts' | 'followers'>('menu')

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [showCategorySheet, setShowCategorySheet] = useState(false)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Posts state for the posts section
  const [posts, setPosts] = useState<PagePost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)

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

  const sectionTitle: Record<string, string> = {
    menu: 'Gérer la page',
    settings: 'Paramètres',
    stats: 'Statistiques',
    posts: 'Publications',
    followers: 'Abonnés',
  }

  // --- Sub-section views (no page header) ---
  if (currentSection !== 'menu') {
    const loadPostsIfNeeded = async () => {
      if (currentSection === 'posts' && posts.length === 0 && !loadingPosts) {
        setLoadingPosts(true)
        try {
          const data = await pagesApi.getPosts(id!)
          setPosts(data)
        } catch {
          toast.error('Erreur lors du chargement des publications')
        } finally {
          setLoadingPosts(false)
        }
      }
    }
    loadPostsIfNeeded()

    const handleDeletePost = async (postId: string) => {
      if (!id || !window.confirm('Supprimer cette publication définitivement ?')) return
      setDeletingPostId(postId)
      try {
        await pagesApi.deletePost(id, postId)
        setPosts(prev => prev.filter(p => p.id !== postId))
        setPage(prev => prev ? { ...prev, _count: { ...prev._count!, posts: (prev._count?.posts || 1) - 1 } } : null)
        toast.success('Publication supprimée')
      } catch {
        toast.error('Erreur lors de la suppression')
      } finally {
        setDeletingPostId(null)
      }
    }

    return (
      <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins">
        <div className="pt-safe-6">
          <TopBar
            title={sectionTitle[currentSection]}
            onBack={() => setCurrentSection('menu')}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: 'none' }}>
          {/* Settings section */}
          {currentSection === 'settings' && (
            <div className="space-y-4 pb-6">
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
          )}

          {/* Stats section */}
          {currentSection === 'stats' && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Statistiques</h3>
              <p className="text-[14px] text-[var(--color-text-muted)]">Les statistiques détaillées de votre page seront bientôt disponibles.</p>
            </div>
          )}

          {/* Posts section */}
          {currentSection === 'posts' && (
            <div>
              {loadingPosts ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FF7A00]" />
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Aucune publication</h3>
                  <p className="text-[14px] text-[var(--color-text-muted)]">Publiez votre premier contenu depuis la page.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <div key={post.id} className="bg-[var(--color-background-secondary)] rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-[13px] text-[var(--color-text-muted)]">
                          {new Date(post.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deletingPostId === post.id}
                          className="p-1.5 rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                        >
                          {deletingPostId === post.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />
                          }
                        </button>
                      </div>
                      {post.content && (
                        <p className="text-[14px] text-[var(--color-text-primary)] leading-relaxed mb-2 whitespace-pre-wrap">{post.content}</p>
                      )}
                      {post.mediaUrls.length > 0 && (
                        <div className="rounded-xl overflow-hidden">
                          {post.mediaUrls[0].match(/\.(mp4|webm|mov|avi)$/i) || post.mediaUrls[0].includes('/video/') ? (
                            <video src={post.mediaUrls[0]} controls className="w-full max-h-48 bg-black" />
                          ) : (
                            <SafeImage src={post.mediaUrls[0]} alt="" className="w-full max-h-48 object-cover" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Followers section */}
          {currentSection === 'followers' && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-[18px] font-bold text-[var(--color-text-primary)] mb-2">Vos abonnés</h3>
              <p className="text-[14px] text-[var(--color-text-muted)]">La liste de vos abonnés sera bientôt disponible.</p>
            </div>
          )}
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

  // --- Main menu view (with page header) ---
  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins">
      <div className="pt-safe-6">
        <TopBar
          title="Gérer la page"
          onBack={() => navigate(-1)}
        />
      </div>

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
              {avatarPreview || me?.profile?.avatarUrl
                ? <SafeImage src={avatarPreview || me?.profile?.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
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

        {currentSection === 'menu' && (
          <div className="px-4 mt-6 space-y-3">
            <button
              onClick={() => setCurrentSection('stats')}
              className="w-full bg-[var(--color-background-secondary)] rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">Statistiques</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">Vues, interactions, audience</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>

            <button
              onClick={() => setCurrentSection('posts')}
              className="w-full bg-[var(--color-background-secondary)] rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">Publications</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">Gérer vos posts et vidéos</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>

            <button
              onClick={() => setCurrentSection('followers')}
              className="w-full bg-[var(--color-background-secondary)] rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">Abonnés</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">Liste de votre communauté</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>

            <button
              onClick={() => setCurrentSection('settings')}
              className="w-full bg-[var(--color-background-secondary)] rounded-2xl p-4 flex items-center gap-4 active:scale-95 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">Paramètres de la page</p>
                <p className="text-[12px] text-[var(--color-text-muted)]">Modifier les infos, supprimer la page</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)]" />
            </button>
          </div>
        )}

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
