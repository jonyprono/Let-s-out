import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi, Page, PagePost } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { Loader2, Users, FileText, Image as ImageIcon, Send, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'

export function PageView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const me = useAuthStore(s => (s as any).user)

  const [page, setPage] = useState<Page | null>(null)
  const [posts, setPosts] = useState<PagePost[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)

  // Post creation state
  const [postText, setPostText] = useState('')
  const [postImage, setPostImage] = useState<File | null>(null)
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([pagesApi.getById(id), pagesApi.getPosts(id)])
      .then(([pageData, postsData]) => {
        setPage(pageData)
        setIsFollowing(pageData.isFollowing || false)
        setPosts(postsData)
      })
      .catch(() => navigate('/explorer'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleFollow = async () => {
    if (!id || !page) return
    try {
      const { followed } = await pagesApi.follow(id)
      setIsFollowing(followed)
      setPage(p => p ? {
        ...p,
        _count: {
          ...p._count!,
          followers: (p._count?.followers || 0) + (followed ? 1 : -1)
        }
      } : null)
    } catch {
      toast.error('Erreur lors de l\'abonnement')
    }
  }

  const handlePickImage = (file: File) => {
    setPostImage(file)
    const url = URL.createObjectURL(file)
    setPostImagePreview(url)
  }

  const clearImage = () => {
    setPostImage(null)
    if (postImagePreview) URL.revokeObjectURL(postImagePreview)
    setPostImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePublish = async () => {
    if (!id || (!postText.trim() && !postImage)) return
    setPublishing(true)
    try {
      let mediaUrls: string[] = []
      if (postImage) {
        const uploaded = await pagesApi.uploadImage(id, postImage, 'post')
        mediaUrls = [uploaded.url]
      }
      const newPost = await pagesApi.createPost(id, {
        content: postText.trim() || undefined,
        mediaUrls
      })
      setPosts(prev => [newPost, ...prev])
      setPostText('')
      clearImage()
      toast.success('Publication réussie !')
    } catch {
      toast.error('Erreur lors de la publication')
    } finally {
      setPublishing(false)
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

  const isCreator = me?.id === page.creatorId
  const canPublish = postText.trim().length > 0 || postImage !== null

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins relative">
      <TopBar
        title={page.name}
        onBack={() => navigate(-1)}
        containerClassName="absolute top-0 left-0 right-0 z-20"
      />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Cover */}
        <div className="h-44 w-full relative">
          {page.coverUrl ? (
            <SafeImage src={page.coverUrl} alt={page.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-orange-400 to-orange-600" />
          )}
          <div className="absolute inset-0 bg-black/10" />
        </div>

        {/* Profile Info */}
        <div className="px-5 pb-4">
          {/* Avatar + Action Button row */}
          <div className="flex items-end justify-between -mt-12 mb-3">
            <div className="w-24 h-24 rounded-full border-4 border-[var(--color-background-primary)] bg-[var(--color-background-secondary)] overflow-hidden shrink-0 z-10 shadow-sm flex items-center justify-center text-2xl font-bold text-[var(--color-text-secondary)]">
              {page.avatarUrl ? (
                <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
              ) : (
                page.name[0]?.toUpperCase()
              )}
            </div>

            <div className="mb-1">
              {isCreator ? (
                <button
                  onClick={() => navigate(`/pages/${id}/manage`)}
                  className="px-4 py-1.5 rounded-full border border-[var(--border-default)] text-[13px] font-semibold text-[var(--color-text-primary)] bg-[var(--color-background-primary)] active:scale-95 transition-transform"
                >
                  Gérer la page
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  className={`px-6 py-1.5 rounded-full text-[13px] font-bold transition-all active:scale-95 ${
                    isFollowing
                      ? 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                      : 'bg-[#FF7A00] text-white'
                  }`}
                >
                  {isFollowing ? 'Abonné ✓' : "S'abonner"}
                </button>
              )}
            </div>
          </div>

          {/* Page Info */}
          <div className="mb-4">
            <h1 className="text-[18px] font-bold text-[var(--color-text-primary)]">{page.name}</h1>
            <p className="text-[13px] text-[var(--color-text-secondary)] mb-2">{page.category}</p>

            <div className="flex items-center gap-1.5 text-[13px]">
              <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
              <span className="font-semibold text-[var(--color-text-primary)]">{page._count?.followers || 0}</span>
              <span className="text-[var(--color-text-muted)]">abonnés</span>
            </div>

            {page.description && (
              <p className="text-[14px] text-[var(--color-text-primary)] leading-relaxed mt-2">
                {page.description}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-2 bg-[var(--color-background-secondary)]" />

        {/* Posts section */}
        <div className="px-5 py-4">
          <h2 className="text-[16px] font-bold text-[var(--color-text-primary)] mb-4">Publications</h2>

          {/* Compose Box (creator only) */}
          {isCreator && (
            <div className="mb-5 rounded-2xl border border-[var(--border-default)] bg-[var(--color-background-primary)] overflow-hidden shadow-sm">
              <div className="flex items-start gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center font-bold text-[var(--color-text-secondary)] shrink-0 text-[15px] overflow-hidden">
                  {page.avatarUrl
                    ? <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
                    : page.name[0]?.toUpperCase()
                  }
                </div>
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder="Quoi de neuf ?"
                  rows={postText.length > 60 ? 3 : 1}
                  className="flex-1 bg-transparent text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none pt-1"
                />
              </div>

              {/* Image preview */}
              {postImagePreview && (
                <div className="relative mx-3 mb-3 rounded-xl overflow-hidden">
                  <img src={postImagePreview} className="w-full max-h-48 object-cover rounded-xl" alt="preview" />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {/* Compose actions */}
              <div className="flex items-center justify-between px-3 pb-3 border-t border-[var(--border-tertiary)] pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-[13px] text-green-600 font-medium active:scale-95 transition-transform"
                >
                  <ImageIcon className="w-5 h-5" />
                  Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handlePickImage(f)
                  }}
                />
                <button
                  onClick={handlePublish}
                  disabled={!canPublish || publishing}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all ${
                    canPublish && !publishing
                      ? 'bg-[#FF7A00] text-white active:scale-95'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {publishing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Send className="w-4 h-4" /> Publier</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Posts list */}
          {posts.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[14px] text-[var(--color-text-secondary)]">Aucune publication pour le moment</p>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map(post => (
                <div key={post.id} className="pb-5 border-b border-[var(--border-tertiary)] last:border-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-background-secondary)] overflow-hidden flex items-center justify-center font-bold text-[var(--color-text-secondary)] text-[14px] shrink-0">
                      {page.avatarUrl
                        ? <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
                        : page.name[0]
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-[14px] text-[var(--color-text-primary)]">{page.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {new Date(post.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  {post.content && (
                    <p className="text-[14px] text-[var(--color-text-primary)] mb-3 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}
                  {post.mediaUrls.length > 0 && (
                    <div className="rounded-2xl overflow-hidden bg-[var(--color-background-secondary)]">
                      <SafeImage src={post.mediaUrls[0]} alt="publication" className="w-full object-cover max-h-[300px]" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
