import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { createAndSendNotification } from '../notifications/notifications.routes'
import { uploadBufferToCloudinary } from '../../services/cloudinary.service'
import { evaluateUserBadges } from '../../services/badge.service'

async function getDetailedStats(app: FastifyInstance, userId: string) {
  const events = await app.prisma.event.findMany({
    where: { creatorId: userId },
    include: { reviews: true }
  });
  
  let reviewCount = 0;
  let totalRating = 0;
  let punctuality = 0;
  let attitude = 0;
  let reliability = 0;
  
  for (const e of events) {
    for (const r of e.reviews) {
      reviewCount++;
      totalRating += r.rating;
      punctuality += (r.punctualityRating ?? r.rating);
      attitude += (r.attitudeRating ?? r.rating);
      reliability += (r.reliabilityRating ?? r.rating);
    }
  }
  
  if (reviewCount === 0) return null;
  return {
    reviewCount,
    rating: totalRating / reviewCount,
    punctuality: punctuality / reviewCount,
    attitude: attitude / reviewCount,
    reliability: reliability / reviewCount
  };
}

export default async function usersRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate)

  // Get user profile by user ID (public)
  app.get('/by-id/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { sub } = req.user as { sub: string }

    const profile = await app.prisma.profile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, role: true, createdAt: true, lastSeenAt: true, badges: true } } },
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
      if (friendship.status === 'BLOCKED') {
        if (friendship.receiverId === sub) {
          // The current user has been blocked by the target user
          return reply.code(403).send({ error: 'Vous ne pouvez pas voir ce profil.' })
        } else {
          // The current user blocked the target user
          friendshipStatus = 'blocked'
        }
      } else if (friendship.status === 'ACCEPTED') {
        friendshipStatus = 'friend'
      } else {
        friendshipStatus = friendship.initiatorId === sub ? 'pending_sent' : 'pending_received'
      }
    }

    const followRecord = await app.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: sub, followingId: userId } }
    })
    const isFollowing = !!followRecord

    // Common events: events both users have a confirmed booking on
    const commonEvents = await app.prisma.event.findMany({
      where: {
        bookings: {
          some: { userId: sub, status: 'CONFIRMED' }
        },
        AND: [
          { bookings: { some: { userId: userId, status: 'CONFIRMED' } } }
        ]
      },
      select: { id: true }
    })
    const commonEventsCount = commonEvents.length

    const detailedStats = await getDetailedStats(app, userId)

    const friendsCount = await app.prisma.friendship.count({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'ACCEPTED' }
    })

    return reply.send({ ...profile, friendshipStatus, isFollowing, commonEventsCount, detailedStats, friendsCount })
  })

  // Get user profile by username
  app.get('/:username', async (req, reply) => {
    const { username } = req.params as { username: string }
    const { sub } = req.user as { sub: string }

    let profile = await app.prisma.profile.findUnique({
      where: { username },
      include: { user: { select: { id: true, role: true, createdAt: true, lastSeenAt: true, badges: true } } },
    })
    
    // Fallback: If username wasn't found, try treating the parameter as a userId
    if (!profile) {
      profile = await app.prisma.profile.findUnique({
        where: { userId: username },
        include: { user: { select: { id: true, role: true, createdAt: true, lastSeenAt: true, badges: true } } },
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
      if (friendship.status === 'BLOCKED') {
        if (friendship.receiverId === sub) {
          // The current user has been blocked by the target user
          return reply.code(403).send({ error: 'Vous ne pouvez pas voir ce profil.' })
        } else {
          // The current user blocked the target user
          friendshipStatus = 'blocked'
        }
      } else if (friendship.status === 'ACCEPTED') {
        friendshipStatus = 'friend'
      } else {
        friendshipStatus = friendship.initiatorId === sub ? 'pending_sent' : 'pending_received'
      }
    }

    const followRecord = await app.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: sub, followingId: userId } }
    })
    const isFollowing = !!followRecord

    // Common events: events both users have a confirmed booking on
    const commonEvents = await app.prisma.event.findMany({
      where: {
        bookings: {
          some: { userId: sub, status: 'CONFIRMED' }
        },
        AND: [
          { bookings: { some: { userId: userId, status: 'CONFIRMED' } } }
        ]
      },
      select: { id: true }
    })
    const commonEventsCount = commonEvents.length

    const detailedStats = await getDetailedStats(app, userId)

    const friendsCount = await app.prisma.friendship.count({
      where: { OR: [{ initiatorId: userId }, { receiverId: userId }], status: 'ACCEPTED' }
    })

    return reply.send({ ...profile, friendshipStatus, isFollowing, commonEventsCount, detailedStats, friendsCount })
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

  // Submit KYC documents (multipart)
  app.post('/me/kyc', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const saved: Record<string, string> = {}
    const fields: Record<string, string> = {}

    try {
      const existingProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
      if (!existingProfile) return reply.code(404).send({ error: 'Profile not found' })

      for await (const part of req.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string
          continue
        }
        if (part.type !== 'file') continue
        const ext = path.extname(part.filename) || '.jpg'
        const filename = `${part.fieldname}-${uuidv4()}${ext}`
        const folder = `kyc/${sub}`
        
        const buffer = await part.toBuffer()
        const url = await uploadBufferToCloudinary(buffer, folder, filename)
        saved[part.fieldname] = url
      }

      if (Object.keys(saved).length === 0) {
        return reply.code(400).send({ error: 'Aucun document fourni' })
      }

      // -- Validation automatique (nom et date de naissance) --
      let isRejected = false
      let rejectReason = ''

      const kycFirstName = fields.firstName?.trim().toLowerCase() || ''
      const kycLastName = fields.lastName?.trim().toLowerCase() || ''
      const profileName = existingProfile.displayName.trim().toLowerCase()
      
      const kycBirthDateStr = fields.birthDate
      const profileBirthDate = existingProfile.birthDate

      // Vérifier le prénom
      const nameMatches = kycFirstName.includes(profileName) || profileName.includes(kycFirstName) || kycLastName.includes(profileName) || profileName.includes(kycLastName)
      
      if (!nameMatches) {
        isRejected = true
        rejectReason = 'Le nom/prénom fourni ne correspond pas à votre profil.'
      } else if (profileBirthDate && kycBirthDateStr) {
        // Comparer l'année et le mois au moins, ou date exacte.
        // On compare sous format YYYY-MM-DD
        const kycDate = new Date(kycBirthDateStr).toISOString().split('T')[0]
        const profDate = new Date(profileBirthDate).toISOString().split('T')[0]
        if (kycDate !== profDate) {
          isRejected = true
          rejectReason = 'La date de naissance fournie ne correspond pas à celle de votre profil.'
        }
      }

      const finalStatus = isRejected ? 'rejected' : 'pending'

      const profile = await app.prisma.profile.update({
        where: { userId: sub },
        data: {
          kycStatus: finalStatus,
          kycSubmittedAt: new Date(),
          kycReviewedAt: isRejected ? new Date() : null,
          kycRejectedReason: isRejected ? rejectReason : null,
          kycIdNumber: fields.idNumber ?? undefined,
          kycFirstName: fields.firstName ?? undefined,
          kycLastName: fields.lastName ?? undefined,
          kycBirthDate: fields.birthDate ? new Date(fields.birthDate) : undefined,
          kycCity: fields.city ?? undefined,
          kycIdFront: saved.idFront ?? undefined,
          kycIdBack: saved.idBack ?? undefined,
          kycSelfie: saved.selfie ?? undefined,
          kycSelfieWithId: saved.selfieWithId ?? undefined,
        },
      })

      return reply.send({ success: true, kycStatus: profile.kycStatus, documents: saved, reason: rejectReason })
    } catch (err) {
      console.error('KYC Upload error', err)
      return reply.code(500).send({ error: 'Upload failed' })
    }
  })

  // Get current KYC status for the authenticated user
  app.get('/me/kyc-status', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const profile = await app.prisma.profile.findUnique({
      where: { userId: sub },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectedReason: true,
      },
    })
    if (!profile) return reply.code(404).send({ error: 'Profile not found' })
    
    // Fix: Un nouveau compte a 'pending' par défaut dans le schéma, 
    // mais s'il n'a jamais rien soumis, le statut réel est 'non vérifié' (null).
    if (profile.kycStatus === 'pending' && !profile.kycSubmittedAt) {
      profile.kycStatus = null
    }

    return reply.send(profile)
  })

  // Update password
  app.patch('/me/password', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const schema = z.object({
      oldPassword: z.string().optional(),
      newPassword: z.string().min(6),
    })

    const result = schema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'Données invalides' })

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' })

    if (user.passwordHash) {
      if (!result.data.oldPassword) return reply.code(400).send({ error: 'Ancien mot de passe requis' })
      const valid = await bcrypt.compare(result.data.oldPassword, user.passwordHash)
      if (!valid) return reply.code(400).send({ error: 'Ancien mot de passe incorrect' })
    }

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

  // Update email
  app.patch('/me/email', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const schema = z.object({ email: z.string().email() })

    const result = schema.safeParse(req.body)
    if (!result.success) return reply.code(400).send({ error: 'E-mail invalide' })

    const existing = await app.prisma.user.findUnique({ where: { email: result.data.email } })
    if (existing && existing.id !== sub) {
      return reply.code(409).send({ error: 'Cet e-mail est déjà utilisé' })
    }

    const updated = await app.prisma.user.update({
      where: { id: sub },
      data: { email: result.data.email }
    })

    return reply.send({ success: true, email: updated.email })
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

  // Get friends list for a specific user
  app.get('/:userId/friends', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { search } = req.query as { search?: string }
    const friendships = await app.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { initiatorId: userId },
          { receiverId: userId },
        ]
      },
      include: {
        initiator: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
        receiver: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
      }
    })

    let friends = friendships.map(f => {
      const isInitiator = f.initiatorId === userId
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
    const { sub } = req.user as { sub: string }
    const { q, limit = '20', offset = '0' } = req.query as any
    const users = await app.prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
        isPublic: true,
      },
      take: Number(limit) * 2, // Take more to account for filtered out users
      skip: Number(offset),
    })

    // Filter out users who have blocked the current user or whom the current user has blocked
    const userIds = users.map(u => u.userId)
    const blocks = await app.prisma.friendship.findMany({
      where: {
        status: 'BLOCKED',
        OR: [
          { initiatorId: sub, receiverId: { in: userIds } },
          { initiatorId: { in: userIds }, receiverId: sub }
        ]
      }
    })

    const blockedIds = new Set(blocks.flatMap(b => [b.initiatorId, b.receiverId]))
    const filteredUsers = users.filter(u => !blockedIds.has(u.userId)).slice(0, Number(limit))

    return reply.send({ data: filteredUsers, total: filteredUsers.length })
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
      },
      // poolTarget & poolCollected needed for Party Maker badge
    })

    // Past events + bookings (with pool data for badge progress)
    const bookings = await app.prisma.booking.findMany({
      where: {
        userId,
        status: 'CONFIRMED',
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
      take: 50  // increased to get all bookings for badge computation
    })

    const pastEvents = bookings
      .filter(b => b.event.startAt < new Date() && !b.event.isPrivate)
      .map(b => ({
        ...b.event,
        isReviewed: b.event.reviews && b.event.reviews.length > 0
      }))

    // Raw bookings with totalPaid for badge computation (Top Donateur)
    const bookingsForBadge = bookings.map(b => ({
      eventId: b.eventId,
      totalPaid: b.totalPaid,
      event: {
        poolTarget: (b.event as any).poolTarget,
        poolMinAmount: (b.event as any).poolMinAmount,
      }
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

    const joinedEvents = bookings
      .filter(b => isOwner || !b.event.isPrivate)
      .map(b => ({
        ...b.event,
        isReviewed: b.event.reviews && b.event.reviews.length > 0
      }))

    return reply.send({
      createdEvents,
      pastEvents,
      joinedEvents,
      draftEvents,
      bookings: bookingsForBadge,
    })
  })

  // ─── FOLLOWERS ─────────────────────────────────────────────────────────────

  // Follow a user
  app.post('/:userId/follow', { preHandler: [app.authenticate] }, async (req, reply) => {
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
    
    try {
      const followerProfile = await app.prisma.profile.findUnique({ where: { userId: sub } });
      if (followerProfile) {
        await createAndSendNotification(app, {
          userId: userId,
          type: 'NEW_FOLLOWER',
          title: 'Nouvel abonné',
          body: `${followerProfile.displayName || followerProfile.username} a commencé à vous suivre.`,
          data: { followerId: sub }
        });
      }
    } catch (e) {
      app.log.warn(`Failed to send follow notification: ${e}`);
    }

    return reply.code(201).send({ success: true })
  })

  // Unfollow a user
  app.delete('/:userId/follow', { preHandler: [app.authenticate] }, async (req, reply) => {
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

  // Delete own account (soft delete + tracking)
  app.delete('/me', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const body = req.body as { reason?: string } | undefined

    // 1. Get the user and profile
    const user = await app.prisma.user.findUnique({
      where: { id: sub },
      include: { profile: true }
    })

    if (!user) return reply.code(404).send({ error: 'User not found' })
    if (user.deletedAt) return reply.code(400).send({ error: 'User already deleted' })

    // 2. Track deleted account (store the reason if provided)
    await app.prisma.deletedAccountTracker.create({
      data: {
        userId: sub,
        email: user.email,
        phone: user.phone,
        reason: body?.reason || 'Account deleted by user via settings',
      }
    })

    // 3. Delete from Firebase Auth so the user can never log in again
    try {
      const admin = require('firebase-admin')
      if (admin.apps.length) {
        if (user.email) {
          const fbUser = await admin.auth().getUserByEmail(user.email).catch(() => null)
          if (fbUser) await admin.auth().deleteUser(fbUser.uid)
        }
        if (user.phone) {
          const fbUser = await admin.auth().getUserByPhoneNumber(user.phone).catch(() => null)
          if (fbUser) await admin.auth().deleteUser(fbUser.uid)
        }
      }
    } catch (err) {
      console.error('[Firebase] Failed to delete user from Firebase Auth:', err)
      // Continue anyway — soft delete in DB is still applied
    }

    // 4. Soft delete in DB + anonymize profile
    //    Nullify email/phone so unique constraints don't block future accounts with same credentials
    await app.prisma.$transaction([
      app.prisma.user.update({
        where: { id: sub },
        data: {
          deletedAt: new Date(),
          isActive: false,
          email: null,
          phone: null,
        }
      }),
      app.prisma.profile.update({
        where: { userId: sub },
        data: {
          displayName: 'Utilisateur Supprimé',
          avatarUrl: null,
          coverUrl: null,
          bio: null,
          city: null,
          country: null,
        }
      }),
      // Revoke all refresh tokens and device tokens
      app.prisma.refreshToken.deleteMany({ where: { userId: sub } }),
      app.prisma.deviceToken.deleteMany({ where: { userId: sub } }),
    ])

    return reply.send({ success: true, message: 'Account deleted successfully' })
  })

  // Block a user
  app.post('/:userId/block', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { sub } = req.user as { sub: string }

    if (userId === sub) return reply.code(400).send({ error: 'Cannot block yourself' })

    const existingFriendship = await app.prisma.friendship.findFirst({
      where: {
        OR: [
          { initiatorId: sub, receiverId: userId },
          { initiatorId: userId, receiverId: sub }
        ]
      }
    })

    if (existingFriendship) {
      await app.prisma.friendship.update({
        where: { id: existingFriendship.id },
        data: { status: 'BLOCKED', initiatorId: sub, receiverId: userId }
      })
    } else {
      await app.prisma.friendship.create({
        data: { initiatorId: sub, receiverId: userId, status: 'BLOCKED' }
      })
    }

    return reply.send({ success: true })
  })

  // Unblock a user
  app.post('/:userId/unblock', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { sub } = req.user as { sub: string }

    const existingFriendship = await app.prisma.friendship.findFirst({
      where: {
        initiatorId: sub,
        receiverId: userId,
        status: 'BLOCKED'
      }
    })

    if (existingFriendship) {
      await app.prisma.friendship.delete({
        where: { id: existingFriendship.id }
      })
    }

    return reply.send({ success: true })
  })

  // Report a user
  app.post('/:userId/report', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { sub } = req.user as { sub: string }
    const bodySchema = z.object({
      reason: z.enum(['SPAM', 'INAPPROPRIATE', 'FAKE', 'HARASSMENT', 'SCAM', 'HATE_SPEECH', 'OTHER']),
      description: z.string().optional()
    })
    
    const parsed = bodySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message })

    await app.prisma.report.create({
      data: {
        reporterId: sub,
        reportedId: userId,
        reason: parsed.data.reason,
        description: parsed.data.description
      }
    })

    return reply.send({ success: true })
  })

  // ── Badges ────────────────────────────────────────────────────────

  // Get user's earned badges and all available badges
  app.get('/me/badges', async (req, reply) => {
    const { sub } = req.user as { sub: string }

    const [allBadges, userBadges] = await Promise.all([
      app.prisma.badge.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }),
      app.prisma.userBadge.findMany({ where: { userId: sub } })
    ])

    const earnedBadgeIds = new Set(userBadges.map(ub => ub.badgeId))
    
    const enrichedBadges = allBadges.map(b => ({
      ...b,
      isEarned: earnedBadgeIds.has(b.id),
      earnedAt: userBadges.find(ub => ub.badgeId === b.id)?.earnedAt || null
    }))

    return reply.send({ data: enrichedBadges })
  })

  // Trigger evaluation of badges
  app.post('/me/badges/evaluate', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const result = await evaluateUserBadges(app.prisma, sub)
    return reply.send({ data: result || { newBadgeIds: [] } })
  })
}
