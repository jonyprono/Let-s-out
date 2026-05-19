import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createAndSendNotification } from '../notifications/notifications.routes'

export default async function usersRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate)

  // Get user profile by user ID (public)
  app.get('/by-id/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { sub } = req.user as { sub: string }

    const profile = await app.prisma.profile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, role: true, createdAt: true, lastSeenAt: true } } },
    })
    if (!profile) return reply.code(404).send({ error: 'User not found' })

    const friendship = await app.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: sub, receiverId: userId },
          { initiatorId: userId, receiverId: sub }
        ]
      }
    })

    let friendshipStatus = 'none'
    if (friendship) {
      if (friendship.status === 'ACCEPTED') {
        friendshipStatus = 'friend'
      } else {
        friendshipStatus = friendship.initiatorId === sub ? 'pending_sent' : 'pending_received'
      }
    }

    return reply.send({ ...profile, friendshipStatus })
  })

  // Get user profile by username
  app.get('/:username', async (req, reply) => {
    const { username } = req.params as { username: string }
    const { sub } = req.user as { sub: string }

    let profile = await app.prisma.profile.findUnique({
      where: { username },
      include: { user: { select: { id: true, role: true, createdAt: true, lastSeenAt: true } } },
    })
    
    // Fallback: If username wasn't found, try treating the parameter as a userId
    if (!profile) {
      profile = await app.prisma.profile.findUnique({
        where: { userId: username },
        include: { user: { select: { id: true, role: true, createdAt: true, lastSeenAt: true } } },
      })
    }
    
    if (!profile) return reply.code(404).send({ error: 'User not found' })

    const userId = profile.userId
    const friendship = await app.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: sub, receiverId: userId },
          { initiatorId: userId, receiverId: sub }
        ]
      }
    })

    let friendshipStatus = 'none'
    if (friendship) {
      if (friendship.status === 'ACCEPTED') {
        friendshipStatus = 'friend'
      } else {
        friendshipStatus = friendship.initiatorId === sub ? 'pending_sent' : 'pending_received'
      }
    }

    return reply.send({ ...profile, friendshipStatus })
  })

  // Update own profile
  app.patch('/me/profile', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const body = req.body as any
    const profile = await app.prisma.profile.update({
      where: { userId: sub },
      data: {
        displayName: body.displayName,
        bio: body.bio,
        city: body.city,
        country: body.country,
        latitude: body.latitude,
        longitude: body.longitude,
        interests: body.interests,
        avatarUrl: body.avatarUrl,
        coverUrl: body.coverUrl,
        isPublic: body.isPublic,
      },
    })
    return reply.send(profile)
  })

  // Update password
  app.patch('/me/password', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const schema = z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(6),
    })

    const result = schema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Données invalides' })

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    if (!user || !user.passwordHash) return reply.code(400).send({ error: 'Aucun mot de passe défini' })

    const valid = await bcrypt.compare(result.data.oldPassword, user.passwordHash)
    if (!valid) return reply.code(400).send({ error: 'Ancien mot de passe incorrect' })

    const newHash = await bcrypt.hash(result.data.newPassword, 10)
    await app.prisma.user.update({
      where: { id: sub },
      data: { passwordHash: newHash }
    })

    return reply.send({ success: true })
  })

  // Update phone
  app.patch('/me/phone', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const schema = z.object({ phone: z.string().min(6) })

    const result = schema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Numéro invalide' })

    const existing = await app.prisma.user.findUnique({ where: { phone: result.data.phone } })
    if (existing && existing.id !== sub) {
      return reply.code(409).send({ error: 'Ce numéro est déjà utilisé' })
    }

    const updated = await app.prisma.user.update({
      where: { id: sub },
      data: { phone: result.data.phone }
    })

    return reply.send({ success: true, phone: updated.phone })
  })

  // Get friends list
  app.get('/me/friends', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { search } = req.query as { search?: string }
    const friendships = await app.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: sub },
          { receiverId: sub },
        ]
      },
      include: {
        initiator: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
        receiver: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
      }
    })

    // Extract the friend's profile (the one who is not the current user)
    let friends = friendships.map(f => {
      const isInitiator = f.initiatorId === sub
      const friendId = isInitiator ? f.receiverId : f.initiatorId
      const profile = isInitiator ? f.receiver.profile : f.initiator.profile
      return {
        userId: friendId,
        friendshipId: f.id,
        username: profile?.username,
        displayName: profile?.displayName,
        avatarUrl: profile?.avatarUrl,
      }
    })

    if (search) {
      const s = search.toLowerCase()
      friends = friends.filter(f => f.displayName?.toLowerCase().includes(s) || f.username?.toLowerCase().includes(s))
    }

    return reply.send({ data: friends })
  })

  // Get pending friend requests received by current user
  app.get('/me/friend-requests', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const requests = await app.prisma.friendship.findMany({
      where: { receiverId: sub, status: 'PENDING' },
      include: {
        initiator: {
          select: {
            id: true,
            profile: { select: { username: true, displayName: true, avatarUrl: true, bio: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ data: requests })
  })

  // Search users
  app.get('/search', async (req, reply) => {
    const { q, limit = '20', offset = '0' } = req.query as any
    const users = await app.prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        isPublic: true,
      },
      take: Number(limit),
      skip: Number(offset),
    })
    return reply.send({ data: users, total: users.length })
  })

  // Send friend request
  app.post('/:userId/friend-request', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { userId } = req.params as { userId: string }
    if (sub === userId) return reply.code(400).send({ error: 'Cannot add yourself' })

    const existing = await app.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: sub, receiverId: userId },
          { initiatorId: userId, receiverId: sub },
        ],
      },
    })
    if (existing) return reply.code(409).send({ error: 'Request already exists' })

    const friendship = await app.prisma.friendship.create({
      data: { initiatorId: sub, receiverId: userId },
    })

    // Fetch initiator details for the notification
    const initiatorProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
    const initiatorName = initiatorProfile?.displayName || 'Quelqu\'un'

    // Create Notification
    await createAndSendNotification(app, {
      userId: userId,
      type: 'FRIEND_REQUEST',
      title: 'Nouvelle demande d\'ami',
      body: `${initiatorName} vous a envoyé une demande d'ami.`,
      data: { friendshipId: friendship.id, initiatorId: sub }
    })

    return reply.code(201).send(friendship)
  })

  // Accept friend request
  app.patch('/friend-requests/:friendshipId/accept', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { friendshipId } = req.params as { friendshipId: string }

    const friendship = await app.prisma.friendship.findFirst({
      where: { id: friendshipId, receiverId: sub, status: 'PENDING' },
    })
    if (!friendship) return reply.code(404).send({ error: 'Friend request not found' })

    const updated = await app.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    })

    // Fetch receiver (who accepted) details for the notification
    const receiverProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
    const receiverName = receiverProfile?.displayName || 'Quelqu\'un'

    // Create Notification for the initiator
    await createAndSendNotification(app, {
      userId: friendship.initiatorId,
      type: 'FRIEND_ACCEPTED',
      title: 'Demande d\'ami acceptée',
      body: `${receiverName} a accepté votre demande d'ami.`,
      data: { friendshipId: friendship.id, receiverId: sub }
    })

    return reply.send(updated)
  })

  // Get user activity (created events & past participated events)
  app.get('/:userId/activity', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { sub } = req.user as { sub: string }
    const isOwner = sub === userId

    // Events created by user
    const createdEvents = await app.prisma.event.findMany({
      where: { 
        creatorId: userId, 
        status: 'PUBLISHED', 
        ...(isOwner ? {} : { isPrivate: false }) 
      },
      orderBy: { startAt: 'desc' },
      take: 20,
      include: {
        creator: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
        bookings: {
          where: { status: 'CONFIRMED' },
          take: 3,
          select: { user: { select: { profile: { select: { avatarUrl: true } } } } },
        },
        _count: { select: { bookings: true } },
      }
    })

    // Past events participated in
    const bookings = await app.prisma.booking.findMany({
      where: {
        userId,
        status: 'CONFIRMED',
        event: { startAt: { lt: new Date() }, isPrivate: false }
      },
      include: {
        event: {
          include: {
            creator: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
            reviews: isOwner ? undefined : { where: { userId } },
            bookings: {
              where: { status: 'CONFIRMED' },
              take: 3,
              select: { user: { select: { profile: { select: { avatarUrl: true } } } } },
            },
            _count: { select: { bookings: true } },
          }
        }
      },
      orderBy: { event: { startAt: 'desc' } },
      take: 10
    })

    const pastEvents = bookings.map(b => ({
      ...b.event,
      isReviewed: b.event.reviews && b.event.reviews.length > 0
    }))

    let draftEvents: any[] = []
    if (isOwner) {
      draftEvents = await app.prisma.event.findMany({
        where: {
          creatorId: userId,
          status: 'DRAFT'
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
          bookings: {
            where: { status: 'CONFIRMED' },
            take: 3,
            select: { user: { select: { profile: { select: { avatarUrl: true } } } } },
          },
          _count: { select: { bookings: true } },
        }
      })
    }

    return reply.send({
      createdEvents,
      pastEvents,
      draftEvents
    })
  })

  // ─── FOLLOWERS ─────────────────────────────────────────────────────────────

  // Follow a user
  app.post('/:userId/follow', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { userId } = req.params as { userId: string }
    
    if (sub === userId) return reply.code(400).send({ error: 'Cannot follow yourself' })
    
    const existing = await app.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: sub, followingId: userId } }
    })
    
    if (existing) return reply.send({ success: true, message: 'Already following' })
    
    await app.prisma.$transaction([
      app.prisma.follow.create({ data: { followerId: sub, followingId: userId } }),
      app.prisma.profile.update({ where: { userId: userId }, data: { followersCount: { increment: 1 } } }),
      app.prisma.profile.update({ where: { userId: sub }, data: { followingCount: { increment: 1 } } })
    ])
    
    return reply.code(201).send({ success: true })
  })

  // Unfollow a user
  app.delete('/:userId/follow', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { userId } = req.params as { userId: string }
    
    const existing = await app.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: sub, followingId: userId } }
    })
    
    if (!existing) return reply.send({ success: true, message: 'Not following' })
    
    await app.prisma.$transaction([
      app.prisma.follow.delete({ where: { followerId_followingId: { followerId: sub, followingId: userId } } }),
      app.prisma.profile.update({ where: { userId: userId }, data: { followersCount: { decrement: 1 } } }),
      app.prisma.profile.update({ where: { userId: sub }, data: { followingCount: { decrement: 1 } } })
    ])
    
    return reply.send({ success: true })
  })

  // Get followers
  app.get('/:userId/followers', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const follows = await app.prisma.follow.findMany({
      where: { followingId: userId },
      include: { follower: { select: { profile: { select: { userId: true, username: true, displayName: true, avatarUrl: true } } } } }
    })
    return reply.send({ data: follows.map(f => f.follower.profile) })
  })

  // Get following
  app.get('/:userId/following', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const follows = await app.prisma.follow.findMany({
      where: { followerId: userId },
      include: { following: { select: { profile: { select: { userId: true, username: true, displayName: true, avatarUrl: true } } } } }
    })
    return reply.send({ data: follows.map(f => f.following.profile) })
  })
}
