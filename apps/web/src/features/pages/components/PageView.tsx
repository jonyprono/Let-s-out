import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { pagesApi, Page, PagePost } from '../api'
import { PagePostCommentsModal } from './PagePostCommentsModal'
import { PageVideoPlayerModal, PageVideoItem } from './PageVideoPlayerModal'
import { SafeImage } from '@/components/shared/SafeImage'
import { FeedVideoPlayer } from '@/components/shared/FeedVideoPlayer'
import {
  ArrowLeft,
  UserPlus,
  UserCheck,
  MessageCircle,
  Calendar,
  Star,
  Plus,
  Heart,
  Share2,
  MoreVertical,
  Camera,
  Video,
  Tag,
  Globe,
  Lock,
  Loader2,
  Trash2,
  Image as ImageIcon,
  Settings,
  Copy,
  Pencil,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { useConfirm } from '@/components/shared/ConfirmContext'

type PageTab = 'publications' | 'events' | 'about' | 'photos'

export function PageView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const me = useAuthStore((s) => (s as any).user)
  const confirm = useConfirm()

  const [page, setPage] = useState<Page | null>(null)
  const [posts, setPosts] = useState<PagePost[]>([])
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [activeTab, setActiveTab] = useState<PageTab>('publications')

  // Post modal state
  const [showCreatePostModal, setShowCreatePostModal] = useState(false)
  const [postStep, setPostStep] = useState<1 | 2>(1)
  const [postContent, setPostContent] = useState('')
  const [postPrivacy, setPostPrivacy] = useState<'public' | 'private'>('public')
  const [postImages, setPostImages] = useState<File[]>([])
  const [postImagePreviews, setPostImagePreviews] = useState<string[]>([])
  const [postVideo, setPostVideo] = useState<File | null>(null)
  const [postVideoPreview, setPostVideoPreview] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; title: string } | null>(null)

  // Likes state (local optimistic)
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({})
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null)
  const [commentModalPost, setCommentModalPost] = useState<PagePost | null>(null)
  const [playingPageVideoId, setPlayingPageVideoId] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<PagePost | null>(null)
  const [editPostContent, setEditPostContent] = useState('')
  const [isUpdatingPost, setIsUpdatingPost] = useState(false)

  const handleSavePostEdit = async () => {
    if (!editingPost || !page) return
    setIsUpdatingPost(true)
    try {
      await pagesApi.updatePost(page.id, editingPost.id, { content: editPostContent })
      setPosts((prev) =>
        prev.map((p) => (p.id === editingPost.id ? { ...p, content: editPostContent } : p))
      )
      toast.success('Publication modifiée avec succès')
      setEditingPost(null)
    } catch {
      toast.error('Erreur lors de la modification de la publication')
    } finally {
      setIsUpdatingPost(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isOwner = Boolean(me?.id && page?.creatorId && me.id === page.creatorId)

  const pageVideos: PageVideoItem[] = useMemo(() => {
    if (!posts || !page) return []
    return posts
      .filter((p) => p.mediaUrls?.some((url) => url.match(/\.(mp4|webm|mov|avi)$/i) || url.includes('/video/')))
      .map((p) => ({
        id: p.id,
        pageId: page.id,
        videoUrl: p.mediaUrls.find((url) => url.match(/\.(mp4|webm|mov|avi)$/i) || url.includes('/video/'))!,
        content: p.content,
        createdAt: p.createdAt,
        page: {
          id: page.id,
          name: page.name,
          avatarUrl: page.avatarUrl,
          creatorId: page.creatorId,
        },
        likesCount: 0,
        commentsCount: p._count?.comments || p.comments?.length || 0,
        hasLiked: Boolean(likedPosts[p.id]),
      }))
  }, [posts, page, likedPosts])

  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [id])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    Promise.all([pagesApi.getById(id), pagesApi.getPosts(id)])
      .then(([pageData, postsData]) => {
        setPage(pageData)
        setIsFollowing(pageData.isFollowing || false)
        setPosts(postsData || [])
      })
      .catch((error) => {
        console.error('Erreur chargement page:', error)
        const apiMsg = error?.response?.data?.error || error?.response?.data?.message
        const errorStr = typeof apiMsg === 'string' ? apiMsg : (error?.message || 'Erreur lors du chargement de la page')
        setLoadError(
          String(errorStr).includes('ProgressEvent') || String(error).includes('ProgressEvent')
            ? 'Erreur de connexion au serveur'
            : errorStr
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleFollowToggle = async () => {
    if (!id || !page || isOwner) return
    try {
      const { followed } = await pagesApi.follow(id)
      setIsFollowing(followed)
      setPage((p) =>
        p
          ? {
              ...p,
              _count: {
                ...p._count!,
                followers: (p._count?.followers || 0) + (followed ? 1 : -1),
              },
            }
          : null
      )
      toast.success(followed ? 'Vous suivez maintenant cette page' : 'Abonnement retiré')
    } catch (err: any) {
      const apiMsg = err?.response?.data?.error || err?.response?.data?.message
      const errorStr = typeof apiMsg === 'string' ? apiMsg : (err?.message || "Erreur lors de l'abonnement")
      toast.error(
        String(errorStr).includes('ProgressEvent') || String(err).includes('ProgressEvent')
          ? 'Erreur de connexion au serveur'
          : errorStr
      )
    }
  }

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setPostVideo(null)
    setPostVideoPreview(null)
    const remaining = 4 - postImages.length
    const toAdd = files.slice(0, remaining)
    setPostImages((prev) => [...prev, ...toAdd])
    setPostImagePreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removePostImage = (idx: number) => {
    setPostImages((prev) => prev.filter((_, i) => i !== idx))
    setPostImagePreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const handlePickVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error('La vidéo ne doit pas dépasser 100 Mo')
        return
      }
      setPostImages([])
      setPostImagePreviews([])
      setPostVideo(file)
      setPostVideoPreview(URL.createObjectURL(file))
    }
  }

  const handlePublishPost = async () => {
    if (!id || (!postContent.trim() && postImages.length === 0 && !postVideo)) return
    setPublishing(true)
    try {
      let mediaUrls: string[] = []
      if (postImages.length > 0) {
        for (const file of postImages) {
          const uploaded = await pagesApi.uploadImage(id, file, 'post')
          mediaUrls.push(uploaded.url)
        }
      } else if (postVideo) {
        const uploaded = await pagesApi.uploadImage(id, postVideo, 'post')
        mediaUrls.push(uploaded.url)
      }
      const newPost = await pagesApi.createPost(id, {
        content: postContent.trim() || undefined,
        mediaUrls,
      })
      setPosts((prev) => [newPost, ...prev])
      toast.success('Publication créée avec succès !')
      // Reset
      setPostContent('')
      setPostImages([])
      setPostImagePreviews([])
      setPostVideo(null)
      setPostVideoPreview(null)
      setPostStep(1)
      setShowCreatePostModal(false)
    } catch {
      toast.error('Erreur lors de la publication')
    } finally {
      setPublishing(false)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!id) return
    const confirmed = await confirm({
      title: 'Supprimer cette publication ?',
      description: 'Voulez-vous vraiment supprimer cette publication ? Cette action est irréversible et supprimera définitivement les photos et commentaires.',
      confirmText: 'Oui, supprimer',
      cancelText: 'Non, annuler',
      cancelMessage: 'Suppression annulée',
    })
    if (!confirmed) return

    try {
      await pagesApi.deletePost(id, postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      toast.success('Publication supprimée avec succès')
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setActiveMenuPostId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
      </div>
    )
  }

  if (loadError && !page) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-black p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center text-2xl mb-4">
          ⚠️
        </div>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Impossible de charger cette page</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-xs">{loadError}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2.5 rounded-full bg-[#FF7A00] text-white text-xs font-semibold hover:bg-[#E06C00] active:scale-95 transition-all shadow-md shadow-[#FF7A00]/25"
        >
          Retour
        </button>
      </div>
    )
  }

  if (!page) return null

  return (
    <div ref={scrollRef} className="w-full h-full flex flex-col bg-white dark:bg-black text-gray-900 dark:text-white overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      {/* ── Cover Area ── */}
      <div 
        className={`relative w-full h-48 sm:h-56 min-h-[192px] sm:min-h-[224px] bg-gray-100 dark:bg-gray-900 overflow-hidden shrink-0 ${page.coverUrl ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (page.coverUrl) setFullscreenMedia({ url: page.coverUrl, title: `Bannière de ${page.name}` })
        }}
      >
        {page.coverUrl ? (
          <SafeImage src={page.coverUrl} alt="Bannière" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full bg-[#F3F4F6] dark:bg-[#1C1C1E]"
            style={{
              backgroundImage: `radial-gradient(#E5E7EB 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          />
        )}

        {/* Floating Back Button (aligned with safe area and stay inside mobile shell) */}
        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-all shadow-lg"
          style={{ top: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 16px)' }}
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* ── Profile Info Header ── */}
      <div className="flex flex-col items-center px-4 -mt-12 relative z-10 shrink-0">
        {/* Avatar */}
        <div 
          onClick={() => {
            if (page.avatarUrl) setFullscreenMedia({ url: page.avatarUrl, title: page.name })
          }}
          className={`w-24 h-24 rounded-full border-4 border-white dark:border-black bg-gray-200 dark:bg-gray-800 overflow-hidden flex items-center justify-center text-gray-500 shadow-md shrink-0 ${page.avatarUrl ? 'cursor-pointer' : ''}`}
        >
          {page.avatarUrl ? (
            <SafeImage src={page.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-2xl font-bold">
              {page.name ? page.name.charAt(0).toUpperCase() : 'P'}
            </div>
          )}
        </div>

        {/* Name & Stats */}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2.5 text-center px-2 break-words max-w-full">
          {page.name}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          0 suivis · {page._count?.followers ?? 0} abonnés
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full max-w-sm mt-4">
          {isOwner ? (
            <>
              <button
                onClick={() => navigate(`/pages/${id}/manage`)}
                className="flex-1 h-9 rounded-full font-semibold text-xs flex items-center justify-center gap-1.5 bg-[#FF7A00] hover:bg-[#E06C00] text-white shadow-sm shadow-[#FF7A00]/20 active:scale-95 transition-all"
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Gérer la page</span>
              </button>

              <button
                onClick={() => setShowCreatePostModal(true)}
                className="flex-1 h-9 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all whitespace-nowrap hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <Plus className="w-3.5 h-3.5 shrink-0 text-[#FF7A00]" />
                <span>Publier</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleFollowToggle}
                className={`flex-1 h-9 rounded-full font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                  isFollowing
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                    : 'bg-[#FF7A00] hover:bg-[#E06C00] text-white shadow-sm shadow-[#FF7A00]/20'
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>Suivi</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>Suivre</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (page.creatorId) navigate(`/chat/user/${page.creatorId}`)
                }}
                className="flex-1 h-9 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all whitespace-nowrap hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Envoyer un message</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation (Horizontally scrollable with pill pattern from Profile) ── */}
      <div className="w-full border-b border-gray-100 dark:border-gray-800 shrink-0 bg-white dark:bg-black sticky top-0 z-20">
        <div className="w-full overflow-x-auto hide-scrollbar px-4 py-2.5">
          <div className="flex items-center gap-2 w-max">
            {(
              [
                { key: 'publications', label: 'Publications' },
                { key: 'events',       label: 'Événements'   },
                { key: 'about',        label: 'À propos'     },
                { key: 'photos',       label: 'Photos'       },
              ] as const
            ).map(({ key, label }) => {
              const isActive = activeTab === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                    isActive
                      ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20 shadow-sm'
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="px-4 py-5 max-w-lg mx-auto w-full pb-24">
        {/* ── 1. PUBLICATIONS TAB ── */}
        {activeTab === 'publications' && (
          <div className="flex flex-col gap-6">
            {/* Détails Section */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Détails</h3>
              <div className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{page.category || 'Evénements'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="text-gray-500 text-[11px]">0 (aucun avis)</span>
                </div>
              </div>
            </div>

            {/* Publications List or Empty State */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 dark:text-white">Publications</h3>
                {posts.length > 0 && isOwner && (
                  <button
                    onClick={() => setShowCreatePostModal(true)}
                    className="text-xs text-[#FF7A00] font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nouvelle
                  </button>
                )}
              </div>

              {posts.length === 0 ? (
                /* Empty state matching Figma */
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  {/* Phone graphic */}
                  <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
                    <svg viewBox="0 0 100 120" className="w-20 h-24" fill="none">
                      <rect x="15" y="10" width="70" height="100" rx="14" stroke="#FF7A00" strokeWidth="4" fill="#FFF9EC" />
                      <circle cx="50" cy="100" r="4" fill="#FF7A00" />
                      <rect x="25" y="30" width="30" height="20" rx="6" fill="#FF7A00" />
                      <circle cx="35" cy="40" r="2" fill="white" />
                      <circle cx="45" cy="40" r="2" fill="white" />
                      <path d="M65 55L80 47V63L65 55Z" fill="#FF7A00" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">Aucune publication</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-5">
                    {isOwner ? 'Créez votre première publication' : "Cette page n'a pas encore partagé de publication."}
                  </p>
                  {isOwner && (
                    <button
                      onClick={() => setShowCreatePostModal(true)}
                      className="w-full max-w-xs h-11 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white font-semibold text-xs shadow-md shadow-[#FF7A00]/20 transition-all"
                    >
                      Créer une publication
                    </button>
                  )}
                </div>
              ) : (
                /* Posts List matching Screenshot 4 */
                <div className="flex flex-col gap-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141414] overflow-hidden"
                    >
                      {/* Post Text */}
                      {post.content && (
                        <p className="p-4 text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-line">
                          {post.content}
                        </p>
                      )}

                      {/* Post Media */}
                      {post.mediaUrls && post.mediaUrls.length > 0 && (
                        <div className="w-full overflow-hidden bg-black">
                          {post.mediaUrls[0].match(/\.(mp4|webm|mov|avi)$/i) || post.mediaUrls[0].includes('/video/') ? (
                            <FeedVideoPlayer
                              src={post.mediaUrls[0]}
                              maxHeight="384px"
                              onExpand={() => setPlayingPageVideoId(post.id)}
                            />
                          ) : post.mediaUrls.length === 1 ? (
                            <div 
                              className="w-full cursor-pointer"
                              onClick={() => setFullscreenMedia({ url: post.mediaUrls[0], title: page.name })}
                            >
                              <SafeImage src={post.mediaUrls[0]} alt="Media" className="w-full max-h-96 object-cover" />
                            </div>
                          ) : post.mediaUrls.length === 2 ? (
                            <div className="grid grid-cols-2 gap-1 w-full bg-black">
                              {post.mediaUrls.map((url, idx) => (
                                <div
                                  key={idx}
                                  className="aspect-square cursor-pointer overflow-hidden bg-neutral-900"
                                  onClick={() => setFullscreenMedia({ url, title: `${page.name} (${idx + 1}/${post.mediaUrls.length})` })}
                                >
                                  <SafeImage src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                </div>
                              ))}
                            </div>
                          ) : post.mediaUrls.length === 3 ? (
                            <div className="grid grid-cols-2 gap-1 w-full bg-black">
                              <div
                                className="row-span-2 aspect-[3/4] cursor-pointer overflow-hidden bg-neutral-900"
                                onClick={() => setFullscreenMedia({ url: post.mediaUrls[0], title: `${page.name} (1/3)` })}
                              >
                                <SafeImage src={post.mediaUrls[0]} alt="Photo 1" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                              </div>
                              <div className="flex flex-col gap-1">
                                {post.mediaUrls.slice(1, 3).map((url, idx) => (
                                  <div
                                    key={idx}
                                    className="aspect-square cursor-pointer overflow-hidden bg-neutral-900"
                                    onClick={() => setFullscreenMedia({ url, title: `${page.name} (${idx + 2}/3)` })}
                                  >
                                    <SafeImage src={url} alt={`Photo ${idx + 2}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-1 w-full bg-black">
                              {post.mediaUrls.slice(0, 4).map((url, idx) => (
                                <div
                                  key={idx}
                                  className="aspect-square cursor-pointer overflow-hidden bg-neutral-900 relative"
                                  onClick={() => setFullscreenMedia({ url, title: `${page.name} (${idx + 1}/${post.mediaUrls.length})` })}
                                >
                                  <SafeImage src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                                  {idx === 3 && post.mediaUrls.length > 4 && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-lg">
                                      +{post.mediaUrls.length - 4}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Post Actions Footer matching Figma */}
                      <div className="grid grid-cols-4 border-t border-gray-100 dark:border-gray-800 text-gray-500 py-3">
                        <button
                          onClick={() =>
                            setLikedPosts((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                          }
                          className="flex items-center justify-center p-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          <Heart className={`w-4 h-4 ${likedPosts[post.id] ? 'fill-red-500 text-red-500' : ''}`} />
                        </button>

                        <button
                          onClick={() => setCommentModalPost(post)}
                          className="flex items-center justify-center p-1 border-l border-gray-100 dark:border-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors gap-1.5"
                          title="Commenter"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {((post._count?.comments ?? post.comments?.length) || 0) > 0 && (
                            <span className="text-xs font-semibold">
                              {(post._count?.comments ?? post.comments?.length) || 0}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: page.name, text: post.content || '' })
                            } else {
                              toast.success('Lien copié dans le presse-papier')
                            }
                          }}
                          className="flex items-center justify-center p-1 border-l border-gray-100 dark:border-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        <div className="relative flex items-center justify-center border-l border-gray-100 dark:border-gray-800">
                          <button
                            onClick={() =>
                              setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id)
                            }
                            className="p-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuPostId === post.id && (
                            <div className="absolute right-2 bottom-8 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl py-1.5 z-20 min-w-[150px] overflow-hidden">
                              {post.content && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard?.writeText(post.content || '')
                                    toast.success('Texte copié dans le presse-papier')
                                    setActiveMenuPostId(null)
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-gray-500" /> Copier le texte
                                </button>
                              )}
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    setEditingPost(post)
                                    setEditPostContent(post.content || '')
                                    setActiveMenuPostId(null)
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-gray-500" /> Modifier
                                </button>
                              )}
                              {isOwner && (
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="w-full text-left px-3.5 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" /> Supprimer
                                </button>
                              )}
                              {!isOwner && (
                                <button
                                  onClick={() => {
                                    toast.success('Publication signalée')
                                    setActiveMenuPostId(null)
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  Signaler
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. EVENTS TAB ── */}
        {activeTab === 'events' && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            {/* Calendar 17 illustration */}
            <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
              <div className="w-16 h-18 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141414] shadow-sm flex flex-col items-center overflow-hidden">
                <div className="w-full h-5 bg-[#FF7A00] flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <div className="flex-1 flex items-center justify-center font-bold text-2xl text-gray-900 dark:text-white">
                  17
                </div>
              </div>
            </div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Aucun événement</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-5">
              {isOwner ? 'Créez votre premier événement' : 'Les événements organisés par cette page apparaîtront ici.'}
            </p>
            {isOwner && (
              <button
                onClick={() => navigate('/events/create')}
                className="w-full max-w-xs h-11 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] active:scale-95 text-white font-semibold text-xs shadow-md shadow-[#FF7A00]/20 transition-all"
              >
                Créer un événement
              </button>
            )}
          </div>
        )}

        {/* ── 3. ABOUT TAB ── */}
        {activeTab === 'about' && (
          <div className="flex flex-col gap-6">
            {/* Description */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Description</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {page.description ||
                  'Aucune description. Modifiez le profil de la page pour en ajouter une.'}
              </p>
              {!page.description && isOwner && (
                <button
                  onClick={() => navigate(`/pages/${id}/manage`)}
                  className="self-start text-xs text-[#FF7A00] font-semibold mt-1"
                >
                  Ajouter une bio
                </button>
              )}
            </div>

            {/* Catégorie */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Catégorie</h3>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{page.category}</span>
              </div>
            </div>

            {/* Créateur */}
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Créateur</h3>
              <div className="p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-[#FAFAFA] dark:bg-[#141414] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 overflow-hidden shrink-0">
                    {page.creator?.profile?.avatarUrl ? (
                      <SafeImage src={page.creator.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : isOwner && me?.profile?.avatarUrl ? (
                      <SafeImage src={me.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (page.creator?.profile?.displayName || me?.profile?.displayName || 'C').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        {isOwner ? (me?.profile?.displayName || 'Vous') : (page.creator?.profile?.displayName || 'Créateur')}
                      </p>
                      <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[9px]">
                        ✓
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {isOwner ? 'Propriétaire de cette page' : 'Créateur de cette page'}
                    </p>
                  </div>
                </div>

                {!isOwner && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        if (page.creatorId) navigate(`/chat/user/${page.creatorId}`)
                      }}
                      className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
                    >
                      Contacter
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Avis */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Avis</h3>
              <div className="flex items-center gap-1.5 text-amber-400">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="w-3.5 h-3.5 fill-current" />
                ))}
                <span className="text-gray-400 text-xs ml-1">0 (aucun avis)</span>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xs font-bold text-gray-900 dark:text-white">Badges</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Aucun badge reçu. Animez la page pour gagner des badges de progression.
              </p>
            </div>

            {/* Edit Button */}
            {isOwner && (
              <button
                onClick={() => navigate(`/pages/${id}/manage`)}
                className="w-full h-11 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors mt-2"
              >
                Modifier les informations de la page
              </button>
            )}
          </div>
        )}

        {/* ── 4. PHOTOS TAB ── */}
        {activeTab === 'photos' && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center mb-3 text-gray-400">
              <ImageIcon className="w-10 h-10 text-orange-400" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Aucune photo</h4>
            <p className="text-xs text-gray-400 mt-1">
              {isOwner
                ? 'Les photos publiées sur votre page apparaîtront ici'
                : 'Les photos publiées par cette page apparaîtront ici'}
            </p>
          </div>
        )}
      </div>

      {/* ── CREATE POST FULLSCREEN / MODAL (Matching Screenshot 3) ── */}
      {showCreatePostModal && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-black flex flex-col justify-between">
          {/* STEP 1: Compose Post */}
          {postStep === 1 && (
            <div className="flex flex-col h-full justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => setShowCreatePostModal(false)}
                    className="p-1 text-gray-700 dark:text-gray-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Créer une publication
                  </h2>
                </div>

                {/* Profile info & Privacy */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                      {page.avatarUrl ? (
                        <SafeImage src={page.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        page.name.charAt(0)
                      )}
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{page.name}</span>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {postPrivacy === 'public' ? 'Public' : 'Privé'}
                  </span>
                </div>

                {/* Textarea */}
                <div className="px-4">
                  <textarea
                    rows={6}
                    value={postContent}
                    onChange={(e) => setPostContent(e.target.value)}
                    placeholder="Quoi de neuf ?"
                    className="w-full text-base bg-transparent border-0 placeholder:text-gray-400 text-gray-900 dark:text-white focus:outline-none resize-none"
                    autoFocus
                  />
                </div>

                {/* Media Preview */}
                {postImagePreviews.length > 0 && (
                  <div className="mx-4 my-2">
                    <div className={`grid gap-2 ${postImagePreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {postImagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden bg-black/10 border border-gray-200 dark:border-gray-800">
                          <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removePostImage(idx)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                          >
                            ✕
                          </button>
                          {idx === 0 && (
                            <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold bg-[#FF7A00] text-white px-2 py-0.5 rounded-full">
                              Bannière
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[12px] text-gray-400 mt-1.5">
                      {postImagePreviews.length}/4 photo{postImagePreviews.length > 1 ? 's' : ''} {postImagePreviews.length < 4 ? '· Vous pouvez en ajouter d\'autres' : ''}
                    </p>
                  </div>
                )}
                {postVideoPreview && (
                  <div className="relative mx-4 my-2 max-h-60 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                    <video src={postVideoPreview} controls className="w-full max-h-60 object-contain bg-black" />
                    <button
                      onClick={() => {
                        setPostVideo(null)
                        setPostVideoPreview(null)
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Toolbar & Next Button */}
              <div
                className="border-t border-gray-100 dark:border-gray-800 flex flex-col gap-3 px-4 pt-4"
                style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
              >
                {/* 3 Icons Toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={postImagePreviews.length >= 4}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 h-11 rounded-xl flex items-center justify-center transition-colors gap-1.5 ${
                      postImagePreviews.length >= 4
                        ? 'opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-900 text-gray-400'
                        : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    {postImagePreviews.length > 0 && (
                      <span className="text-xs font-semibold">{postImagePreviews.length}/4</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="flex-1 h-11 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    className="flex-1 h-11 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Tag className="w-5 h-5" />
                  </button>
                </div>

                {/* Hidden file inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePickImage}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handlePickVideo}
                  className="hidden"
                />

                {/* Suivant Button */}
                <button
                  disabled={!postContent.trim() && postImages.length === 0 && !postVideo}
                  onClick={() => setPostStep(2)}
                  className={`w-full h-12 rounded-full font-semibold text-sm transition-all ${
                    postContent.trim() || postImages.length > 0 || postVideo
                      ? 'bg-[#FF7A00] hover:bg-[#E06C00] text-white shadow-md shadow-[#FF7A00]/20 active:scale-[0.99]'
                      : 'bg-[#FF7A00]/40 text-white/80 cursor-not-allowed'
                  }`}
                >
                  Suivant
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Paramètres de publication (Privacy) */}
          {postStep === 2 && (
            <div className="flex flex-col h-full justify-between">
              <div>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <button onClick={() => setPostStep(1)} className="p-1 text-gray-700 dark:text-gray-300">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Paramètres de la publication
                  </h2>
                </div>

                {/* Confidentialité Content */}
                <div className="p-4 flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Confidentialité</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Qui peut voir et interagir avec cette publication ?
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {/* Public option */}
                    <div
                      onClick={() => setPostPrivacy('public')}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                        postPrivacy === 'public'
                          ? 'border-[#FF7A00] bg-[#FFF2D3]/20 dark:bg-[#FF7A00]/10'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">Public</p>
                          <p className="text-[11px] text-gray-400">Tout le monde sur Let's Out</p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          postPrivacy === 'public'
                            ? 'border-[#FF7A00] bg-[#FF7A00]'
                            : 'border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {postPrivacy === 'public' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Private option */}
                    <div
                      onClick={() => setPostPrivacy('private')}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-colors ${
                        postPrivacy === 'private'
                          ? 'border-[#FF7A00] bg-[#FFF2D3]/20 dark:bg-[#FF7A00]/10'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white">Privé</p>
                          <p className="text-[11px] text-gray-400">
                            Uniquement les abonnés de la page
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          postPrivacy === 'private'
                            ? 'border-[#FF7A00] bg-[#FF7A00]'
                            : 'border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {postPrivacy === 'private' && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Publier Button */}
              <div
                className="border-t border-gray-100 dark:border-gray-800 px-4 pt-4"
                style={{ paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
              >
                <button
                  disabled={publishing}
                  onClick={handlePublishPost}
                  className="w-full h-12 rounded-full bg-[#FF7A00] hover:bg-[#E06C00] active:scale-[0.99] text-white font-semibold text-sm shadow-md shadow-[#FF7A00]/20 flex items-center justify-center transition-all"
                >
                  {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publier'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Page Post Comments Modal ── */}
      {commentModalPost && page && (
        <PagePostCommentsModal
          pageId={page.id}
          postId={commentModalPost.id}
          pageName={page.name}
          pageCreatorId={page.creatorId}
          open={Boolean(commentModalPost)}
          onClose={() => setCommentModalPost(null)}
          onCommentAdded={() => {
            setPosts((prev) =>
              prev.map((p) =>
                p.id === commentModalPost.id
                  ? {
                      ...p,
                      _count: {
                        comments: ((p._count?.comments ?? p.comments?.length) || 0) + 1,
                      },
                    }
                  : p
              )
            )
          }}
        />
      )}

      {/* ── Vertical Swiping Page Videos Player Modal (OUT VLOG style) ── */}
      {playingPageVideoId && (
        <PageVideoPlayerModal
          videos={pageVideos}
          initialVideoId={playingPageVideoId}
          onClose={() => setPlayingPageVideoId(null)}
        />
      )}

      {/* ── Edit Post Modal ── */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-3xl p-5 shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
              <h3 className="font-bold text-base text-gray-900 dark:text-white">Modifier la publication</h3>
              <button
                onClick={() => setEditingPost(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={editPostContent}
              onChange={(e) => setEditPostContent(e.target.value)}
              rows={5}
              placeholder="Texte de votre publication..."
              className="w-full p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF7A00] resize-none"
            />

            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                disabled={isUpdatingPost}
                className="px-4 py-2 rounded-full text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSavePostEdit}
                disabled={isUpdatingPost}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-[#FF7A00] hover:bg-[#E06C00] text-white shadow-md shadow-[#FF7A00]/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isUpdatingPost && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fullscreen Media Viewer ── */}
      {fullscreenMedia && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200"
          onClick={() => setFullscreenMedia(null)}
        >
          <div
            className="w-full flex items-center justify-between px-4 pt-12 pb-4 z-10 bg-gradient-to-b from-black/80 to-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFullscreenMedia(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white transition-all"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-sm font-semibold text-white leading-tight">{fullscreenMedia.title}</p>
            </div>
          </div>

          <div
            className="flex-1 flex items-center justify-center p-4"
            onClick={() => setFullscreenMedia(null)}
          >
            <img
              src={fullscreenMedia.url}
              alt={fullscreenMedia.title}
              className="max-w-full max-h-[80vh] object-contain select-none shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className="w-full text-center pb-8 pt-4 text-xs text-white/50"
            onClick={(e) => e.stopPropagation()}
          >
            Appuyez n'importe où pour fermer
          </div>
        </div>
      )}
    </div>
  )
}
