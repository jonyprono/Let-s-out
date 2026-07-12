import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { createAndSendNotification, createAndSendNotificationMany } from '../notifications/notifications.routes'
import { uploadBufferToCloudinary } from '../../services/cloudinary.service'
import { EmailService } from '../../services/email.service'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const CreateEventSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(3).max(5000),
  category: z.enum(['SPORT','CULTURE','FOOD','NIGHTLIFE','TRAVEL','GAMING','WELLNESS','ART','MUSIC','OTHER','SOCIAL','TECH','SCIENCE','LIFESTYLE','TOURISM']).nullable().optional().transform(v => v || 'OTHER'),
  maxAttendees: z.number().int().positive().optional(),
  price: z.number().min(0).default(0),
  currency: z.string().length(3).default('XOF'),
  isPrivate: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  coverUrl: z.string().optional(),
  coHostIds: z.array(z.string()).optional(),
  poolTarget: z.number().optional(),
  poolDescription: z.string().optional(),
  registrationDeadline: z.string().datetime().optional(),
  poolMode: z.enum(['libre', 'minimum', 'fixe']).optional(),
  poolMinAmount: z.number().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
})

export default async function eventsRoutes(app: FastifyInstance) {

  // ── Public routes ────────────────────────────────────────────────────────
  // Get recommended events based on user interests
  app.get('/recommended', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    
    const userProfile = await app.prisma.profile.findUnique({
      where: { userId: sub },
      select: { interests: true },
    })

    const interests = userProfile?.interests || []

    const events = await app.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        isPrivate: false,
        startAt: { gte: new Date() }, // Only upcoming events
        ...(interests.length > 0 && { category: { in: interests as import('@prisma/client').EventCategory[] } }),
      },
      include: {
        creator: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
        bookings: {
          where: { status: 'CONFIRMED' },
          take: 3,
          select: { user: { select: { profile: { select: { avatarUrl: true } } } } },
        },
        _count: { select: { bookings: true } },
        payoutRequest: true,
      },
      orderBy: { startAt: 'asc' },
      take: 10,
    })

    return reply.send({ data: events, total: events.length })
  })

  // Get pending evaluations (past events attended by user, not yet reviewed)
  app.get('/pending-evaluations', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    // Find confirmed bookings for past events
    const bookings = await app.prisma.booking.findMany({
      where: {
        userId: sub,
        status: 'CONFIRMED',
        event: {
          endAt: { lt: new Date() },
        },
      },
      include: {
        event: {
          include: {
            creator: {
              select: {
                id: true,
                profile: { select: { displayName: true, avatarUrl: true, username: true } }
              }
            }
          }
        }
      },
      orderBy: { event: { endAt: 'desc' } }
    })

    // Filter out events the user has already reviewed
    const pendingEvents = [];
    for (const b of bookings) {
      const existingReview = await app.prisma.review.findUnique({
        where: {
          userId_eventId: {
            userId: sub,
            eventId: b.eventId,
          }
        }
      });
      if (!existingReview) {
        pendingEvents.push(b.event);
      }
    }

    return reply.send({ data: pendingEvents, total: pendingEvents.length })
  })

  // List events (with filters)
  app.get('/', async (req, reply) => {
    const { category, city, status = 'PUBLISHED', limit = '20', offset = '0', search, upcoming, maxPrice, date, time, ongoing } = req.query as any

    let startDateBoundary: Date | undefined;
    let endDateBoundary: Date | undefined;

    const now = new Date();

    if (date) {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);

      if (date === 'today') {
        startDateBoundary = todayStart;
        endDateBoundary = todayEnd;
      } else if (date === 'tomorrow') {
        startDateBoundary = new Date(todayStart); startDateBoundary.setDate(startDateBoundary.getDate() + 1);
        endDateBoundary = new Date(todayStart); endDateBoundary.setDate(endDateBoundary.getDate() + 2);
      } else if (date === 'week') {
        startDateBoundary = todayStart;
        endDateBoundary = new Date(todayStart);
        const day = endDateBoundary.getDay();
        const diff = endDateBoundary.getDate() - day + (day === 0 ? 0 : 7);
        endDateBoundary.setDate(diff + 1);
      } else if (date === 'weekend') {
        startDateBoundary = new Date(todayStart);
        const day = startDateBoundary.getDay();
        const diffToSat = startDateBoundary.getDate() - day + (day === 0 ? -1 : 6);
        startDateBoundary.setDate(diffToSat);
        endDateBoundary = new Date(startDateBoundary);
        endDateBoundary.setDate(endDateBoundary.getDate() + 2);
      } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = date.split('-');
        startDateBoundary = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        endDateBoundary = new Date(startDateBoundary);
        endDateBoundary.setDate(endDateBoundary.getDate() + 1);
      }
    }

    if (time) {
      const baseDate = startDateBoundary || new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let hourStart = 0;
      let hourEnd = 24;
      if (time === 'morning') { hourStart = 6; hourEnd = 12; }
      else if (time === 'afternoon') { hourStart = 12; hourEnd = 18; }
      else if (time === 'evening') { hourStart = 18; hourEnd = 24; }
      else if (time === 'night') { hourStart = 0; hourEnd = 6; }

      if (date === 'today' || date === 'tomorrow' || !date) {
         startDateBoundary = new Date(baseDate);
         startDateBoundary.setHours(hourStart);
         endDateBoundary = new Date(baseDate);
         endDateBoundary.setHours(hourEnd);
      }
    }

    if (!startDateBoundary && upcoming === 'true') {
      startDateBoundary = new Date();
    }

    const whereClause: any = {
      status,
      isPrivate: false,
      ...(category && { category: category.includes(',') ? { in: category.split(',') } : category }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(maxPrice && { price: { lte: Number(maxPrice) } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    if (ongoing === 'true') {
      whereClause.startAt = { lte: now };
      whereClause.endAt = { gte: now };
    } else if (startDateBoundary || endDateBoundary) {
      whereClause.startAt = {};
      if (startDateBoundary) whereClause.startAt.gte = startDateBoundary;
      if (endDateBoundary) whereClause.startAt.lt = endDateBoundary;
    }

    const events = await app.prisma.event.findMany({
      where: whereClause,
      include: {
        creator: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
        bookings: { 
          where: { status: 'CONFIRMED' }, 
          take: 3, 
          select: { user: { select: { profile: { select: { avatarUrl: true } } } } } 
        },
        _count: { select: { bookings: true } },
      },
      orderBy: { startAt: 'asc' },
      take: Number(limit),
      skip: Number(offset),
    })

    const total = await app.prisma.event.count({
      where: whereClause,
    })

    return reply.send({ data: events, total })
  })

  // Helper to get rating
  const getUserRating = async (userId: string) => {
    const events = await app.prisma.event.findMany({
      where: { creatorId: userId },
      include: { reviews: true }
    })
    let reviewCount = 0
    let totalRating = 0
    for (const e of events) {
      for (const r of e.reviews) {
        reviewCount++
        totalRating += r.rating
      }
    }
    return reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : 0
  }

  // Get single event
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const event = await app.prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true, followersCount: true, eventsCount: true } } } },
        _count: { select: { bookings: true } },
      },
    })
    if (!event) return reply.code(404).send({ error: 'Event not found' })

    const creatorRating = await getUserRating(event.creatorId)
    const eventWithRating = {
      ...event,
      creator: {
        ...event.creator,
        profile: {
          ...event.creator.profile,
          rating: creatorRating
        }
      }
    }

    // Fetch co-hosts if any
    let eventWithCoHosts = { ...eventWithRating, coHosts: [] as any[] }
    if (event.coHostIds && event.coHostIds.length > 0) {
      const coHosts = await app.prisma.user.findMany({
        where: { id: { in: event.coHostIds } },
        select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true, followersCount: true, eventsCount: true } } }
      })
      const coHostsWithRating = await Promise.all(coHosts.map(async (coHost) => {
        const rating = await getUserRating(coHost.id)
        return {
          ...coHost,
          profile: {
            ...coHost.profile,
            rating
          }
        }
      }))
      eventWithCoHosts.coHosts = coHostsWithRating
    }

    // Increment view count (fire-and-forget, don't fail if this fails)
    app.prisma.event.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {})

    return reply.send(eventWithCoHosts)
  })

  // ── Protected routes ─────────────────────────────────────────────────────

  // Get current user's booking for an event
  app.get('/:id/my-booking', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const booking = await app.prisma.booking.findUnique({
      where: { userId_eventId: { userId: sub, eventId: id } },
    })

    if (!booking) return reply.code(404).send({ error: 'No booking found' })
    return reply.send(booking)
  })

  // Upload event cover
  app.post('/upload-cover', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    let coverUrl: string | null = null

    try {
      for await (const part of req.parts()) {
        if (part.type !== 'file') continue
        const ext = path.extname(part.filename) || '.jpg'
        const filename = `cover-${uuidv4()}${ext}`
        const folder = `events/covers/${sub}`
        
        const buffer = await part.toBuffer()
        coverUrl = await uploadBufferToCloudinary(buffer, folder, filename)
        break // Only process first file
      }

      if (!coverUrl) {
        return reply.code(400).send({ error: 'Aucun fichier fourni' })
      }

      return reply.send({ success: true, url: coverUrl })
    } catch (err) {
      console.error('Event cover upload error', err)
      return reply.code(500).send({ error: 'Upload failed' })
    }
  })

  // Create event
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    let body: any
    try {
      body = CreateEventSchema.parse(req.body)
    } catch (e: any) {
      // Return validation errors as 400 instead of crashing
      const issues = e.issues ?? []
      const messages = issues.map((i: any) => {
        const field = i.path?.[0] ?? 'champ'
        if (i.code === 'too_small') return `"${field}" doit contenir au moins ${i.minimum} caractères`
        if (i.code === 'too_big')   return `"${field}" ne peut pas dépasser ${i.maximum} caractères`
        return i.message
      })
      return reply.code(400).send({
        error: 'Validation échouée',
        details: messages,
        message: messages.join(', '),
      })
    }

    const event = await app.prisma.event.create({
      data: {
        ...body,
        creatorId: sub,
        status: body.status, // use status from body
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        // Generate a unique joinCode for private events
        ...(body.isPrivate && { joinCode: randomBytes(5).toString('hex').toUpperCase() }),
      },
    })

    // Post-creation side effects — wrapped in try/catch so they don't fail the main response
    try {
      await app.prisma.conversation.create({
        data: {
          name: event.title,
          isGroup: true,
          eventId: event.id,
          members: { create: { userId: sub, isAdmin: true } },
        },
      })
    } catch (e) {
      app.log.warn(`Failed to create event conversation: ${e}`)
    }

    try {
      await app.prisma.profile.update({
        where: { userId: sub },
        data: { eventsCount: { increment: 1 } },
      })
    } catch (e) {
      app.log.warn(`Failed to increment eventsCount: ${e}`)
    }

    // Send notifications to co-hosts if any are provided
    if (body.coHostIds && body.coHostIds.length > 0) {
      try {
        await createAndSendNotificationMany(
          app,
          body.coHostIds.map((uid: string) => ({
            userId: uid,
            type: 'SYSTEM',
            title: '🤝 Nouveau co-organisateur',
            body: `Vous avez été nommé co-organisateur de "${event.title}".`,
            data: { eventId: event.id },
          }))
        )
      } catch (e) {
        app.log.warn(`Failed to notify co-hosts: ${e}`)
      }
    }

    return reply.code(201).send(event)
  })

  // Publish event (Draft -> Published)
  app.put('/:id/publish', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const needsVerification = (event.price && event.price > 0) || (event.poolTarget && event.poolTarget > 0)
    if (needsVerification) {
      const userProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
      if (userProfile?.kycStatus !== 'verified') {
        return reply.code(403).send({ error: "Le profil doit être vérifié (KYC) pour publier cet événement." })
      }
    }

    const updated = await app.prisma.event.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    })

    return reply.send(updated)
  })


  // Update event
  app.patch('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const body = req.body as any;

    const newPrice = body.price !== undefined ? body.price : event.price;
    const newPoolTarget = body.poolTarget !== undefined ? body.poolTarget : event.poolTarget;
    const needsVerification = (newPrice && newPrice > 0) || (newPoolTarget && newPoolTarget > 0);

    if (needsVerification) {
      const userProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
      if (userProfile?.kycStatus !== 'verified') {
        return reply.code(403).send({ error: "Le profil doit être vérifié (KYC) pour activer cette option financière." })
      }
    }

    const updated = await app.prisma.event.update({
      where: { id },
      data: body,
    })

    // Notify new co-hosts if any
    if (body.coHostIds && Array.isArray(body.coHostIds)) {
      const oldCoHosts = event.coHostIds || [];
      const newCoHosts = body.coHostIds.filter((cid: string) => !oldCoHosts.includes(cid));
      
      if (newCoHosts.length > 0) {
        try {
          await createAndSendNotificationMany(app, newCoHosts.map((userId: string) => ({
            userId,
            type: 'CO_HOST_INVITE',
            title: 'Co-organisateur',
            body: `Vous avez été ajouté en tant que co-organisateur pour l'événement "${event.title}".`,
            data: { eventId: id }
          })))
        } catch (e) {
          app.log.warn(`Failed to send co-host notifications: ${e}`)
        }
      }
    }

    // Notify all confirmed participants about the update
    try {
      const bookings = await app.prisma.booking.findMany({
        where: { eventId: id, status: 'CONFIRMED' }
      })
      if (bookings.length > 0) {
        await createAndSendNotificationMany(app, bookings.map(b => ({
          userId: b.userId,
          type: 'EVENT_UPDATE',
          title: 'Événement mis à jour',
          body: `L'événement "${event.title}" a été modifié.`,
          data: { eventId: id }
        })))
      }
    } catch (e) { app.log.warn(`Failed to send update notifications: ${e}`) }

    return reply.send(updated)
  })

  // Delete / Cancel event
  app.delete('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    await app.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } })

    // Notify all confirmed/pending participants about the cancellation
    try {
      const bookings = await app.prisma.booking.findMany({
        where: { eventId: id, status: { in: ['CONFIRMED', 'PENDING'] } }
      })
      if (bookings.length > 0) {
        await createAndSendNotificationMany(app, bookings.map(b => ({
          userId: b.userId,
          type: 'EVENT_CANCELLED',
          title: 'Événement annulé',
          body: `L'événement "${event.title}" a été annulé par l'organisateur.`,
          data: { eventId: id }
        })))
      }
    } catch (e) { app.log.warn(`Failed to send cancellation notifications: ${e}`) }

    return reply.send({ message: 'Event cancelled' })
  })

  // Join event (booking) — free events only
  app.post('/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.status !== 'PUBLISHED') return reply.code(400).send({ error: 'Event not available' })

    // Paid events must go through the payment flow
    if (event.price > 0) {
      return reply.code(402).send({ error: 'PAYMENT_REQUIRED', message: 'Ce événement est payant. Veuillez procéder au paiement.' })
    }

    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return reply.code(400).send({ error: 'Event is full' })
    }

    const existing = await app.prisma.booking.findUnique({
      where: { userId_eventId: { userId: sub, eventId: id } },
    })
    if (existing) return reply.code(409).send({ error: 'Already joined' })

    const [booking] = await app.prisma.$transaction([
      app.prisma.booking.create({
        data: {
          userId: sub,
          eventId: id,
          status: event.requiresApproval ? 'PENDING' : 'CONFIRMED',
        },
      }),
      app.prisma.event.update({
        where: { id },
        data: { currentAttendees: { increment: 1 } },
      }),
    ])

    // Add to event conversation
    try {
      const conversation = await app.prisma.conversation.findUnique({ where: { eventId: id } })
      if (conversation && !event.requiresApproval) {
        await app.prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conversation.id, userId: sub } },
          create: { conversationId: conversation.id, userId: sub },
          update: {},
        })
      }
    } catch (e) { app.log.warn(`Failed to add to conversation: ${e}`) }

    // Notifications
    try {
      const userProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
      const userName = userProfile?.displayName || 'Quelqu\'un'

      if (event.requiresApproval) {
        await createAndSendNotification(app, {
          userId: event.creatorId,
          type: 'JOIN_REQUEST',
          title: 'Demande de participation',
          body: `${userName} souhaite participer à "${event.title}".`,
          data: { eventId: id, bookingId: booking.id, requesterId: sub }
        })
      } else {
        await createAndSendNotification(app, {
          userId: event.creatorId,
          type: 'JOIN_CONFIRMED',
          title: '🎉 Nouveau participant !',
          body: `${userName} a rejoint votre événement "${event.title}".`,
          data: { eventId: id, bookingId: booking.id, joinerId: sub }
        })
      }
    } catch (e) { app.log.warn(`Failed to send join notification: ${e}`) }

    if (!event.requiresApproval) {
      try {
        const user = await app.prisma.user.findUnique({ where: { id: sub } })
        const payer = await app.prisma.profile.findUnique({ where: { userId: sub } })
        
        if (user?.email && event) {
          app.log.info(`[DEBUG EMAIL] Sending free ticket email to ${user.email} for booking ${booking.id}`);
          const emailService = new EmailService()
          await emailService.sendTicketEmail({
            to: user.email,
            userName: payer?.displayName || 'Cher utilisateur',
            eventName: event.title,
            eventDate: event.startAt,
            location: event.address || event.city || 'Lieu non spécifié',
            bookingId: booking.id,
            price: 0,
            quantity: 1,
            coverImage: event.coverUrl || undefined,
          })
          app.log.info(`[DEBUG EMAIL] Successfully triggered emailService.sendTicketEmail for ${user.email}`);
        } else {
          app.log.warn(`[DEBUG EMAIL] Did not send free ticket email because user.email is missing or event is null`);
        }
      } catch (err) {
        app.log.error(`Failed to send email ticket for free booking ${booking.id}: ${err}`)
      }
    }

    return reply.code(201).send(booking)
  })

  // Leave event
  app.delete('/:id/join', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const booking = await app.prisma.booking.findUnique({
      where: { userId_eventId: { userId: sub, eventId: id } },
    })
    if (!booking) return reply.code(404).send({ error: 'Not joined' })

    await app.prisma.$transaction([
      app.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      }),
      app.prisma.event.update({
        where: { id },
        data: { currentAttendees: { decrement: 1 } },
      }),
    ])

    return reply.send({ message: 'Left event' })
  })

  // Get event attendees
  app.get('/:id/attendees', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { limit = '20', offset = '0' } = req.query as any

    const bookings = await app.prisma.booking.findMany({
      where: { eventId: id, status: 'CONFIRMED' },
      include: { user: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } } },
      take: Number(limit),
      skip: Number(offset),
    })

    return reply.send({ data: bookings })
  })

  // Join private event via code (QR scan)
  app.post('/join-by-code/:code', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { code } = req.params as { code: string }

    const event = await app.prisma.event.findUnique({ where: { joinCode: code.toUpperCase() } })
    if (!event) return reply.code(404).send({ error: 'Code invalide ou événement introuvable' })
    if (event.status !== 'PUBLISHED') return reply.code(400).send({ error: 'Événement non disponible' })

    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return reply.code(400).send({ error: 'Événement complet' })
    }

    const existing = await app.prisma.booking.findUnique({
      where: { userId_eventId: { userId: sub, eventId: event.id } },
    })
    if (existing) return reply.send({ event, alreadyJoined: true })

    if (event.price > 0) {
      // Return event info for the user to proceed to payment
      return reply.send({ event, requiresPayment: true })
    }

    const [booking] = await app.prisma.$transaction([
      app.prisma.booking.create({ data: { userId: sub, eventId: event.id, status: 'CONFIRMED' } }),
      app.prisma.event.update({ where: { id: event.id }, data: { currentAttendees: { increment: 1 } } }),
    ])

    // Add to event conversation
    try {
      const conv = await app.prisma.conversation.findUnique({ where: { eventId: event.id } })
      if (conv) {
        await app.prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conv.id, userId: sub } },
          create: { conversationId: conv.id, userId: sub },
          update: {},
        })
      }
    } catch (e) { app.log.warn(`Failed to add to conversation: ${e}`) }

    // Notify creator
    try {
      const userProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
      const userName = userProfile?.displayName || 'Quelqu\'un'
      await createAndSendNotification(app, {
        userId: event.creatorId,
        type: 'JOIN_CONFIRMED',
        title: '🔐 Nouveau participant (privé)',
        body: `${userName} a rejoint "${event.title}" via le code privé.`,
        data: { eventId: event.id, bookingId: booking.id, joinerId: sub }
      })
    } catch (e) { app.log.warn(`Failed to send notification: ${e}`) }

    return reply.code(201).send({ event, booking, joined: true })
  })

  // ── Approve / reject a booking (requiresApproval events) ───────────────────
  app.patch('/:id/bookings/:bookingId/approve', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, bookingId } = req.params as { id: string; bookingId: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const booking = await app.prisma.booking.findFirst({ where: { id: bookingId, eventId: id } })
    if (!booking) return reply.code(404).send({ error: 'Booking not found' })
    if (booking.status !== 'PENDING') return reply.code(400).send({ error: 'Booking is not pending' })

    const updated = await app.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    })

    // Add to event conversation
    try {
      const conv = await app.prisma.conversation.findUnique({ where: { eventId: id } })
      if (conv) {
        await app.prisma.conversationMember.upsert({
          where: { conversationId_userId: { conversationId: conv.id, userId: booking.userId } },
          create: { conversationId: conv.id, userId: booking.userId },
          update: {},
        })
      }
    } catch {}

    // Notify participant
    await createAndSendNotification(app, {
      userId: booking.userId,
      type: 'JOIN_ACCEPTED',
      title: '✅ Participation acceptée !',
      body: `Votre demande pour "${event.title}" a été acceptée.`,
      data: { eventId: id, bookingId },
    })

    return reply.send(updated)
  })

  app.patch('/:id/bookings/:bookingId/reject', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id, bookingId } = req.params as { id: string; bookingId: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.creatorId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    const booking = await app.prisma.booking.findFirst({ where: { id: bookingId, eventId: id } })
    if (!booking) return reply.code(404).send({ error: 'Booking not found' })

    const [updated] = await app.prisma.$transaction([
      app.prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } }),
      app.prisma.event.update({ where: { id }, data: { currentAttendees: { decrement: 1 } } }),
    ])

    await createAndSendNotification(app, {
      userId: booking.userId,
      type: 'JOIN_ACCEPTED', // re-use closest type; frontend shows the body
      title: '❌ Participation refusée',
      body: `Votre demande pour "${event.title}" a été refusée par l'organisateur.`,
      data: { eventId: id, bookingId },
    })

    return reply.send(updated)
  })

  // Get pending booking requests for an event (organizer only)
  app.get('/:id/bookings/pending', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })
    if (event.creatorId !== sub && !event.coHostIds.includes(sub)) return reply.code(403).send({ error: 'Forbidden' })

    const bookings = await app.prisma.booking.findMany({
      where: { eventId: id, status: 'PENDING' },
      include: {
        user: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true, bio: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ data: bookings })
  })

  // ── Invite friends to an event ──────────────────────────────────────────────
  app.post('/:id/invite', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { userIds } = req.body as { userIds: string[] }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return reply.code(400).send({ error: 'userIds must be a non-empty array' })
    }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })

    const senderProfile = await app.prisma.profile.findUnique({ where: { userId: sub } })
    const senderName = senderProfile?.displayName || 'Quelqu\'un'

    // Send invitations to each user (skip if already joined)
    const validUserIds = userIds.filter((uid) => uid !== sub)
    await createAndSendNotificationMany(
      app,
      validUserIds.map((uid) => ({
        userId: uid,
        type: 'EVENT_INVITE',
        title: `${senderName} vous invite 🎉`,
        body: `Vous êtes invité à "${event.title}".`,
        data: { eventId: id, inviterId: sub },
      }))
    )

    return reply.send({ success: true, invited: validUserIds.length })
  })

  // ── Reviews ─────────────────────────────────────────────────────────────────
  app.post('/:id/reviews', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { rating, punctualityRating, attitudeRating, reliabilityRating, comment } = req.body as { rating: number; punctualityRating?: number; attitudeRating?: number; reliabilityRating?: number; comment?: string }

    if (rating < 1 || rating > 5) {
      return reply.code(400).send({ error: 'Rating must be between 1 and 5' })
    }

    const event = await app.prisma.event.findUnique({ where: { id } })
    if (!event) return reply.code(404).send({ error: 'Event not found' })

    const hasJoined = await app.prisma.booking.findFirst({
      where: { eventId: id, userId: sub, status: { not: 'CANCELLED' } },
    })
    if (!hasJoined) return reply.code(403).send({ error: 'You must join the event to review it' })

    const existingReview = await app.prisma.review.findUnique({
      where: { userId_eventId: { userId: sub, eventId: id } },
    })
    if (existingReview) return reply.code(400).send({ error: 'You have already reviewed this event' })

    const review = await app.prisma.review.create({
      data: { userId: sub, eventId: id, rating, punctualityRating, attitudeRating, reliabilityRating, comment },
    })

    // Compute Badges for Organizer
    const creatorId = event.creatorId;
    if (creatorId) {
      const allReviewsForCreator = await app.prisma.review.findMany({
        where: { event: { creatorId: creatorId } },
      });

      if (allReviewsForCreator.length >= 3) {
        const punctReviews = allReviewsForCreator.filter(r => r.punctualityRating !== null && r.punctualityRating !== undefined);
        const avgPunctuality = punctReviews.length > 0 ? punctReviews.reduce((acc, r) => acc + (r.punctualityRating || 0), 0) / punctReviews.length : 0;
        
        const attReviews = allReviewsForCreator.filter(r => r.attitudeRating !== null && r.attitudeRating !== undefined);
        const avgAttitude = attReviews.length > 0 ? attReviews.reduce((acc, r) => acc + (r.attitudeRating || 0), 0) / attReviews.length : 0;
        
        const relReviews = allReviewsForCreator.filter(r => r.reliabilityRating !== null && r.reliabilityRating !== undefined);
        const avgReliability = relReviews.length > 0 ? relReviews.reduce((acc, r) => acc + (r.reliabilityRating || 0), 0) / relReviews.length : 0;

        const assignBadge = async (badgeName: string) => {
          const existingBadge = await app.prisma.userBadge.findFirst({ where: { userId: creatorId, badge: badgeName } });
          if (!existingBadge) {
            await app.prisma.userBadge.create({ data: { userId: creatorId, badge: badgeName } });
            // Notify the creator
            await createAndSendNotification(app, {
              userId: creatorId,
              type: 'NEW_BADGE',
              title: 'Nouveau Badge Débloqué ! 🏅',
              body: `Félicitations, vous avez obtenu le badge "${badgeName}" grâce à vos excellentes évaluations !`,
              data: { badgeName }
            });
          }
        };

        if (avgPunctuality >= 4.5) await assignBadge('Ponctuel');
        if (avgAttitude >= 4.5) await assignBadge('Accueillant');
        if (avgReliability >= 4.5) await assignBadge('Fiable');
        
        if (allReviewsForCreator.length >= 5) {
          const avgOverall = allReviewsForCreator.reduce((acc, r) => acc + r.rating, 0) / allReviewsForCreator.length;
          if (avgOverall >= 4.5) await assignBadge('Top Org.');
        }
      }

      // Notify organizer of a new review
      await createAndSendNotification(app, {
        userId: creatorId,
        type: 'NEW_REVIEW',
        title: 'Nouvel avis reçu 📝',
        body: `Un participant a évalué votre événement "${event.title}".`,
        data: { eventId: id }
      });
    }

    return reply.status(201).send({ data: review })
  })

  app.get('/:id/reviews', async (req, reply) => {
    const { id } = req.params as { id: string }

    const reviews = await app.prisma.review.findMany({
      where: { eventId: id },
      include: {
        user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const averageRating = reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0

    return reply.send({ data: reviews, meta: { total: reviews.length, averageRating } })
  })
}
