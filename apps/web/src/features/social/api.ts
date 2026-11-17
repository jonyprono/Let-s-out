import { apiClient } from '@/lib/api-client'

/**
 * Commentaires « réseau social » (vlogs et publications de pages) : même format côté API
 * (services/social.service.ts) → un seul composant d'affichage pour les deux.
 */
export interface SocialCommentUser {
  id: string
  profile: { displayName?: string | null; avatarUrl?: string | null; username?: string | null } | null
}

export interface SocialComment {
  id: string
  userId: string
  parentId: string | null
  createdAt: string
  /** Même texte sous les deux noms historiques (vlogs : content, pages : text) */
  content: string
  text: string
  user: SocialCommentUser
  likesCount: number
  likedByMe: boolean
  /** Réponses (commentaires racines uniquement — 1 seul niveau) */
  replies?: SocialComment[]
  repliesCount?: number
}

export interface LikeResult { liked: boolean; likesCount: number }

/** Source de commentaires : où les lire / écrire, et quelles données rafraîchir après un changement */
export interface CommentSource {
  queryKey: readonly unknown[]
  list: () => Promise<SocialComment[]>
  add: (text: string, parentId: string | null) => Promise<unknown>
  like: (commentId: string, liked: boolean) => Promise<LikeResult>
  remove: (commentId: string) => Promise<unknown>
  /** Requêtes à rafraîchir après ajout / suppression (compteurs des cartes, fils…) */
  relatedKeys: readonly (readonly unknown[])[]
}

export const socialKeys = {
  videoComments: (videoId: string) => ['videos', videoId, 'comments'] as const,
  postComments: (pageId: string, postId: string) => ['pages', pageId, 'posts', postId, 'comments'] as const,
}

export function videoCommentSource(videoId: string): CommentSource {
  return {
    queryKey: socialKeys.videoComments(videoId),
    list: () => apiClient.get<{ data: SocialComment[] }>(`/videos/${videoId}/comments`).then((r) => r.data.data),
    add: (text, parentId) => apiClient.post(`/videos/${videoId}/comments`, { content: text, parentId }).then((r) => r.data),
    like: (commentId, liked) => apiClient.post<LikeResult>(`/videos/${videoId}/comments/${commentId}/like`, { liked }).then((r) => r.data),
    remove: (commentId) => apiClient.delete(`/videos/${videoId}/comments/${commentId}`).then((r) => r.data),
    relatedKeys: [['videos'], ['feed', 'videos']],
  }
}

export function pagePostCommentSource(pageId: string, postId: string): CommentSource {
  return {
    queryKey: socialKeys.postComments(pageId, postId),
    list: () => apiClient.get<{ data: SocialComment[] }>(`/pages/${pageId}/posts/${postId}/comments`).then((r) => r.data.data),
    add: (text, parentId) => apiClient.post(`/pages/${pageId}/posts/${postId}/comments`, { text, parentId }).then((r) => r.data),
    like: (commentId, liked) => apiClient.post<LikeResult>(`/pages/${pageId}/posts/${postId}/comments/${commentId}/like`, { liked }).then((r) => r.data),
    remove: (commentId) => apiClient.delete(`/pages/${pageId}/posts/${postId}/comments/${commentId}`).then((r) => r.data),
    relatedKeys: [['feed', 'pages'], ['pages', pageId, 'posts'], ['pages', 'posts', postId]],
  }
}

/** Nombre total de commentaires d'un fil (racines + réponses) */
export function countComments(comments: SocialComment[]): number {
  return comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)
}

/** Mention insérée par « Répondre » : @pseudo (sans espace), sinon le nom affiché collé */
export function mentionOf(user: SocialCommentUser): string {
  const handle = user.profile?.username || (user.profile?.displayName || 'utilisateur').replace(/\s+/g, '')
  return `@${handle}`
}

export function displayNameOf(user: SocialCommentUser): string {
  return user.profile?.displayName || user.profile?.username || 'Utilisateur'
}
