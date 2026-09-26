import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { TopBar } from '@/components/ui/TopBar'
import { pagesApi, Page, PagePost } from '../api'
import { SafeImage } from '@/components/shared/SafeImage'
import { Loader2, Users, FileText, Image as ImageIcon, Send, X, Film } from 'lucide-react'
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
  
  const [postVideo, setPostVideo] = useState<File | null>(null)
  const [postVideoPreview, setPostVideoPreview] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const [publishing, setPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

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
    clearVideo() // only one media
    setPostImage(file)
    const url = URL.createObjectURL(file)
    setPostImagePreview(url)
  }

  const handlePickVideo = async (file: File) => {
    if (file.size > 200 * 1024 * 1024) {
      toast.error('La vidéo est trop volumineuse (max 200 Mo).')
      return
    }
    const videoEl = document.createElement('video')
    videoEl.src = URL.createObjectURL(file)
    const isValid = await new Promise<boolean>(resolve => {
      videoEl.onloadedmetadata = () => {
        if (Math.round(videoEl.duration) > 30) {
          toast.error('La vidéo ne doit pas dépasser 30 secondes.')
          resolve(false)
        } else {
          resolve(true)
        }
      }
    })
    URL.revokeObjectURL(videoEl.src)
    if (!isValid) return

    clearImage() // only one media
    setPostVideo(file)
    setPostVideoPreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    setPostImage(null)
    if (postImagePreview) URL.revokeObjectURL(postImagePreview)
    setPostImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const clearVideo = () => {
    setPostVideo(null)
    if (postVideoPreview) URL.revokeObjectURL(postVideoPreview)
    setPostVideoPreview(null)
    if (videoInputRef.current) videoInputRef.current.value = ''
    setUploadProgress(null)
  }

  const handlePublish = async () => {
    if (!id || (!postText.trim() && !postImage && !postVideo)) return
    setPublishing(true)
    try {
      let mediaUrls: string[] = []
      
      if (postImage) {
        const uploaded = await pagesApi.uploadImage(id, postImage, 'post')
        mediaUrls = [uploaded.url]
      } else if (postVideo) {
        setUploadProgress(0)
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_VIDEO_UPLOAD_PRESET
        const formData = new FormData()
        formData.append('file', postVideo)
        formData.append('upload_preset', uploadPreset)
        formData.append('folder', 'event_videos')
        formData.append('resource_type', 'video')

        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        
        const uploadedUrl = await new Promise<string>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText).secure_url)
            } else {
              reject(new Error('Erreur upload video'))
            }
          }
          xhr.onerror = () => reject(new Error('Erreur réseau'))
          xhr.send(formData)
        })
        mediaUrls = [uploadedUrl]
      }
      
      const newPost = await pagesApi.createPost(id, {
        content: postText.trim() || undefined,
        mediaUrls
      })
      setPosts(prev => [newPost, ...prev])
      setPostText('')
      clearImage()
      clearVideo()
      toast.success('Publication réussie !')
    } catch {
      toast.error('Erreur lors de la publication')
      setUploadProgress(null)
    } finally {
      setPublishing(false)
      setUploadProgress(null)
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
  const canPublish = postText.trim().length > 0 || postImage !== null || postVideo !== null

  return (
    <div className="w-full h-full bg-[var(--color-background-primary)] flex flex-col font-poppins relative">
      <div className="pt-safe-6 relative z-20">
        <TopBar
          title={page.name}
          onBack={() => navigate(-1)}
        />
      </div>

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
              {page.avatarUrl || (isCreator && me?.profile?.avatarUrl) ? (
                <SafeImage src={page.avatarUrl || me?.profile?.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
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
                  {page.avatarUrl || (isCreator && me?.profile?.avatarUrl)
                    ? <SafeImage src={page.avatarUrl || me?.profile?.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
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

              {/* Video preview */}
              {postVideoPreview && (
                <div className="relative mx-3 mb-3 rounded-xl overflow-hidden bg-black flex justify-center">
                  <video src={postVideoPreview} controls className="max-h-48 object-contain" />
                  <button
                    onClick={clearVideo}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center z-10"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {/* Upload Progress */}
              {uploadProgress !== null && (
                <div className="mx-3 mb-3">
                  <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                    <span className="font-medium">{uploadProgress < 100 ? 'Envoi de la vidéo...' : 'Envoi terminé ✓'}</span>
                    <span className="font-bold text-[#FF7A00]">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(uploadProgress, 3)}%`,
                        background: uploadProgress === 100
                          ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                          : 'linear-gradient(90deg, #FF7A00, #FFA755)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Compose actions */}
              <div className="flex items-center justify-between px-3 pb-3 border-t border-[var(--border-tertiary)] pt-2">
                <div className="flex items-center gap-4">
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
                    onClick={() => videoInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-[13px] text-blue-500 font-medium active:scale-95 transition-transform"
                  >
                    <Film className="w-5 h-5" />
                    Vidéo
                  </button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/avi"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handlePickVideo(f)
                    }}
                  />
                </div>
                <button
                  onClick={handlePublish}
                  disabled={!canPublish || publishing || uploadProgress !== null}
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
                      {page.avatarUrl || (isCreator && me?.profile?.avatarUrl)
                        ? <SafeImage src={page.avatarUrl || me?.profile?.avatarUrl} alt={page.name} className="w-full h-full object-cover" />
                        : page.name[0]?.toUpperCase()
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
                      {post.mediaUrls[0].match(/\.(mp4|webm|mov|avi)$/i) ? (
                        <video src={post.mediaUrls[0]} controls className="w-full max-h-[300px] object-cover bg-black" />
                      ) : (
                        <SafeImage src={post.mediaUrls[0]} alt="publication" className="w-full object-cover max-h-[300px]" />
                      )}
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
