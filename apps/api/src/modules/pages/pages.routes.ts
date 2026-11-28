import { FastifyInstance } from 'fastify'
import { uploadBufferToCloudinaryDetailed, destroyCloudinaryAsset } from '../../services/cloudinary.service'
import { isVideoDurationTooLong, videoTooLongBody } from '../../config/video-limits'
import { createAndSendNotification, createAndSendNotificationMany } from '../notifications/notifications.routes'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import {
  readDocumentsForm, DocumentUploadError, documentErrorMessage,
} from '../../services/private-documents.service'
import {
  PAGE_ENTITY_TYPES, PAGE_DOC_FIELDS, REQUIRED_PAGE_DOCS, type PageEntityType,
} from '../../services/page-verification-policy'
import {
  buildCommentThreads, commentInclude, COMMENT_MAX_LENGTH, excerpt, readCommentText, toCommentDto, toggleLike,
} from '../../services/social.service'

const viewerOf = (req: any): string | null => {
  try { return (req.user as any)?.sub ?? null } catch { return null }
}

/** Compteurs d'une publication : commentaires, likes, et « aimé par moi » */
function postSocialInclude(viewerId: string | null) {
  return {
    _count: { select: { comments: true, likes: true } },
    ...(viewerId ? { likes: { where: { userId: viewerId }, select: { id: true } } } : {}),
  }
}

/** Ajoute likesCount / hasLiked et retire la liste brute des likes */
function withPostLikes<T extends { _count?: any; likes?: any[] }>(post: T) {
  const { likes, ...rest } = post as any
  return { ...rest, likesCount: post._count?.likes ?? 0, hasLiked: !!likes?.length }
}


/** Champs de certification affichés partout où une page apparaît (badge à côté du nom). */
const PAGE_BADGE_SELECT = { verificationStatus: true, verificationBadge: true } as const

