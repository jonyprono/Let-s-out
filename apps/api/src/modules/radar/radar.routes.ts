import { FastifyInstance } from 'fastify'
import { createAndSendNotification } from '../notifications/notifications.routes'

// Formule de Haversine pour le calcul de distance en kilomètres
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Tranches de proximité génériques (AUCUNE coordonnée exacte ni distance précise au mètre près)
function getProximityLabel(distanceKm: number): string {
  if (distanceKm <= 0.5) return 'À proximité immédiate'
  if (distanceKm <= 1.0) return "À moins d'1 km"
  if (distanceKm <= 3.0) return "À moins de 3 km"
  return 'Dans votre zone (moins de 5 km)'
}

// Vérification de la majorité (18 ans et plus)
function isAdult(birthDate: Date | null | undefined): boolean {
  if (!birthDate) return false
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const m = now.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--
  }
  return age >= 18
}

// Types de sorties autorisés
export const RADAR_OUTING_TYPES = [
  'SPONTANEOUS',     // Sortie spontanée
  'RESTAURANT_BAR',   // Restaurant ou bar
  'SPECIFIC_EVENT',   // Événement précis
  'GROUP_ACTIVITY',   // Activité de groupe
] as const

export default async function radarRoutes(app: FastifyInstance) {
  // ── 1. GET /status — Statut de visibilité actuel de l'utilisateur ───────────
  app.get('/status', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }

    const visibility = await app.prisma.radarVisibility.findUnique({
      where: { userId },
    })

    const now = new Date()

    // Si la visibilité est expirée, on purge immédiatement
    if (visibility?.isVisible && visibility.expiresAt && visibility.expiresAt <= now) {
      await app.prisma.radarVisibility.update({
        where: { userId },
        data: {
          isVisible: false,
          latitude: null,
          longitude: null,
          locationUpdatedAt: null,
        },
      })

      return reply.send({
        data: {
          isVisible: false,
          durationMinutes: visibility.durationMinutes,
          remainingSeconds: 0,
          expiresAt: visibility.expiresAt,
          outingType: visibility.outingType,
        },
      })
    }

    const remainingSeconds =
      visibility?.isVisible && visibility.expiresAt
        ? Math.max(0, Math.floor((visibility.expiresAt.getTime() - now.getTime()) / 1000))
        : 0

    return reply.send({
      data: {
        isVisible: Boolean(visibility?.isVisible),
        durationMinutes: visibility?.durationMinutes ?? null,
        remainingSeconds,
        expiresAt: visibility?.expiresAt ?? null,
        outingType: visibility?.outingType ?? null,
      },
    })
  })

  // ── 2. POST /visibility — Activer ou désactiver sa visibilité ────────────────
  app.post('/visibility', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { isVisible, durationMinutes, outingType, latitude, longitude } = req.body as {
      isVisible: boolean
      durationMinutes?: 30 | 60
      outingType?: string
      latitude?: number
      longitude?: number
    }

    // Vérifier l'âge de l'utilisateur (18+ ans requis)
    const profile = await app.prisma.profile.findUnique({
      where: { userId },
      select: { birthDate: true, kycBirthDate: true },
    })

    const birthDate = profile?.kycBirthDate || profile?.birthDate
    if (!isAdult(birthDate)) {
      return reply.code(403).send({
        error: 'OUT RADAR est réservé aux membres majeurs (18 ans et plus) pour des raisons de sécurité.',
      })
    }

    if (isVisible) {
      if (!durationMinutes || ![30, 60].includes(durationMinutes)) {
        return reply.code(400).send({ error: 'La durée de visibilité doit être de 30 ou 60 minutes.' })
      }

      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return reply.code(400).send({ error: 'Coordonnées de géolocalisation invalides.' })
      }

      const now = new Date()
      const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000)

      const updated = await app.prisma.radarVisibility.upsert({
        where: { userId },
        create: {
          userId,
          isVisible: true,
          durationMinutes,
          outingType: outingType || 'SPONTANEOUS',
          latitude,
          longitude,
          activatedAt: now,
          expiresAt,
          locationUpdatedAt: now,
        },
        update: {
          isVisible: true,
          durationMinutes,
          outingType: outingType || 'SPONTANEOUS',
          latitude,
          longitude,
          activatedAt: now,
          expiresAt,
          locationUpdatedAt: now,
        },
      })

      return reply.send({
        data: {
          isVisible: true,
          durationMinutes: updated.durationMinutes,
          expiresAt: updated.expiresAt,
          remainingSeconds: durationMinutes * 60,
          outingType: updated.outingType,
        },
      })
    } else {
      // DÉSACTIVATION IMMÉDIATE : purge intégrale des coordonnées GPS
      await app.prisma.radarVisibility.upsert({
        where: { userId },
        create: {
          userId,
          isVisible: false,
          latitude: null,
          longitude: null,
          locationUpdatedAt: null,
          expiresAt: null,
        },
        update: {
          isVisible: false,
          latitude: null,
          longitude: null,
          locationUpdatedAt: null,
          expiresAt: null,
        },
      })

      return reply.send({
        data: {
          isVisible: false,
          durationMinutes: null,
          remainingSeconds: 0,
          expiresAt: null,
          outingType: null,
        },
      })
    }
  })

  // ── 3. POST /search — Recherche de profils visibles à proximité ─────────────
  app.post('/search', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { latitude, longitude, radiusKm, gender, verifiedOnly, outingType } = req.body as {
      latitude: number
      longitude: number
      radiusKm: number
      gender?: 'ALL' | 'FEMALE' | 'MALE'
      verifiedOnly?: boolean
      outingType?: string
    }

    // 1. Validation des coordonnées de recherche
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return reply.code(400).send({ error: 'Position actuelle requise pour effectuer une recherche.' })
    }

    // 2. Validation du rayon (liste fermée : 0.5, 1, 3, 5 km)
    const allowedRadii = [0.5, 1, 3, 5]
    if (!allowedRadii.includes(radiusKm)) {
      return reply.code(400).send({ error: 'Le rayon doit être de 500m, 1km, 3km ou 5km.' })
    }

    // 3. Vérifier l'âge du chercheur (18+)
    const userProfile = await app.prisma.profile.findUnique({
      where: { userId },
      select: { birthDate: true, kycBirthDate: true },
    })
    const userBirthDate = userProfile?.kycBirthDate || userProfile?.birthDate
    if (!isAdult(userBirthDate)) {
      return reply.code(403).send({
        error: 'OUT RADAR est réservé aux membres majeurs (18 ans et plus).',
      })
    }

    const now = new Date()

    // 4. Récupérer les utilisateurs bloqués (mutuel)
    const blocks = await app.prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    })

    const blockedUserIds = new Set<string>()
    for (const b of blocks) {
      if (b.blockerId === userId) blockedUserIds.add(b.blockedId)
      if (b.blockedId === userId) blockedUserIds.add(b.blockerId)
    }

    // 5. Récupérer les invitations récentes avec chaque utilisateur (pour état)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const recentInvites = await app.prisma.radarInvite.findMany({
      where: {
        OR: [
          { senderId: userId, createdAt: { gte: oneDayAgo } },
          { receiverId: userId, createdAt: { gte: oneDayAgo } },
        ],
      },
      select: { id: true, senderId: true, receiverId: true, status: true, createdAt: true },
    })

    // 6. Requête des profils visibles actifs (candidats)
    const candidates = await app.prisma.radarVisibility.findMany({
      where: {
        isVisible: true,
        expiresAt: { gt: now },
        userId: {
          not: userId,
          ...(blockedUserIds.size > 0 ? { notIn: Array.from(blockedUserIds) } : {}),
        },
        latitude: { not: null },
        longitude: { not: null },
        user: {
          isBanned: false,
          deletedAt: null,
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            isVerified: true,
            profile: {
              select: {
                displayName: true,
                username: true,
                avatarUrl: true,
                gender: true,
                kycStatus: true,
                birthDate: true,
                kycBirthDate: true,
              },
            },
          },
        },
      },
      take: 100, // Limite haute serveur avant calcul distance
    })

    // 7. Filtrage côté serveur (Distance Haversine + Filtres combinés stricts)
    const results: Array<{
      id: string
      displayName: string
      username: string
      avatarUrl: string | null
      isVerified: boolean
      gender: string | null
      outingType: string | null
      proximity: string
      inviteStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null
      canInvite: boolean
    }> = []

    for (const item of candidates) {
      if (!item.latitude || !item.longitude) continue

      // Sécurité : n'afficher que les utilisateurs majeurs (18+)
      const targetBirthDate = item.user.profile?.kycBirthDate || item.user.profile?.birthDate
      if (!isAdult(targetBirthDate)) continue

      // Calcul de la distance
      const distance = getDistanceKm(latitude, longitude, item.latitude, item.longitude)
      if (distance > radiusKm) continue

      // Filtre Genre
      if (gender && gender !== 'ALL') {
        const itemGender = item.user.profile?.gender?.toUpperCase()
        if (gender === 'FEMALE' && itemGender !== 'FEMALE' && itemGender !== 'FEMME' && itemGender !== 'F') {
          continue
        }
        if (gender === 'MALE' && itemGender !== 'MALE' && itemGender !== 'HOMME' && itemGender !== 'M') {
          continue
        }
      }

      // Filtre Vérification KYC
      const isVerified = item.user.profile?.kycStatus === 'verified' || item.user.isVerified
      if (verifiedOnly && !isVerified) continue

      // Filtre Type de sortie
      if (outingType && outingType !== 'ALL' && item.outingType !== outingType) {
        continue
      }

      // Vérifier le statut de l'invitation existante avec cet utilisateur
      const relatedInvite = recentInvites.find(
        (inv) =>
          (inv.senderId === userId && inv.receiverId === item.userId) ||
          (inv.senderId === item.userId && inv.receiverId === userId)
      )

      let inviteStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | null = null
      let canInvite = true

      if (relatedInvite) {
        inviteStatus = relatedInvite.status as any
        if (relatedInvite.status === 'PENDING') {
          canInvite = false
        } else if (relatedInvite.status === 'DECLINED') {
          // Si refusé dans les 24h, on interdit de réinviter
          canInvite = false
        } else if (relatedInvite.status === 'ACCEPTED') {
          canInvite = false
        }
      }

      // Retourne uniquement les données non géographiques (JAMAIS les coordonnées brutes)
      results.push({
        id: item.user.id,
        displayName: item.user.profile?.displayName || 'Outster',
        username: item.user.profile?.username || '',
        avatarUrl: item.user.profile?.avatarUrl || null,
        isVerified,
        gender: item.user.profile?.gender || null,
        outingType: item.outingType || null,
        proximity: getProximityLabel(distance),
        inviteStatus,
        canInvite,
      })
    }

    return reply.send({ data: results })
  })

  // ── 4. POST /invites — Envoyer une invitation à un profil radar ─────────────
  app.post('/invites', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: senderId } = req.user as { sub: string }
    const { receiverId, outingType, message } = req.body as {
      receiverId: string
      outingType?: string
      message?: string
    }

    if (!receiverId || receiverId === senderId) {
      return reply.code(400).send({ error: 'Destinataire invalide.' })
    }

    // 1. Anti-spam : vérifier le nombre d'invitations envoyées dans la dernière heure (max 10)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const sentCountLastHour = await app.prisma.radarInvite.count({
      where: {
        senderId,
        createdAt: { gte: oneHourAgo },
      },
    })

    if (sentCountLastHour >= 10) {
      return reply.code(429).send({
        error: "Limite d'invitations atteinte (10 par heure maximum). Merci de patienter.",
      })
    }

    // 2. Vérifier les blocages mutuels
    const block = await app.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedId: receiverId },
          { blockerId: receiverId, blockedId: senderId },
        ],
      },
    })

    if (block) {
      return reply.code(403).send({ error: 'Impossible d’envoyer une invitation à cet utilisateur.' })
    }

    // 3. Vérifier s'il y a déjà une invitation PENDING
    const existingPending = await app.prisma.radarInvite.findFirst({
      where: {
        senderId,
        receiverId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })

    if (existingPending) {
      return reply.code(400).send({ error: 'Une invitation est déjà en cours avec cet utilisateur.' })
    }

    // 4. Vérifier s'il y a eu un refus dans les 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentDeclined = await app.prisma.radarInvite.findFirst({
      where: {
        senderId,
        receiverId,
        status: 'DECLINED',
        updatedAt: { gte: oneDayAgo },
      },
    })

    if (recentDeclined) {
      return reply.code(403).send({
        error: 'Cet utilisateur a décliné une invitation récemment. Merci de patienter 24h avant de réessayer.',
      })
    }

    // 5. Création de l'invitation (expire après 2h)
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000)

    const invite = await app.prisma.radarInvite.create({
      data: {
        senderId,
        receiverId,
        status: 'PENDING',
        outingType: outingType || null,
        message: message?.trim() || null,
        expiresAt,
      },
      include: {
        sender: {
          select: {
            profile: { select: { displayName: true } },
          },
        },
      },
    })

    // 6. Notification au destinataire (Push + In-App)
    try {
      const senderName = invite.sender.profile?.displayName || 'Un Outster'
      await createAndSendNotification(app, {
        userId: receiverId,
        type: 'RADAR_INVITE' as any,
        title: 'Nouvelle invitation OUT RADAR',
        body: `${senderName} souhaite partager une sortie avec vous !`,
        data: { inviteId: invite.id, senderId },
      })
    } catch (e) {
      app.log.warn(`[OUT_RADAR] Failed to send push notification: ${e}`)
    }

    return reply.code(201).send({ data: invite })
  })

  // ── 5. GET /invites — Liste de mes invitations (reçues et envoyées) ─────────
  app.get('/invites', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }

    const invites = await app.prisma.radarInvite.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            isVerified: true,
            profile: { select: { displayName: true, username: true, avatarUrl: true, kycStatus: true } },
          },
        },
        receiver: {
          select: {
            id: true,
            isVerified: true,
            profile: { select: { displayName: true, username: true, avatarUrl: true, kycStatus: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return reply.send({ data: invites })
  })

  // ── 6. PATCH /invites/:id/respond — Répondre à une invitation (Accepter / Refuser)
  app.patch('/invites/:id/respond', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub: userId } = req.user as { sub: string }
    const { id } = req.params as { id: string }
    const { action } = req.body as { action: 'ACCEPT' | 'DECLINE' }

    if (!['ACCEPT', 'DECLINE'].includes(action)) {
      return reply.code(400).send({ error: "Action invalide (doit être 'ACCEPT' ou 'DECLINE')." })
    }

    const invite = await app.prisma.radarInvite.findUnique({
      where: { id },
      include: {
        receiver: { select: { profile: { select: { displayName: true } } } },
      },
    })

    if (!invite) return reply.code(404).send({ error: 'Invitation introuvable.' })
    if (invite.receiverId !== userId) {
      return reply.code(403).send({ error: 'Vous n’êtes pas le destinataire de cette invitation.' })
    }

    if (invite.status !== 'PENDING') {
      return reply.code(400).send({ error: `Cette invitation est déjà ${invite.status.toLowerCase()}.` })
    }

    if (action === 'ACCEPT') {
      const updated = await app.prisma.radarInvite.update({
        where: { id },
        data: { status: 'ACCEPTED' },
      })

      // Créer ou récupérer la conversation DM dans le chat existant
      let conversationId: string | null = null
      try {
        const existingConv = await app.prisma.conversation.findFirst({
          where: {
            isGroup: false,
            members: { every: { userId: { in: [invite.senderId, invite.receiverId] } } },
          },
        })

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const newConv = await app.prisma.conversation.create({
            data: {
              isGroup: false,
              members: {
                create: [{ userId: invite.senderId }, { userId: invite.receiverId }],
              },
            },
          })
          conversationId = newConv.id
        }
      } catch (err) {
        app.log.warn(`[OUT_RADAR] Failed to auto-create conversation: ${err}`)
      }

      // Notification à l'émetteur
      try {
        const receiverName = invite.receiver.profile?.displayName || 'Un Outster'
        await createAndSendNotification(app, {
          userId: invite.senderId,
          type: 'RADAR_ACCEPT' as any,
          title: 'Invitation OUT RADAR acceptée !',
          body: `${receiverName} a accepté votre invitation. Vous pouvez désormais discuter ensemble.`,
          data: { inviteId: invite.id, conversationId },
        })
      } catch (e) {
        app.log.warn(`[OUT_RADAR] Notification error: ${e}`)
      }

      return reply.send({
        data: {
          ...updated,
          conversationId,
        },
      })
    } else {
      const updated = await app.prisma.radarInvite.update({
        where: { id },
        data: { status: 'DECLINED' },
      })

      return reply.send({ data: updated })
    }
  })
}
