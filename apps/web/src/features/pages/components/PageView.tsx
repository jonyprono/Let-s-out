import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi, Page, PagePost } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { Loader2, Users, FileText, Image as ImageIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'

export function PageView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const me = useAuthStore(s => (s as any).user)

  const [page, setPage] = useState<Page | null>(null)
  const [posts, setPosts] = useState<PagePost[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      pagesApi.getById(id),
      pagesApi.getPosts(id)
    ])
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
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-background-primary)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-action-primary)]" />
      </div>
    )
  }

  if (!page) return null

  const isCreator = me?.id === page.creatorId

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins relative">
      <TopBar
        title={page.name}
        onBack={() => navigate(-1)}
        containerClassName="absolute top-0 left-0 right-0 z-10"
      />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Cover */}
        <div className="h-48 w-full bg-[var(--color-background-secondary)] relative">
          {page.coverUrl ? (
            <SafeImage src={page.coverUrl} alt={page.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
          )}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Profile Info */}
        <div className="px-5 pb-6">
          <div className="relative flex justify-between items-end -mt-12 mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-[var(--color-background-primary)] bg-[var(--color-background-secondary)] overflow-hidden shrink-0 z-10 shadow-sm relative flex items-center justify-center text-2xl font-bold text-[var(--color-text-secondary)]">
              {page.avatarUrl ? (
                <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
              ) : (
                page.name[0]?.toUpperCase()
              )}
            </div>

            <div className="mb-2">
              {isCreator ? (
                <button
                  className="px-4 py-1.5 rounded-full border border-[var(--border-default)] text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Gérer la page
                </button>
              ) : (
                <button
                  onClick={handleFollow}
                  className={`px-6 py-1.5 rounded-full text-[13px] font-bold transition-all ${isFollowing
                    ? 'bg-[var(--color-background-secondary)] text-[var(--color-text-primary)]'
                    : 'bg-[var(--color-action-primary)] text-white'
                    }`}
                >
                  {isFollowing ? 'Abonné' : "S'abonner"}
                </button>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{page.name}</h1>
            <p className="text-[13px] text-[var(--color-text-secondary)] mb-3">{page.category}</p>

            <div className="flex items-center gap-4 text-[13px] mb-4">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span className="font-semibold text-[var(--color-text-primary)]">{page._count?.followers || 0}</span>
                <span className="text-[var(--color-text-muted)]">abonnés</span>
              </div>
            </div>

            {page.description && (
              <p className="text-[14px] text-[var(--color-text-primary)] leading-relaxed">
                {page.description}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-2 bg-[var(--color-background-secondary)]" />

        {/* Posts */}
        <div className="px-5 py-4">
          <h2 className="text-[16px] font-bold text-[var(--color-text-primary)] mb-4">Publications</h2>

          {isCreator && (
            <div className="mb-6 p-4 rounded-2xl border border-[var(--border-default)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center text-[var(--color-text-secondary)] font-bold">
                {page.avatarUrl
                  ? <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover rounded-full" />
                  : page.name[0]?.toUpperCase()
                }
              </div>
              <div className="flex-1 text-[14px] text-[var(--color-text-muted)]">
                Quoi de neuf ?
              </div>
              <ImageIcon className="w-5 h-5 text-green-500" />
            </div>
          )}

          {posts.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-[var(--color-background-secondary)] flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[14px] text-[var(--color-text-secondary)]">Aucune publication pour le moment</p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map(post => (
                <div key={post.id} className="pb-6 border-b border-[var(--border-tertiary)] last:border-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-background-secondary)] overflow-hidden flex items-center justify-center font-bold text-[var(--color-text-secondary)]">
                      {page.avatarUrl
                        ? <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
                        : page.name[0]
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-[14px] text-[var(--color-text-primary)]">{page.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {new Date(post.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>
                  {post.content && (
                    <p className="text-[14px] text-[var(--color-text-primary)] mb-3 leading-relaxed whitespace-pre-wrap">
                      {post.content}
                    </p>
                  )}
                  {post.mediaUrls.length > 0 && (
                    <div className="rounded-2xl overflow-hidden bg-[var(--color-background-secondary)] max-h-[300px]">
                      <SafeImage src={post.mediaUrls[0]} alt="publication" className="w-full h-full object-cover" />
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
