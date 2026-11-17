import { useEffect, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, SearchX } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import { authLinkWithReturn, clearReturnTo, peekReturnTo, rememberReturnTo } from '@/lib/return-to'
import { getFullscreenPosterUrl } from '@/features/videos/utils/video-url'
import { videosApi, type EventVideo } from '@/features/videos/api'
import { VideoPlayerModal } from '@/features/videos/components/VideoPlayerModal'
import { PageVideoPlayerModal, type PageVideoItem } from '@/features/pages/components/PageVideoPlayerModal'
import { PagePostDetailModal } from '@/features/pages/components/PagePostDetailModal'

type Kind = 'video' | 'post'

const isVideoUrl = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url) || url.includes('/video/')

/** Image d'aperçu d'une publication : 1re photo, sinon image tirée de la vidéo (Cloudinary) */
function postPreviewImage(post: any): string | undefined {
  const media: string[] = post?.mediaUrls ?? []
  const photo = media.find((u) => !isVideoUrl(u))
  if (photo) return photo
  const video = media.find(isVideoUrl)
  if (video?.includes('/video/upload/')) {
    return video.replace('/video/upload/', '/video/upload/w_720,c_limit,so_auto/').replace(/\.(mp4|webm|mov|avi)$/i, '.jpg')
  }
  return post?.page?.avatarUrl || undefined
}

const fetchVideo = (id: string) => apiClient.get<{ data: EventVideo }>(`/videos/${id}`).then((r) => r.data.data)
const fetchPost = (id: string) => apiClient.get<{ data: any }>(`/pages/posts/${id}`).then((r) => r.data.data)

// ── Écran d'invitation (visiteur non connecté) ───────────────────────────────

/**
 * Inscription obligatoire pour regarder (style TikTok / Facebook) : aperçu flouté en fond
 * (uniquement si le contenu est PUBLIC — l'API ne renvoie rien d'autre aux visiteurs),
 * « S'inscrire » / « Se connecter », puis retour automatique sur le contenu demandé.
 */
function SharedContentGate({ kind, id }: { kind: Kind; id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const returnPath = location.pathname

  useEffect(() => { rememberReturnTo(returnPath) }, [returnPath])

  // Aperçu public (vlog PUBLIC / publication visible) ; erreur ou contenu privé → fond neutre
  const preview = useQuery({
    queryKey: ['shared-preview', kind, id],
    queryFn: () => (kind === 'video' ? fetchVideo(id) : fetchPost(id)),
    retry: false,
    staleTime: 5 * 60_000,
  })
  const image = preview.data
    ? kind === 'video' ? getFullscreenPosterUrl(preview.data as EventVideo) : postPreviewImage(preview.data)
    : undefined
  const caption = preview.data
    ? kind === 'video' ? (preview.data as EventVideo).title : (preview.data as any).page?.name
    : undefined

  return (
    <div className="fixed inset-0 z-[120] bg-black text-white flex flex-col overflow-hidden select-none">
      {image && (
        <img src={image} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/90" aria-hidden="true" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center mb-6">
          <Play className="w-7 h-7 fill-white text-white translate-x-0.5" aria-hidden="true" />
        </div>
        {caption && (
          <p className="text-[13px] font-semibold text-white/75 mb-2 max-w-full truncate font-poppins"><span>{caption}</span></p>
        )}
        <h1 className="text-[22px] leading-snug font-bold font-poppins max-w-[340px]">
          <span>{kind === 'video' ? t('sharedContent.gateVideo') : t('sharedContent.gatePost')}</span>
        </h1>
      </div>

      <div
        className="relative z-10 px-6 flex flex-col gap-3 w-full max-w-[420px] mx-auto"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))' }}
      >
        <button
          type="button"
          onClick={() => navigate(authLinkWithReturn('/signup', returnPath))}
          className="w-full h-12 rounded-full bg-[#FF7A00] text-white font-semibold text-[16px] font-poppins active:scale-[0.98] transition-transform shadow-lg shadow-[#FF7A00]/30"
        >
          <span>{t('sharedContent.signup')}</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(authLinkWithReturn('/login', returnPath))}
          className="w-full h-12 rounded-full border border-white/60 text-white font-semibold text-[16px] font-poppins active:scale-[0.98] transition-transform backdrop-blur-sm"
        >
          <span>{t('sharedContent.login')}</span>
        </button>
      </div>
    </div>
  )
}

