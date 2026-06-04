import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'

// In-memory map: userId -> Set of WebSocket connections
const connections = new Map<string, Set<WebSocket>>()

export function broadcastToUser(userId: string, data: unknown) {
  const sockets = connections.get(userId)
  if (!sockets) return
  const payload = JSON.stringify(data)
  sockets.forEach((ws) => {
    if (ws.readyState === ws.OPEN) ws.send(payload)
  })
}

export function broadcastToConversation(
  app: FastifyInstance,
  conversationId: string,
  data: unknown,
  excludeUserId?: string,
) {
  app.prisma.conversationMember
    .findMany({ where: { conversationId }, select: { userId: true } })
    .then((members) => {
      members
        .filter((m) => m.userId !== excludeUserId)
        .forEach((m) => broadcastToUser(m.userId, data))
    })
}

export default async function chatRoutes(app: FastifyInstance) {

  // ── WebSocket endpoint ───────────────────────────────────────────────────
  app.get('/ws', { websocket: true }, async (socket, req) => {
    // Auth: expect ?token=<jwt> in query
    const { token } = req.query as { token?: string }
    if (!token) {
      socket.close(1008, 'Missing token')
      return
    }

    let userId: string
    try {
      const payload = app.jwt.verify<{ sub: string }>(token)
      userId = payload.sub
    } catch {
      socket.close(1008, 'Invalid token')
      return
    }

    // Register connection
    if (!connections.has(userId)) connections.set(userId, new Set())
    connections.get(userId)!.add(socket)
    app.log.info(`WS connected: ${userId} (${connections.get(userId)!.size} sockets)`)

    // Update last seen
    await app.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } })

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: 'message' | 'typing' | 'read'
          conversationId: string
          content?: string
          messageType?: string
          messageId?: string
        }

        if (msg.type === 'message' && msg.content) {
          // Verify member
          const member = await app.prisma.conversationMember.findUnique({
            where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
          })
          if (!member) return

          const message = await app.prisma.message.create({
            data: {
              conversationId: msg.conversationId,
              senderId: userId,
              type: (msg.messageType as any) || 'TEXT',
              content: msg.content,
            },
            include: {
              sender: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
            },
          })

          await app.prisma.conversation.update({
            where: { id: msg.conversationId },
            data: { lastMessageAt: new Date() },
          })

          // Broadcast to all conversation members
          broadcastToConversation(app, msg.conversationId, {
            type: 'new_message',
            message,
          }, undefined)
        }

        if (msg.type === 'typing') {
          // Get sender display name for the typing indicator
          const profile = await app.prisma.profile.findUnique({
            where: { userId },
            select: { displayName: true },
          })
          broadcastToConversation(app, msg.conversationId, {
            type: 'typing',
            userId,
            conversationId: msg.conversationId,
            displayName: profile?.displayName ?? 'Quelqu\'un',
          }, userId)
        }

        if (msg.type === 'read' && msg.messageId) {
          await app.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
            data: { lastReadAt: new Date() },
          })
          broadcastToConversation(app, msg.conversationId, {
            type: 'read',
            userId,
            conversationId: msg.conversationId,
            messageId: msg.messageId,
          }, userId)
        }

        // WebRTC Signaling
        if (['call_start', 'call_offer', 'call_answer', 'ice_candidate', 'call_reject', 'call_end'].includes(msg.type)) {
          // Simply relay the signaling message to other members in the conversation
          broadcastToConversation(app, msg.conversationId, {
            ...msg,
            userId, // append the sender's userId so the receiver knows who it's from
          }, userId)
        }
      } catch (e) {
        app.log.error(e)
      }
    })

    socket.on('close', () => {
      connections.get(userId)?.delete(socket)
      if (connections.get(userId)?.size === 0) connections.delete(userId)
      app.log.info(`WS disconnected: ${userId}`)
    })
  })

  // ── Public REST endpoints ──────────────────────────────────────────────────
  // List public groups for discovery
  app.get('/conversations/groups/discover', async (req, reply) => {
    const { limit = '10', offset = '0', search } = req.query as any

    const groups = await app.prisma.conversation.findMany({
      where: {
        isGroup: true,
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    })

    return reply.send({ data: groups })
  })

  // ── Protected REST endpoints ───────────────────────────────────────────────
  app.register(async function (app) {
    app.addHook('preHandler', app.authenticate)

  // POST /conversations/:conversationId/messages — persister un message
  app.post(
    '/conversations/:conversationId/messages',
    async (req, reply) => {
      const { sub } = req.user as { sub: string }
      const { conversationId } = req.params as { conversationId: string }
      const { content, type = 'TEXT' } = req.body as { content: string; type?: string }

      if (!content?.trim()) return reply.code(400).send({ error: 'Content required' })

      const member = await app.prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId: sub } },
      })
      if (!member) return reply.code(403).send({ error: 'Not a member' })

      const message = await app.prisma.message.create({
        data: { conversationId, senderId: sub, content, type: type as any },
        include: {
          sender: {
            select: {
              id: true,
              profile: { select: { username: true, displayName: true, avatarUrl: true } },
            },
          },
        },
      })

      await app.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      })

      // Notifier les autres membres en temps réel
      broadcastToConversation(app, conversationId, { type: 'new_message', message }, sub)

      // Get conversation and members for DB notification
      const conversation = await app.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { members: true }
      })
      const groupName = conversation?.name || (conversation?.isGroup ? 'Groupe' : message.sender.profile?.displayName)

      // Notify other members who are offline/not the sender
      const offlineMembers = conversation?.members.filter(m => m.userId !== sub) || []
      
      if (offlineMembers.length > 0) {
        await app.prisma.notification.createMany({
          data: offlineMembers.map(m => ({
            userId: m.userId,
            type: 'NEW_MESSAGE',
            title: `Nouveau message dans ${groupName}`,
            body: `${message.sender.profile?.displayName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            data: { conversationId, messageId: message.id }
          }))
        })
      }

      return reply.code(201).send(message)
    }
  )

  // Mark conversation as read
  app.post('/conversations/:id/read', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    
    await app.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: sub,
        }
      },
      data: { lastReadAt: new Date() }
    })
    
    return reply.send({ success: true })
  })


  // List conversations
  app.get('/conversations', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { limit = '20', offset = '0' } = req.query as any

    const convos = await app.prisma.conversationMember.findMany({
      where: { userId: sub },
      include: {
        conversation: {
          include: {
            members: {
              include: { user: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { profile: { select: { displayName: true } } } } },
            },
            event: { select: { coverUrl: true } },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      take: Number(limit),
      skip: Number(offset),
    })

    const convosWithUnread = await Promise.all(
      convos.map(async (c) => {
        const unreadCount = c.lastReadAt 
          ? await app.prisma.message.count({
              where: {
                conversationId: c.conversationId,
                createdAt: { gt: c.lastReadAt },
              }
            })
          : await app.prisma.message.count({
              where: { conversationId: c.conversationId }
            })

        return {
          ...c.conversation,
          avatarUrl: c.conversation.avatarUrl || c.conversation.event?.coverUrl || null,
          eventId: c.conversation.eventId,
          unread: unreadCount,
        }
      })
    )

    return reply.send({ data: convosWithUnread })
  })

  // Get or create DM conversation
  app.post('/conversations/dm', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { userId } = req.body as { userId: string }

    if (sub === userId) return reply.code(400).send({ error: 'Cannot DM yourself' })

    // Check if DM already exists
    const existing = await app.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: { every: { userId: { in: [sub, userId] } } },
      },
      include: {
        members: {
          include: {
            user: { select: { profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
          },
        },
      },
    })

    if (existing && existing.members.length === 2) return reply.send(existing)

    const conversation = await app.prisma.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [{ userId: sub }, { userId }],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
          },
        },
      },
    })

    return reply.code(201).send(conversation)
  })

  // Get conversation linked to an event
  app.get('/conversations/by-event/:eventId', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { eventId } = req.params as { eventId: string }

    const conversation = await app.prisma.conversation.findUnique({
      where: { eventId },
      include: {
        members: {
          include: {
            user: { select: { profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
          },
        },
      },
    })

    if (!conversation) return reply.code(404).send({ error: 'Conversation not found' })

    // Check if user is a member
    const isMember = conversation.members.some((m) => m.userId === sub)
    if (!isMember) return reply.code(403).send({ error: 'Not a member. Join the event first.' })

    return reply.send(conversation)
  })

  // Get messages in a conversation
  app.get('/conversations/:id/messages', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { limit = '50', before } = req.query as any

    const member = await app.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
    })
    if (!member) return reply.code(403).send({ error: 'Not a member' })

    const messages = await app.prisma.message.findMany({
      where: {
        conversationId: id,
        isDeleted: false,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      include: {
        sender: { select: { id: true, profile: { select: { username: true, displayName: true, avatarUrl: true } } } },
        replyTo: { select: { id: true, content: true, sender: { select: { profile: { select: { displayName: true } } } } } },
        reactions: {
          include: { user: { select: { id: true, profile: { select: { displayName: true } } } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    })

    return reply.send({ data: messages.reverse() })
  })

  // Add or toggle a reaction on a message
  app.post('/messages/:id/react', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { emoji } = req.body as { emoji: string }

    if (!emoji) return reply.code(400).send({ error: 'emoji required' })

    const msg = await app.prisma.message.findUnique({ where: { id }, select: { id: true, conversationId: true } })
    if (!msg) return reply.code(404).send({ error: 'Message not found' })

    // Check membership
    const member = await app.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: msg.conversationId, userId: sub } },
    })
    if (!member) return reply.code(403).send({ error: 'Not a member' })

    // Toggle: if same emoji already exists, delete it; otherwise upsert
    const existing = await app.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: id, userId: sub, emoji } }
    })

    if (existing) {
      await app.prisma.messageReaction.delete({ where: { id: existing.id } })
    } else {
      await app.prisma.messageReaction.create({ data: { messageId: id, userId: sub, emoji } })
    }

    // Fetch updated reactions
    const reactions = await app.prisma.messageReaction.findMany({
      where: { messageId: id },
      include: { user: { select: { id: true, profile: { select: { displayName: true } } } } },
    })

    // Broadcast to all conversation members
    broadcastToConversation(app, msg.conversationId, {
      type: 'reaction_update',
      messageId: id,
      reactions,
    })

    return reply.send({ reactions })
  })

  // Delete message (soft delete)
  app.delete('/messages/:id', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const msg = await app.prisma.message.findUnique({ where: { id } })
    if (!msg) return reply.code(404).send({ error: 'Message not found' })
    if (msg.senderId !== sub) return reply.code(403).send({ error: 'Forbidden' })

    await app.prisma.message.update({ where: { id }, data: { isDeleted: true, content: null } })
    return reply.send({ message: 'Deleted' })
  })

  // ── Get single conversation details ─────────────────────────────────────────
  app.get('/conversations/:id', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const member = await app.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
    })
    if (!member) return reply.code(403).send({ error: 'Not a member' })

    const conversation = await app.prisma.conversation.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                profile: { select: { displayName: true, avatarUrl: true, username: true } },
              },
            },
          },
        },
      },
    })

    if (!conversation) return reply.code(404).send({ error: 'Conversation not found' })
    return reply.send(conversation)
  })

  // ── Create group conversation ────────────────────────────────────────────────
  app.post('/conversations/group', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { name, memberIds, avatarUrl } = req.body as {
      name: string
      memberIds: string[]
      avatarUrl?: string
    }

    if (!name || !memberIds?.length) {
      return reply.code(400).send({ error: 'name and memberIds are required' })
    }

    // Always include creator
    const allMemberIds = [...new Set([sub, ...memberIds])]

    const conversation = await app.prisma.conversation.create({
      data: {
        name,
        isGroup: true,
        avatarUrl,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            isAdmin: userId === sub,
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { profile: { select: { displayName: true, avatarUrl: true, username: true } } } },
          },
        },
      },
    })

    return reply.code(201).send(conversation)
  })

  // ── Add member to a group ────────────────────────────────────────────────────
  app.post('/conversations/:id/members', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { userId } = req.body as { userId: string }

    const member = await app.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
    })
    if (!member?.isAdmin) return reply.code(403).send({ error: 'Admin only' })

    await app.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: id, userId } },
      create: { conversationId: id, userId },
      update: {},
    })

    return reply.send({ message: 'Member added' })
  })

  // ── Join a public group ──────────────────────────────────────────────────────
  app.post('/conversations/:id/join', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const conversation = await app.prisma.conversation.findUnique({
      where: { id },
    })

    if (!conversation || !conversation.isGroup) {
      return reply.code(404).send({ error: 'Public group not found' })
    }

    await app.prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
      create: { conversationId: id, userId: sub },
      update: {},
    })

    return reply.code(201).send({ message: 'Joined group' })
  })
  }) // End of protected routes
}

