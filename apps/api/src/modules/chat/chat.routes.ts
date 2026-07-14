import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import { sendPushToUser } from '../../services/push.service'

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
          type: 'message' | 'typing' | 'read' | 'call_start' | 'call_offer' | 'call_answer' | 'ice_candidate' | 'call_reject' | 'call_end'
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
            data: { lastReadAt: new Date(), lastDeliveredAt: new Date() }, // Si lu, c'est aussi distribué
          })
          broadcastToConversation(app, msg.conversationId, {
            type: 'read',
            userId,
            conversationId: msg.conversationId,
            messageId: msg.messageId,
          }, userId)
        }

        if (msg.type === 'delivered' && msg.messageId) {
          await app.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId: msg.conversationId, userId } },
            data: { lastDeliveredAt: new Date() },
          })
          broadcastToConversation(app, msg.conversationId, {
            type: 'delivered',
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

          // When a call_offer arrives, send a FCM push to all offline members
          // so they receive an incoming call notification even when the app is closed
          if (msg.type === 'call_offer') {
            try {
              // Get caller profile
              const callerProfile = await app.prisma.profile.findUnique({
                where: { userId },
                select: { displayName: true, avatarUrl: true },
              })
              const callerName = callerProfile?.displayName ?? 'Quelqu\'un'
              const mediaType = (msg as any).mediaType ?? 'audio'
              const mediaLabel = mediaType === 'video' ? 'vidéo' : 'audio'

              // Get all members except the caller
              const members = await app.prisma.conversationMember.findMany({
                where: { conversationId: msg.conversationId, userId: { not: userId } },
                select: { userId: true },
              })

              // Only send FCM push if the user is NOT connected via WebSocket.
              // If they are online via WS, the call_offer was already relayed above.
              // Sending FCM to an online user would cause a DUPLICATE call_offer on the client
              // which triggers an auto-reject (callStatus !== 'IDLE') and silently kills the call.
              await Promise.allSettled(
                members.map(async ({ userId: recipientId }) => {
                  const isOnline = connections.has(recipientId) && connections.get(recipientId)!.size > 0
                  if (isOnline) {
                    app.log.info(`[FCM] Skipping push for ${recipientId} — already online via WS`)
                    return
                  }
                  await sendPushToUser(app.prisma, recipientId, {
                    title: `📞 Appel ${mediaLabel} entrant`,
                    body: `${callerName} vous appelle`,
                    isCall: true,
                    data: {
                      type: 'INCOMING_CALL',
                      conversationId: msg.conversationId,
                      callerId: userId,
                      mediaType,
                      offer: JSON.stringify((msg as any).offer ?? null),
                      callerName,
                      callerAvatar: callerProfile?.avatarUrl ?? '',
                      wsRelayed: 'false',
                    },
                  })
                })
              )
            } catch (callPushErr) {
              app.log.warn(`[FCM] Failed to send call push: ${String(callPushErr)}`)
            }
          }
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
        include: { conversation: true }
      })
      if (!member) return reply.code(403).send({ error: 'Not a member' })

      if (!member.conversation.isGroup) {
        // It's a DM, check if the other member has blocked this user or if this user has blocked the other
        const otherMember = await app.prisma.conversationMember.findFirst({
          where: { conversationId, userId: { not: sub } }
        })
        if (otherMember) {
          const block = await app.prisma.friendship.findFirst({
            where: {
              status: 'BLOCKED',
              OR: [
                { initiatorId: sub, receiverId: otherMember.userId },
                { initiatorId: otherMember.userId, receiverId: sub }
              ]
            }
          })
          if (block) {
            return reply.code(403).send({ error: 'Impossible d\'envoyer un message.' })
          }
        }
      }

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

        // Send FCM push notification for offline members
        const senderName = message.sender.profile?.displayName ?? 'Quelqu\'un'
        const msgPreviewRaw = type === 'TEXT'
          ? content.substring(0, 60) + (content.length > 60 ? '...' : '')
          : type === 'IMAGE' ? '📷 Photo'
          : type === 'VIDEO' ? '🎥 Vidéo'
          : type === 'AUDIO' ? '🎵 Message vocal'
          : content.substring(0, 60)

        const isGroup = conversation?.isGroup === true;
        const pushTitle = isGroup ? (conversation.name || 'Groupe') : senderName;
        const pushBody = isGroup ? `${senderName}: ${msgPreviewRaw}` : msgPreviewRaw;

        await Promise.allSettled(
          offlineMembers.map(({ userId: recipientId }) =>
            sendPushToUser(app.prisma, recipientId, {
              title: pushTitle,
              body: pushBody,
              data: {
                type: 'NEW_MESSAGE',
                conversationId,
                messageId: message.id,
              },
            })
          )
        )
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

    // Check if there is a block
    const block = await app.prisma.friendship.findFirst({
      where: {
        status: 'BLOCKED',
        OR: [
          { initiatorId: sub, receiverId: userId },
          { initiatorId: userId, receiverId: sub }
        ]
      }
    })

    if (block) {
      return reply.code(403).send({ error: 'Impossible de contacter cet utilisateur.' })
    }

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
    
    // Broadcast message deletion
    broadcastToConversation(app, msg.conversationId, { type: 'message_deleted', messageId: msg.id }, sub)

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

  // ── Leave group conversation ────────────────────────────────────────────────
  app.delete('/conversations/:id/leave', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const member = await app.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
      include: { conversation: true },
    })

    if (!member) return reply.code(403).send({ error: 'Not a member' })
    if (!member.conversation.isGroup) return reply.code(400).send({ error: 'Cannot leave a direct conversation' })

    await app.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
    })

    return reply.send({ success: true })
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

  // Get real-time presence for a conversation
  app.get('/conversations/:id/presence', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }

    const conversation = await app.prisma.conversation.findUnique({
      where: { id },
      include: { members: true }
    })

    if (!conversation) return reply.code(404).send({ error: 'Not found' })
    if (!conversation.members.some((m: any) => m.userId === sub)) return reply.code(403).send({ error: 'Forbidden' })

    // Count how many members (excluding the current user) are online
    let onlineCount = 0
    let isOtherOnline = false

    conversation.members.forEach((m: any) => {
      if (m.userId === sub) return
      const isOnline = connections.has(m.userId) && connections.get(m.userId)!.size > 0
      if (isOnline) {
        onlineCount++
        isOtherOnline = true
      }
    })

    return reply.send({ onlineCount, isOtherOnline, totalMembers: conversation.members.length })
  })

  // Mute/unmute a conversation
  app.post('/conversations/:id/mute', async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { mutedUntil } = req.body as { mutedUntil?: string | null } // null to unmute

    const member = await app.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: sub } }
    })

    if (!member) return reply.code(403).send({ error: 'Forbidden' })

    await app.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: id, userId: sub } },
      data: { mutedUntil: mutedUntil ? new Date(mutedUntil) : null }
    })

    return reply.send({ success: true })
  })

  }) // End of protected routes
}