// ── Contenu (utilisateur connecté) ───────────────────────────────────────────

function CenteredState({ loading, message, onHome }: { loading?: boolean; message?: string; onHome?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-[90] bg-black text-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      {loading ? <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" aria-label={t('sharedContent.loading')} /> : (
        <>
          <SearchX className="w-10 h-10 text-white/60" aria-hidden="true" />
          <p className="text-[15px] font-poppins"><span>{message}</span></p>
          <button type="button" onClick={onHome} className="px-6 h-11 rounded-full bg-[#FF7A00] text-white font-semibold font-poppins">
            <span>{t('sharedContent.backHome')}</span>
          </button>
        </>
      )}
    </div>
  )
}

function SharedVideoView({ id }: { id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const video = useQuery({ queryKey: ['videos', 'shared', id], queryFn: () => fetchVideo(id), retry: false })
  // Vlogs suivants : on continue de faire défiler après la vidéo partagée
  const more = useQuery({ queryKey: ['videos', 'shared-more'], queryFn: () => videosApi.list({ limit: 10 }), enabled: video.isSuccess })
  const list = useMemo(() => {
    if (!video.data) return []
    return [video.data, ...((more.data?.data ?? []).filter((v) => v.id !== video.data!.id))]
  }, [video.data, more.data])

  if (video.isLoading) return <CenteredState loading />
  if (!video.data) return <CenteredState message={t('sharedContent.videoNotFound')} onHome={() => navigate('/home', { replace: true })} />
  return <VideoPlayerModal videos={list} initialVideoId={video.data.id} onClose={() => navigate('/videos', { replace: true })} />
}

function SharedPostView({ id }: { id: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const post = useQuery({ queryKey: ['pages', 'posts', id], queryFn: () => fetchPost(id), retry: false })
  const close = () => navigate('/home', { replace: true })

  if (post.isLoading) return <CenteredState loading />
  if (!post.data) return <CenteredState message={t('sharedContent.postNotFound')} onHome={close} />

  const p = post.data
  const videoUrl = (p.mediaUrls ?? []).find(isVideoUrl)
  if (videoUrl) {
    const item: PageVideoItem = {
      id: p.id, pageId: p.pageId, videoUrl, content: p.content, createdAt: p.createdAt,
      page: { id: p.page.id, name: p.page.name, avatarUrl: p.page.avatarUrl, creatorId: p.page.creatorId },
      likesCount: p.likesCount ?? 0, commentsCount: p._count?.comments ?? 0, hasLiked: !!p.hasLiked,
    }
    return <PageVideoPlayerModal videos={[item]} initialVideoId={p.id} onClose={close} />
  }
  return (
    <div className="fixed inset-0 bg-black/80">
      <PagePostDetailModal
        post={p}
        open
        onClose={close}
        onNavigate={(screen, pageId) => { if (screen === 'page-view' && pageId) navigate(`/pages/${pageId}`, { replace: true }) }}
      />
    </div>
  )
}

/**
 * Route d'un lien partagé (/videos/:id, /vlogs/:id, /posts/:id).
 * Visiteur → écran d'invitation ; connecté → contenu en plein écran.
 * `protect` = garde des routes connectées (profil incomplet → onboarding, etc.).
 */
export function SharedContentRoute({ kind, protect }: { kind: Kind; protect: (node: React.ReactNode) => React.ReactNode }) {
  const { id = '' } = useParams<{ id: string }>()
  const token = useAuthStore((s) => s.accessToken)
  const location = useLocation()

  // Arrivé sur le contenu demandé : la page de retour mémorisée est consommée
  useEffect(() => {
    if (token && peekReturnTo() === location.pathname) clearReturnTo()
  }, [token, location.pathname])

  if (!token) return <SharedContentGate kind={kind} id={id} />
  return <>{protect(kind === 'video' ? <SharedVideoView id={id} /> : <SharedPostView id={id} />)}</>
}