export default async function pagesRoutes(app: FastifyInstance) {
  // CREATE A PAGE
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { name, description, category, avatarUrl, coverUrl } = req.body as any

    if (!name || !category) {
      return reply.code(400).send({ error: 'Name and category are required' })
    }

    const page = await app.prisma.page.create({
      data: {
        creatorId: sub,
        name,
        description,
        category,
        avatarUrl,
        coverUrl
      }
    })

    return reply.code(201).send(page)
  })

  // LIST MY PAGES
  app.get('/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const pages = await app.prisma.page.findMany({
      where: { creatorId: sub },
      orderBy: { createdAt: 'desc' },
      // Compteurs pour l'écran « Mes pages » (abonnés, publications)
      include: { _count: { select: { followers: true, posts: true } } },
    })
    return reply.send({ data: pages })
  })

  // STATISTIQUES D'UNE PAGE — créateur uniquement
  // Abonnés, publications, commentaires reçus, nouveaux abonnés (7 / 30 j) et nouveaux abonnés par jour (30 j)
  app.get('/:id/stats', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const page = await app.prisma.page.findUnique({ where: { id }, select: { creatorId: true } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const DAY = 24 * 60 * 60 * 1000
    const now = new Date()
    const since30 = new Date(now.getTime() - 30 * DAY)
    const since7 = new Date(now.getTime() - 7 * DAY)

    const [followersCount, postsCount, commentsCount, recentFollows] = await Promise.all([
      app.prisma.pageFollower.count({ where: { pageId: id } }),
      app.prisma.pagePost.count({ where: { pageId: id } }),
      app.prisma.pagePostComment.count({ where: { post: { pageId: id } } }),
      app.prisma.pageFollower.findMany({ where: { pageId: id, createdAt: { gte: since30 } }, select: { createdAt: true } }),
    ])

    // Série journalière sur 30 jours (UTC), jours sans abonnement inclus à 0
    const byDay = new Map<string, number>()
    for (let i = 29; i >= 0; i--) byDay.set(new Date(now.getTime() - i * DAY).toISOString().slice(0, 10), 0)
    for (const f of recentFollows) {
      const key = f.createdAt.toISOString().slice(0, 10)
      if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + 1)
    }

    return reply.send({
      followersCount,
      postsCount,
      commentsCount,
      newFollowers7d: recentFollows.filter((f) => f.createdAt >= since7).length,
      newFollowers30d: recentFollows.length,
      followersTimeline: [...byDay].map(([date, count]) => ({ date, count })),
    })
  })

  // ABONNÉS D'UNE PAGE — créateur uniquement, du plus récent au plus ancien, paginé par curseur
  app.get('/:id/followers', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { cursor } = req.query as { cursor?: string }
    const page = await app.prisma.page.findUnique({ where: { id }, select: { creatorId: true } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const LIMIT = 30
    const rows = await app.prisma.pageFollower.findMany({
      where: { pageId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: LIMIT + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, profile: { select: { displayName: true, username: true, avatarUrl: true } } } },
      },
    })
    const hasMore = rows.length > LIMIT
    const items = rows.slice(0, LIMIT)
    return reply.send({
      data: items.map((r) => ({
        userId: r.user.id,
        displayName: r.user.profile?.displayName || 'Utilisateur',
        username: r.user.profile?.username ?? null,
        avatarUrl: r.user.profile?.avatarUrl ?? null,
        followedAt: r.createdAt,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    })
  })

  // LIST PAGES (by creatorId or discovery)
  app.get('/', { preHandler: [app.optionalAuthenticate] }, async (req, reply) => {
    let sub: string | undefined = undefined
    try {
      const u = req.user as { sub?: string }
      if (u?.sub) sub = u.sub
    } catch {}

    const query = req.query as { creatorId?: string; limit?: string }
    const where: any = {}
    if (query.creatorId) {
      where.creatorId = query.creatorId
    }

    const pages = await app.prisma.page.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit ? parseInt(query.limit, 10) : 50,
      include: {
        _count: { select: { followers: true, posts: true } },
        creator: {
          select: {
            id: true,
            profile: {
              select: { displayName: true, avatarUrl: true, username: true }
            }
          }
        }
      }
    })

    let followedPageIds = new Set<string>()
    if (sub && pages.length > 0) {
      const follows = await app.prisma.pageFollower.findMany({
        where: { userId: sub, pageId: { in: pages.map(p => p.id) } },
        select: { pageId: true }
      })
      followedPageIds = new Set(follows.map(f => f.pageId))
    }

    const data = pages.map(p => ({
      ...p,
      isFollowing: followedPageIds.has(p.id)
    }))

    return reply.send({ data })
  })

  // GET GLOBAL FEED OF PAGES POSTS (Public feed for all users, like events, respects blocks)
  app.get('/feed', { preHandler: [app.optionalAuthenticate] }, async (req, reply) => {
    let sub: string | undefined = undefined
    try {
      const u = req.user as { sub?: string }
      if (u?.sub) sub = u.sub
    } catch {
      // unauthenticated
    }

    const query = req.query as { limit?: string; offset?: string; cursor?: string }
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 50)
    const offset = query.offset !== undefined ? parseInt(query.offset, 10) : undefined
    const cursor = query.cursor

    const blockedUserIds = new Set<string>()
    const followedPageIds = new Set<string>()

    if (sub) {
      const [blocks, follows] = await Promise.all([
        app.prisma.userBlock.findMany({
          where: {
            OR: [
              { blockerId: sub },
              { blockedId: sub }
            ]
          },
          select: { blockerId: true, blockedId: true }
        }),
        app.prisma.pageFollower.findMany({
          where: { userId: sub },
          select: { pageId: true }
        })
      ])

      for (const b of blocks) {
        if (b.blockerId === sub) blockedUserIds.add(b.blockedId)
        if (b.blockedId === sub) blockedUserIds.add(b.blockerId)
      }

      for (const f of follows) {
        followedPageIds.add(f.pageId)
      }
    }

    const where: any = {
      page: {
        creator: {
          isBanned: false,
          ...(blockedUserIds.size > 0 ? { NOT: { id: { in: Array.from(blockedUserIds) } } } : {})
        }
      }
    }

    const findManyArgs: any = {
      where,
      include: {
        page: { select: { id: true, name: true, avatarUrl: true, creatorId: true, ...PAGE_BADGE_SELECT } },
        ...postSocialInclude(sub ?? null),
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    }

    if (cursor) {
      findManyArgs.cursor = { id: cursor }
      findManyArgs.skip = 1
    } else if (offset !== undefined && !isNaN(offset)) {
      findManyArgs.skip = offset
    }

    const posts = await app.prisma.pagePost.findMany(findManyArgs)

    const data = posts.map((post: any) => ({
      ...withPostLikes(post),
      isFollowing: followedPageIds.has(post.pageId),
      isOwner: sub ? post.page.creatorId === sub : false
    }))

    const nextCursor = data.length === limit ? data[data.length - 1].id : null

    return reply.send({
      data,
      nextCursor,
      hasMore: data.length === limit
    })
  })

  // GET PAGE BY ID (works with or without authentication)
  app.get('/:id', { preHandler: [app.optionalAuthenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const page = await app.prisma.page.findUnique({
      where: { id },
      include: {
        _count: { select: { followers: true, posts: true } },
        creator: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
                username: true,
              }
            }
          }
        }
      }
    })
    if (!page) return reply.code(404).send({ error: 'Page not found' })

    // Check if current user follows (user is available if token was provided)
    let isFollowing = false
    try {
      const { sub } = req.user as { sub: string }
      if (sub) {
        const follow = await app.prisma.pageFollower.findUnique({
          where: { pageId_userId: { pageId: id, userId: sub } }
        })
        isFollowing = !!follow
      }
    } catch {
      // No authenticated user — ignore
    }

    return reply.send({ ...page, isFollowing })
  })

  // FOLLOW/UNFOLLOW PAGE
  app.post('/:id/follow', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })

    // A creator cannot follow their own page
    if (page.creatorId === sub) {
      return reply.code(400).send({ error: 'Vous ne pouvez pas suivre votre propre page' })
    }

    const existing = await app.prisma.pageFollower.findUnique({
      where: { pageId_userId: { pageId: id, userId: sub } }
    })

    if (existing) {
      await app.prisma.pageFollower.delete({ where: { id: existing.id } })
      return reply.send({ followed: false })
    } else {
      await app.prisma.pageFollower.create({
        data: { pageId: id, userId: sub }
      })
      return reply.send({ followed: true })
    }
  })

  // UPDATE PAGE
  app.patch('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const body = req.body as any

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    // Anti-usurpation : une page certifiée (ou en cours d'examen) ne peut pas changer de nom,
    // sinon le badge obtenu pour un nom pourrait être réutilisé sous un autre.
    const nameChanged = typeof body.name === 'string' && body.name.trim() !== page.name
    if (nameChanged && (page.verificationStatus === 'VERIFIED' || page.verificationStatus === 'PENDING')) {
      return reply.code(409).send({
        error: 'Le nom d\'une page certifiée ou en cours de certification ne peut pas être modifié.',
        code: 'PAGE_NAME_LOCKED',
      })
    }

    const updated = await app.prisma.page.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        avatarUrl: body.avatarUrl,
        coverUrl: body.coverUrl,
      }
    })
    return reply.send(updated)
  })

  // CERTIFICATION — statut et dernier dossier (propriétaire uniquement, sans les pièces)
  app.get('/:id/verification', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const page = await app.prisma.page.findUnique({
      where: { id },
      select: { creatorId: true, verificationStatus: true, verificationBadge: true, verifiedAt: true },
    })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })
    const lastRequest = await app.prisma.pageVerificationRequest.findFirst({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, entityType: true, status: true, rejectionReason: true, createdAt: true, reviewedAt: true },
    })
    return reply.send({
      status: page.verificationStatus,
      badge: page.verificationBadge,
      verifiedAt: page.verifiedAt,
      lastRequest,
    })
  })

  // CERTIFICATION — dépôt du dossier (multipart : entityType + pièces privées)
  app.post('/:id/verify-request', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const page = await app.prisma.page.findUnique({ where: { id }, select: { creatorId: true, verificationStatus: true } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })
    if (page.verificationStatus === 'VERIFIED') {
      return reply.code(409).send({ error: 'Cette page est déjà certifiée.', code: 'ALREADY_VERIFIED' })
    }
    if (page.verificationStatus === 'PENDING') {
      return reply.code(409).send({ error: 'Une demande est déjà en cours d\'examen.', code: 'REQUEST_PENDING' })
    }

    let form
    try {
      form = await readDocumentsForm(req, { folder: `page-verification/${id}`, documentFields: PAGE_DOC_FIELDS })
    } catch (e) {
      if (e instanceof DocumentUploadError) return reply.code(400).send({ error: documentErrorMessage(e), code: e.code })
      throw e
    }

    const entityType = form.fields.entityType as PageEntityType
    if (!PAGE_ENTITY_TYPES.includes(entityType)) {
      return reply.code(400).send({ error: 'Type de structure invalide', code: 'INVALID_ENTITY_TYPE' })
    }
    const missing = REQUIRED_PAGE_DOCS[entityType].filter((d) => !form.documents[d])
    if (missing.length > 0) {
      return reply.code(400).send({ error: 'Pièces obligatoires manquantes', code: 'MISSING_DOCUMENTS', missing })
    }

    const [request] = await app.prisma.$transaction([
      app.prisma.pageVerificationRequest.create({
        data: { pageId: id, submittedById: sub, entityType, documents: form.documents },
        select: { id: true, entityType: true, status: true, createdAt: true },
      }),
      app.prisma.page.update({ where: { id }, data: { verificationStatus: 'PENDING' } }),
    ])
    return reply.code(201).send({ data: request })
  })

  // DELETE PAGE
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    await app.prisma.page.delete({ where: { id } })
    return reply.send({ success: true })
  })

  // CREATE POST
  app.post('/:id/posts', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { content, mediaUrls, videoDuration } = req.body as any

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    // Durée max des vidéos (même règle que les OUT VLOGS). Champ facultatif : les anciennes
    // versions de l'app ne l'envoient pas (publication acceptée comme avant).
    if (videoDuration !== undefined && videoDuration !== null) {
      const d = Number(videoDuration)
      if (Number.isFinite(d) && isVideoDurationTooLong(d)) {
        return reply.code(400).send({ ...videoTooLongBody(), field: 'videoDuration' })
      }
    }

    const post = await app.prisma.pagePost.create({
      data: {
        pageId: id,
        content,
        mediaUrls: mediaUrls || []
      }
    })

    // Notify all followers about the new post
    try {
      const followers = await app.prisma.pageFollower.findMany({
        where: { pageId: id, NOT: { userId: sub } },
        select: { userId: true }
      })

      if (followers.length > 0) {
        await createAndSendNotificationMany(app, followers.map(f => ({
          userId: f.userId,
          type: 'PAGE_POST',
          title: `${page.name} a publié`,
          body: content ? content.slice(0, 100) : 'Nouvelle publication sur la page',
          data: { pageId: id, postId: post.id }
        })))
      }
    } catch (e) {
      app.log.warn(`[PAGE_POST] Failed to send notifications: ${e}`)
    }

    return reply.code(201).send(post)
  })

  // LIST POSTS (include comment count + comments)
  app.get('/:id/posts', { preHandler: [app.optionalAuthenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const viewerId = viewerOf(req)

    const posts = await app.prisma.pagePost.findMany({
      where: { pageId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        ...postSocialInclude(viewerId),
        comments: {
          where: { parentId: null }, // aperçu : commentaires racines uniquement
          orderBy: { createdAt: 'asc' },
          take: 5,
          include: {
            user: { select: { id: true, profile: { select: { username: true, avatarUrl: true, displayName: true } } } }
          }
        }
      }
    })
    return reply.send({ data: posts.map(withPostLikes) })
  })

  // ONE POST (lien partagé /posts/:postId) — même filtrage que le fil (créateur banni / blocages)
  app.get('/posts/:postId', { preHandler: [app.optionalAuthenticate] }, async (req, reply) => {
    const { postId } = req.params as { postId: string }
    const viewerId = viewerOf(req)
    const post = await app.prisma.pagePost.findUnique({
      where: { id: postId },
      include: {
        page: { select: { id: true, name: true, avatarUrl: true, creatorId: true, ...PAGE_BADGE_SELECT, creator: { select: { isBanned: true } } } },
        ...postSocialInclude(viewerId),
      },
    })
    if (!post || post.page.creator?.isBanned) return reply.code(404).send({ error: 'Publication introuvable', code: 'POST_NOT_FOUND' })
    if (viewerId) {
      const blocked = await app.prisma.userBlock.findFirst({
        where: { OR: [{ blockerId: viewerId, blockedId: post.page.creatorId }, { blockerId: post.page.creatorId, blockedId: viewerId }] },
        select: { id: true },
      })
      if (blocked) return reply.code(404).send({ error: 'Publication introuvable', code: 'POST_NOT_FOUND' })
    }
    const following = viewerId
      ? !!(await app.prisma.pageFollower.findUnique({ where: { pageId_userId: { pageId: post.pageId, userId: viewerId } } }))
      : false
    const { creator: _creator, ...page } = post.page
    return reply.send({
      data: { ...withPostLikes({ ...post, page }), isFollowing: following, isOwner: viewerId ? post.page.creatorId === viewerId : false },
    })
  })

  // LIKE / UNLIKE A POST (bascule ; corps facultatif { liked: true|false })
  app.post('/:id/posts/:postId/like', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, postId } = req.params as { id: string; postId: string }
    const desired = (req.body as any)?.liked
    const post = await app.prisma.pagePost.findFirst({ where: { id: postId, pageId: id }, select: { id: true } })
    if (!post) return reply.code(404).send({ error: 'Publication introuvable' })
    const res = await toggleLike({
      create: () => app.prisma.pagePostLike.create({ data: { userId: sub, postId } }),
      remove: () => app.prisma.pagePostLike.deleteMany({ where: { userId: sub, postId } }),
      count: () => app.prisma.pagePostLike.count({ where: { postId } }),
    }, typeof desired === 'boolean' ? desired : undefined)
    return reply.send(res)
  })

  // GET COMMENTS FOR A POST — fils (racines + réponses), likes, « aimé par moi »
  app.get('/:id/posts/:postId/comments', { preHandler: [app.optionalAuthenticate] }, async (req, reply) => {
    const { id, postId } = req.params as { id: string; postId: string }
    const viewerId = viewerOf(req)
    const post = await app.prisma.pagePost.findFirst({ where: { id: postId, pageId: id }, select: { id: true } })
    if (!post) return reply.code(404).send({ error: 'Publication introuvable' })
    const raw = await app.prisma.pagePostComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: commentInclude(viewerId),
    })
    return reply.send({ data: buildCommentThreads(raw as any, 'asc') })
  })

  // ADD COMMENT TO A POST — `parentId` facultatif : réponse (rattachée au commentaire RACINE)
  app.post('/:id/posts/:postId/comments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, postId } = req.params as { id: string; postId: string }
    const { text, parentId } = (req.body ?? {}) as { text?: string; parentId?: string | null }

    const setting = await app.prisma.systemSetting.findUnique({ where: { key: COMMENT_MAX_LENGTH.key } })
    const maxLength = setting && Number(setting.value) > 0 ? Number(setting.value) : COMMENT_MAX_LENGTH.fallback
    const parsed = readCommentText(text, maxLength)
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error })

    const post = await app.prisma.pagePost.findFirst({ where: { id: postId, pageId: id }, select: { id: true } })
    if (!post) return reply.code(404).send({ error: 'Publication introuvable' })

    let rootId: string | null = null
    let repliedToUserId: string | null = null
    if (parentId) {
      const parent = await app.prisma.pagePostComment.findFirst({ where: { id: parentId, postId }, select: { id: true, parentId: true, userId: true } })
      if (!parent) return reply.code(404).send({ error: 'Commentaire introuvable', code: 'PARENT_NOT_FOUND' })
      rootId = parent.parentId ?? parent.id
      repliedToUserId = parent.userId
    }

    const created = await app.prisma.pagePostComment.create({
      data: { postId, userId: sub, text: parsed.text, parentId: rootId },
      include: commentInclude(sub),
    })

    if (repliedToUserId && repliedToUserId !== sub) {
      const author = created.user?.profile?.displayName || created.user?.profile?.username || "Quelqu'un"
      createAndSendNotification(app, {
        userId: repliedToUserId,
        type: 'COMMENT_REPLY',
        title: `${author} a répondu à votre commentaire`,
        body: excerpt(parsed.text),
        data: { pageId: id, postId, commentId: created.id, screen: 'post' },
      }).catch(() => {})
    }

    // Format historique (objet à la racine) conservé + champs sociaux
    return reply.code(201).send(toCommentDto(created as any))
  })

  // LIKE / UNLIKE A COMMENT (bascule ; corps facultatif { liked: true|false })
  app.post('/:id/posts/:postId/comments/:commentId/like', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, postId, commentId } = req.params as { id: string; postId: string; commentId: string }
    const desired = (req.body as any)?.liked
    const comment = await app.prisma.pagePostComment.findFirst({ where: { id: commentId, postId, post: { pageId: id } }, select: { id: true } })
    if (!comment) return reply.code(404).send({ error: 'Commentaire introuvable' })
    const res = await toggleLike({
      create: () => app.prisma.pagePostCommentLike.create({ data: { userId: sub, commentId } }),
      remove: () => app.prisma.pagePostCommentLike.deleteMany({ where: { userId: sub, commentId } }),
      count: () => app.prisma.pagePostCommentLike.count({ where: { commentId } }),
    }, typeof desired === 'boolean' ? desired : undefined)
    return reply.send(res)
  })

  // DELETE COMMENT ON A POST (author or page creator)
  app.delete('/:id/posts/:postId/comments/:commentId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, commentId } = req.params as { id: string; postId: string; commentId: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    const comment = await app.prisma.pagePostComment.findUnique({ where: { id: commentId } })
    if (!comment) return reply.code(404).send({ error: 'Comment not found' })

    if (comment.userId !== sub && page?.creatorId !== sub) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    await app.prisma.pagePostComment.delete({ where: { id: commentId } })
    return reply.send({ success: true })
  })

  // DELETE A POST (creator of the page only)
  app.delete('/:id/posts/:postId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, postId } = req.params as { id: string; postId: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    await app.prisma.pagePost.delete({ where: { id: postId } })
    return reply.send({ success: true })
  })

  // UPDATE A POST (creator of the page only)
  app.patch('/:id/posts/:postId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, postId } = req.params as { id: string; postId: string }
    const { content } = req.body as { content?: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const post = await app.prisma.pagePost.findUnique({ where: { id: postId } })
    if (!post || post.pageId !== id) return reply.code(404).send({ error: 'Post not found' })

    const updated = await app.prisma.pagePost.update({
      where: { id: postId },
      data: {
        content: content !== undefined ? content : post.content,
      }
    })
    return reply.send(updated)
  })

  // UPLOAD IMAGE (avatar or cover)
  app.post('/:id/upload-image', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const page = await app.prisma.page.findUnique({ where: { id } })
    if (!page) return reply.code(404).send({ error: 'Page not found' })
    if (page.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    let imageUrl: string | null = null
    let imageType: 'avatar' | 'cover' | 'post' = 'post'

    for await (const part of req.parts()) {
      if (part.type === 'field') {
        if (part.fieldname === 'type' && ['avatar', 'cover', 'post'].includes(part.value as string)) {
          imageType = part.value as 'avatar' | 'cover' | 'post'
        }
        continue
      }
      if (part.type !== 'file') continue
      const ext = path.extname(part.filename) || '.jpg'
      const filename = `page-${imageType}-${uuidv4()}${ext}`
      const buffer = await part.toBuffer()
      // Envoi de secours d'une vidéo de publication (si l'envoi direct a échoué) : la durée réelle
      // est connue ici → refus au-delà de la limite, fichier supprimé.
      const uploaded = await uploadBufferToCloudinaryDetailed(buffer, `pages/${id}`, filename)
      if (uploaded.resourceType === 'video' && uploaded.duration !== null && isVideoDurationTooLong(uploaded.duration)) {
        await destroyCloudinaryAsset(uploaded.publicId, uploaded.resourceType)
        return reply.code(400).send(videoTooLongBody())
      }
      imageUrl = uploaded.url
    }

    if (!imageUrl) return reply.code(400).send({ error: 'No file provided' })

    // Automatically persist the avatar or cover URL to the page
    if (imageType === 'avatar') {
      await app.prisma.page.update({
        where: { id },
        data: { avatarUrl: imageUrl }
      })
    } else if (imageType === 'cover') {
      await app.prisma.page.update({
        where: { id },
        data: { coverUrl: imageUrl }
      })
    }

    return reply.send({ url: imageUrl, type: imageType })
  })
}
