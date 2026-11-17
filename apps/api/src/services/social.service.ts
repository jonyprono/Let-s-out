/**
 * Interactions « réseau social » communes aux commentaires de vlogs et de publications de pages :
 * fils de réponses (1 niveau, style Instagram), likes, format de réponse unique pour l'app.
 */

/** Longueur maximale d'un commentaire (réglage admin COMMENT_MAX_LENGTH) */
export const COMMENT_MAX_LENGTH = { key: 'COMMENT_MAX_LENGTH', fallback: 1000 } as const

type UserLite = { id: string; profile: { displayName: string | null; avatarUrl: string | null; username: string | null } | null }

/** Commentaire tel que lu en base (vlog : `content`, page : `text`) */
export interface RawComment {
  id: string
  userId: string
  parentId: string | null
  createdAt: Date
  content?: string
  text?: string
  user: UserLite
  _count: { likes: number }
  /** Likes de l'utilisateur courant (0 ou 1 élément) — absent si visiteur */
  likes?: { id: string }[]
}

export interface CommentDto {
  id: string
  userId: string
  parentId: string | null
  createdAt: Date
  /** Même texte sous les deux noms historiques (vlogs : `content`, pages : `text`) */
  content: string
  text: string
  user: UserLite
  likesCount: number
  likedByMe: boolean
  replies?: CommentDto[]
  repliesCount?: number
}

export function toCommentDto(c: RawComment): CommentDto {
  const body = c.content ?? c.text ?? ''
  return {
    id: c.id, userId: c.userId, parentId: c.parentId, createdAt: c.createdAt,
    content: body, text: body, user: c.user,
    likesCount: c._count?.likes ?? 0,
    likedByMe: !!c.likes?.length,
  }
}

/**
 * Regroupe une liste plate en fils : commentaires racines (ordre demandé) avec leurs réponses
 * (ordre chronologique). Une réponse orpheline (racine supprimée) n'est jamais affichée seule.
 */
export function buildCommentThreads(raw: RawComment[], rootOrder: 'asc' | 'desc'): CommentDto[] {
  const roots = raw.filter((c) => !c.parentId).map((c) => ({ ...toCommentDto(c), replies: [] as CommentDto[], repliesCount: 0 }))
  const byId = new Map(roots.map((r) => [r.id, r]))
  for (const c of raw) {
    if (!c.parentId) continue
    const root = byId.get(c.parentId)
    if (root) root.replies.push(toCommentDto(c))
  }
  for (const r of roots) {
    r.replies.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    r.repliesCount = r.replies.length
  }
  roots.sort((a, b) => (rootOrder === 'asc' ? 1 : -1) * (+new Date(a.createdAt) - +new Date(b.createdAt)))
  return roots
}

/** Sélection Prisma commune : auteur, nombre de likes, like de l'utilisateur courant */
export function commentInclude(viewerId: string | null) {
  return {
    user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
    _count: { select: { likes: true } },
    ...(viewerId ? { likes: { where: { userId: viewerId }, select: { id: true } } } : {}),
  }
}

/**
 * Bascule « J'aime » de façon sûre face aux doubles appuis / appels simultanés :
 * création (contrainte unique) puis, si le like existe déjà, suppression.
 * `desired` force un état (true = aimer, false = ne plus aimer) — utile pour un appel rejoué.
 */
export async function toggleLike(
  ops: { create: () => Promise<unknown>; remove: () => Promise<{ count: number }>; count: () => Promise<number> },
  desired?: boolean,
): Promise<{ liked: boolean; likesCount: number }> {
  let liked: boolean
  if (desired === false) {
    await ops.remove()
    liked = false
  } else {
    try {
      await ops.create()
      liked = true
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e
      // Déjà aimé : un appui = « ne plus aimer », sauf si l'appel demande explicitement « aimer »
      if (desired === true) liked = true
      else { await ops.remove(); liked = false }
    }
  }
  return { liked, likesCount: await ops.count() }
}

/** Texte de commentaire validé (non vide, longueur max) */
export function readCommentText(raw: unknown, maxLength: number): { ok: true; text: string } | { ok: false; error: string } {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return { ok: false, error: 'Le commentaire ne peut pas être vide' }
  if (text.length > maxLength) return { ok: false, error: `Le commentaire ne peut pas dépasser ${maxLength} caractères` }
  return { ok: true, text }
}

/** Extrait court pour une notification */
export function excerpt(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
