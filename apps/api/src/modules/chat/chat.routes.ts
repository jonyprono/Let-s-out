import type { FastifyInstance } from 'fastify'
import type { WebSocket } from 'ws'
import { sendPushToUser } from '../../services/push.service'
import { aiService } from '../../services/ai.service'

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
    // Use updateMany so it silently skips if user not found (avoids P2025 crash)
    await app.prisma.user.updateMany({ where: { id: userId }, data: { lastSeenAt: new Date() } })

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: 'message' | 'typing' | 'read' | 'delivered' | 'call_start' | 'call_offer' | 'call_answer' | 'ice_candidate' | 'call_reject' | 'call_end'
          conversationId: string
          content?: string
          messageType?: string
          messageId?: string
        }

        if (msg.type === 'message' && msg.content) {
          // Verify member and fetch conversation with members
          const conversation = await app.prisma.conversation.findUnique({
            where: { id: msg.conversationId },
            include: { members: { include: { user: true } } }
          })
          if (!conversation) return

          const sender = conversation.members.find(m => m.userId === userId)
          if (!sender) return

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

          // ── AI Bot Logic ──────────────────────────────────────────────────
          const botMembers = conversation.members.filter(m => m.user.isBot)
          const senderIsBot = sender.user.isBot
          const senderIsAdmin = (sender.user as any).role === 'ADMIN'

          app.log.info(`[BOT] Message in conv ${conversation.id}: senderIsBot=${senderIsBot}, senderIsAdmin=${senderIsAdmin}, bots=${botMembers.length}, paused=${conversation.isBotPaused}`)

          // Only trigger bot if there are bot members AND sender is not a bot
          if (botMembers.length > 0 && !senderIsBot) {
            let shouldReply = false
            let currentPaused = conversation.isBotPaused

            if (senderIsAdmin) {
              // Admin took over — pause bot
              app.log.info(`[BOT] Admin message detected, pausing bot in conv ${conversation.id}`)
              await app.prisma.conversation.update({
                where: { id: conversation.id },
                data: { isBotPaused: true, adminLastMessageAt: new Date() }
              })
            } else {
              // Normal user — check if bot was paused by admin
              if (currentPaused) {
                if (!conversation.adminLastMessageAt) {
                  // Paused but no admin timestamp? Unpause immediately
                  await app.prisma.conversation.update({
                    where: { id: conversation.id },
                    data: { isBotPaused: false }
                  })
                  currentPaused = false
                  app.log.info(`[BOT] Bot auto-reactivated (no admin timestamp) in conv ${conversation.id}`)
                } else {
                  const minutesSinceAdmin = (Date.now() - conversation.adminLastMessageAt.getTime()) / 60000
                  app.log.info(`[BOT] Bot was paused, ${minutesSinceAdmin.toFixed(1)} min since admin message`)
                  if (minutesSinceAdmin > 5) {
                    await app.prisma.conversation.update({
                      where: { id: conversation.id },
                      data: { isBotPaused: false }
                    })
                    currentPaused = false
                    app.log.info(`[BOT] Bot auto-reactivated after 5 min in conv ${conversation.id}`)
                  }
                }
              }

              if (!currentPaused) {
                shouldReply = true
              } else {
                app.log.info(`[BOT] Bot still paused in conv ${conversation.id}, not replying`)
              }
            }

            if (shouldReply) {
              const bot = botMembers[0]
              app.log.info(`[BOT] Triggering reply from ${bot.userId} in conv ${conversation.id}`)

              // Send typing indicator
              const botProfile = await app.prisma.profile.findUnique({
                where: { userId: bot.userId },
                select: { displayName: true }
              })
              // Send typing indicator repeatedly every 2s while the AI is thinking
              // (frontend typing timeout is 3s — so we refresh it to keep it alive)
              const sendTyping = () => broadcastToConversation(app, conversation.id, {
                type: 'typing',
                userId: bot.userId,
                conversationId: conversation.id,
                displayName: botProfile?.displayName ?? 'Agent',
              }, bot.userId)

              sendTyping()
              const typingInterval = setInterval(sendTyping, 2000)

              // Fetch history, generate AI response, broadcast — all async to not block
              app.prisma.message.findMany({
                where: { conversationId: conversation.id },
                orderBy: { createdAt: 'desc' },
                take: 12
              })
                .then(history => {
                  // Reverse to chronological order
                  const reversed = history.reverse()
                  // Map to AI format, skip the last message (we pass it separately)
                  const formattedHistory = reversed
                    .slice(0, reversed.length - 1)
                    .map(m => ({ role: m.senderId === bot.userId ? 'bot' : 'user', content: m.content || '...' }))
                  app.log.info(`[BOT] History length: ${formattedHistory.length}`)
                  return aiService.generateSupportResponse(bot.userId, conversation.id, formattedHistory, msg.content || '[Fichier/Image joint]')
                })
                .then(replyContent => {
                  app.log.info(`[BOT] Got reply: "${replyContent?.substring(0, 80)}..."`)
                  if (replyContent) {
                    return app.prisma.message.create({
                      data: {
                        conversationId: conversation.id,
                        senderId: bot.userId,
                        type: 'TEXT',
                        content: replyContent
                      },
                      include: {
                        sender: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } }
                      }
                    })
                  }
                  return null
                })
                .then(replyMsg => {
                  clearInterval(typingInterval)
                  if (replyMsg) {
                    broadcastToConversation(app, conversation.id, { type: 'new_message', message: replyMsg }, undefined)
                    return app.prisma.conversation.update({
                      where: { id: conversation.id },
                      data: { lastMessageAt: new Date() }
                    })
                  }
                })
                .catch(err => {
                  clearInterval(typingInterval)
                  app.log.error(`[BOT] Error in bot response chain: ${String(err)}`)
                })
            }
          }
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
          await app.prisma.conversationMember.updateMany({
            where: { conversationId: msg.conversationId, userId },
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
          await app.prisma.conversationMember.updateMany({
            where: { conversationId: msg.conversationId, userId },
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
    
    await app.prisma.conversationMember.updateMany({
      where: {
        conversationId: id,
        userId: sub,
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

    // If chatting with a bot, send a welcome message automatically
    const targetUser = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { isBot: true, botPrompt: true, profile: true }
    })

    if (targetUser?.isBot) {
      const botName = targetUser.profile?.displayName || 'votre agent'
      const welcomePrompt = `Bonjour ! Je suis ${botName}, votre agent de support Let's Out. Comment puis-je vous aider aujourd'hui ?`
      app.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          type: 'TEXT',
          content: welcomePrompt
        },
        include: { sender: { select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } } } }
      }).then(welcomeMsg => {
        broadcastToConversation(app, conversation.id, { type: 'new_message', message: welcomeMsg }, undefined)
        return app.prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } })
      }).catch(console.error)
    }

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

  // ── Admin Bot Management ──────────────────────────────────────────────────
  app.get('/admin/bots', async (_req, reply) => {
    // Ideally verify admin role here
    const bots = await app.prisma.user.findMany({
      where: { isBot: true },
      include: { profile: true }
    })
    reply.send(bots)
  })

  app.put('/admin/bots/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { botPrompt } = req.body as { botPrompt: string }
    const updated = await app.prisma.user.update({
      where: { id },
      data: { botPrompt }
    })
    reply.send(updated)
  })

  app.get('/admin/bot-conversations', async (_req, reply) => {
    // Fetch conversations where a bot is a member
    const conversations = await app.prisma.conversation.findMany({
      where: {
        members: { some: { user: { isBot: true } } }
      },
      include: {
        members: { include: { user: { include: { profile: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { lastMessageAt: 'desc' }
    })
    reply.send(conversations)
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

    // For DM conversations, check if there's a block between the two users
    let blockStatus: 'none' | 'i_blocked' | 'they_blocked' = 'none'
    if (!conversation.isGroup) {
      const otherMemberId = conversation.members.find(m => m.userId !== sub)?.userId
      if (otherMemberId) {
        const block = await app.prisma.friendship.findFirst({
          where: {
            status: 'BLOCKED',
            OR: [
              { initiatorId: sub, receiverId: otherMemberId },
              { initiatorId: otherMemberId, receiverId: sub },
            ]
          }
        })
        if (block) {
          blockStatus = block.initiatorId === sub ? 'i_blocked' : 'they_blocked'
        }
      }
    }

    return reply.send({ ...conversation, blockStatus })

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
