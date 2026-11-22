import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { createAndSendNotificationMany } from '../modules/notifications/notifications.routes'

export default fp(async (fastify: FastifyInstance) => {
  // Check every 15 minutes
  const INTERVAL_MS = 15 * 60 * 1000

  const runCron = async () => {
    try {
      const now = new Date()

      // ── Cagnotte : validateurs qui n'ont pas répondu dans le délai (PAYOUT_APPROVAL_DEADLINE_HOURS) ──
      // Leur part revient dans la cagnotte, la demande est recalculée (jamais bloquée), les délégants
      // sont invités à reprendre la main.
      try {
        const { expireOverdueApprovals } = await import('../services/payout-engine.service')
        const expired = await expireOverdueApprovals((fastify as any).prisma, now)
        for (const e of expired) {
          const notifications: any[] = e.affectedUserIds.map((uid) => ({
            userId: uid,
            type: 'SYSTEM',
            title: 'Reprise en main requise',
            body: `Votre validateur n'a pas répondu à temps pour le déblocage de ${e.amount} F sur ${e.eventTitle} — choisissez qui doit valider votre part.`,
            data: { eventId: e.eventId, payoutId: e.payoutId, action: 'FALLBACK_REQUIRED', screen: 'pool-validation' },
          }))
          notifications.push({
            userId: e.validatorId,
            type: 'SYSTEM',
            title: 'Délai de validation dépassé',
            body: `Vous n'avez pas répondu à temps pour le déblocage de ${e.amount} F sur ${e.eventTitle}. Vos droits ont été révoqués pour cette demande.`,
            data: { eventId: e.eventId, payoutId: e.payoutId, screen: 'event-details' },
          })
          if (e.validatorId !== e.creatorId) {
            notifications.push({
              userId: e.creatorId,
              type: 'SYSTEM',
              title: "Un validateur n'a pas répondu",
              body: `${e.validatorName} n'a pas répondu à temps pour le déblocage de ${e.amount} F sur ${e.eventTitle}. Sa part retourne dans la cagnotte.`,
              data: { eventId: e.eventId, payoutId: e.payoutId, screen: 'event-details' },
            })
          }
          await createAndSendNotificationMany(fastify, notifications).catch((err: any) => {
            fastify.log.error({ err }, `Failed to send expiry notifications for payout ${e.payoutId}:`)
          })
        }
      } catch (payoutErr: any) {
        fastify.log.error({ payoutErr }, '[POOL_PAYOUT_CRON] Échec du traitement des délais de validation')
      }

      // ── Retraits Mobile Money : suivi du statut FedaPay (envoyé / échoué → recrédit automatique) ──
      try {
        const { reconcileMobileMoneyPayouts } = await import('../services/mobile-money-payout.service')
        const results = await reconcileMobileMoneyPayouts((fastify as any).prisma, now)
        for (const r of results) fastify.log.info(r, '[Retrait Mobile Money] Statut mis à jour')
      } catch (mmErr: any) {
        fastify.log.error({ mmErr }, '[MOBILE_MONEY_CRON] Échec du suivi des retraits')
      }

      // ── Billetterie : versement des recettes (fin d'événement + délai TICKET_PAYOUT_DELAY_HOURS) ──
      try {
        const { releaseDueTicketRevenues } = await import('../services/ticketing.service')
        const released = await releaseDueTicketRevenues((fastify as any).prisma, now)
        for (const r of released) if (r.released) fastify.log.info(r, '[Billetterie] Recettes versées sur le Wallet')
      } catch (ticketErr: any) {
        fastify.log.error({ ticketErr }, '[Billetterie] Échec du versement des recettes')
      }

      // ── Event Reminders ──────────────────────────────────────────────────
      // Rappel J-3 (72 h avant) aux participants confirmés. Un événement déjà à moins de 48 h (créé
      // tard, ou existant au déploiement) n'a pas de « J-3 » : il est simplement marqué comme traité.
      try {
        const { REMINDER_J3_HOURS, REMINDER_J3_MIN_LEAD_HOURS } = await import('../config/event-time')
        const j3Limit = new Date(now.getTime() + REMINDER_J3_HOURS * 3600_000)
        const j3MinLead = new Date(now.getTime() + REMINDER_J3_MIN_LEAD_HOURS * 3600_000)
        const eventsJ3 = await (fastify as any).prisma.event.findMany({
          where: { status: 'PUBLISHED', reminder72hSent: false, startAt: { gte: now, lte: j3Limit } },
          select: { id: true, title: true, startAt: true, bookings: { where: { status: 'CONFIRMED' }, select: { userId: true } } },
          take: 200,
        })
        for (const ev of eventsJ3) {
          // Marqué d'abord : un échec d'envoi ne provoque jamais de doublon au cycle suivant
          const { count } = await (fastify as any).prisma.event.updateMany({ where: { id: ev.id, reminder72hSent: false }, data: { reminder72hSent: true } })
          if (count === 0 || new Date(ev.startAt) < j3MinLead || ev.bookings.length === 0) continue
          await createAndSendNotificationMany(fastify, ev.bookings.map((b: any) => ({
            userId: b.userId,
            type: 'EVENT_REMINDER',
            title: '📅 J-3 !',
            // Texte traduit côté app (lib/notification-text.ts, data.kind) ; celui-ci sert au push natif
            body: `J-3 avant ${ev.title} ! Préparez-vous.`,
            data: { eventId: ev.id, eventTitle: ev.title, kind: 'REMINDER_J3', screen: 'event-details' },
          }))).catch(() => {})
        }
      } catch (j3Err: any) {
        fastify.log.error({ j3Err }, '[REMINDER_J3] Échec des rappels J-3')
      }

      const setting1 = await (fastify as any).prisma.systemSetting.findUnique({ where: { key: 'EVENT_REMINDER_1_HOURS' } })
      const hours1 = setting1 && !isNaN(Number(setting1.value)) ? Number(setting1.value) : 24
      
      const setting2 = await (fastify as any).prisma.systemSetting.findUnique({ where: { key: 'EVENT_REMINDER_2_HOURS' } })
      const hours2 = setting2 && !isNaN(Number(setting2.value)) ? Number(setting2.value) : 2

      // Check for Reminder 1
      const targetTime1 = new Date(now.getTime() + hours1 * 60 * 60 * 1000)
      const events1 = await (fastify as any).prisma.event.findMany({
        where: {
          status: 'PUBLISHED',
          reminder24hSent: false,
          startAt: { gte: now, lte: targetTime1 }
        },
        include: { bookings: { where: { status: 'CONFIRMED' } } }
      })

      for (const ev of events1) {
        if (ev.bookings.length > 0) {
          const notifications = ev.bookings.map((b: any) => ({
            userId: b.userId,
            type: 'EVENT_REMINDER',
            title: '⏰ Rappel d\'événement',
            // Rappel de la veille (24 h par défaut) : « outfit » ; traduit côté app via data.kind
            body: `Plus que ${hours1}h avant ${ev.title} ! Est-ce que votre outfit est prêt ? ✨`,
            data: { eventId: ev.id, eventTitle: ev.title, hours: String(hours1), kind: 'REMINDER_J1', screen: 'event-details' }
          }))
          await createAndSendNotificationMany(fastify, notifications).catch(() => {})
        }
        await (fastify as any).prisma.event.update({ where: { id: ev.id }, data: { reminder24hSent: true } })
      }

      // Check for Reminder 2
      const targetTime2 = new Date(now.getTime() + hours2 * 60 * 60 * 1000)
      const events2 = await (fastify as any).prisma.event.findMany({
        where: {
          status: 'PUBLISHED',
          reminder2hSent: false,
          startAt: { gte: now, lte: targetTime2 }
        },
        include: { bookings: { where: { status: 'CONFIRMED' } } }
      })

      for (const ev of events2) {
        if (ev.bookings.length > 0) {
          const notifications = ev.bookings.map((b: any) => ({
            userId: b.userId,
            type: 'EVENT_REMINDER',
            title: '⏳ Événement imminent',
            body: `L'événement "${ev.title}" commence dans moins de ${hours2} heures ! Tenez-vous prêt.`,
            data: { eventId: ev.id, screen: 'event-details' }
          }))
          await createAndSendNotificationMany(fastify, notifications).catch(() => {})
        }
        await (fastify as any).prisma.event.update({ where: { id: ev.id }, data: { reminder2hSent: true } })
      }

      // ── Relance utilisateurs inactifs (> 72h) avec les événements populaires / vedettes ──
      try {
        const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000)

        // 1. Trouver les événements populaires / vedettes à venir
        const popularEvents = await (fastify as any).prisma.event.findMany({
          where: {
            status: 'PUBLISHED',
            isPrivate: false,
            startAt: { gte: now },
          },
          orderBy: [
            { currentAttendees: 'desc' },
            { viewCount: 'desc' },
          ],
          take: 3,
          select: { id: true, title: true, city: true },
        })

        if (popularEvents.length > 0) {
          const topEvent = popularEvents[0]

          // 2. Utilisateurs inactifs depuis > 72h ayant au moins un appareil enregistré
          const inactiveUsers = await (fastify as any).prisma.user.findMany({
            where: {
              isActive: true,
              isBanned: false,
              deletedAt: null,
              deviceTokens: { some: {} },
              OR: [
                { lastSeenAt: { lte: seventyTwoHoursAgo } },
                { lastSeenAt: null },
              ],
            },
            select: { id: true },
            take: 200, // Limite par cycle cron
          })

          if (inactiveUsers.length > 0) {
            // 3. Filtrer ceux qui ont déjà reçu une relance dans les dernières 72h
            const recentReminders = await (fastify as any).prisma.notification.findMany({
              where: {
                type: 'SYSTEM',
                createdAt: { gte: seventyTwoHoursAgo },
              },
              select: { userId: true, data: true },
            })

            const recentlyNotified = new Set(
              recentReminders
                .filter((n: any) => n.data && (n.data as any).subType === 'INACTIVE_REMINDER')
                .map((n: any) => n.userId)
            )

            const targetUsers = inactiveUsers.filter((u: any) => !recentlyNotified.has(u.id))

            if (targetUsers.length > 0) {
              const notifications = targetUsers.map((u: any) => ({
                userId: u.id,
                type: 'SYSTEM',
                title: '🔥 Ça bouge sur Let\'s Out !',
                body: `"${topEvent.title}" fait sensation en ce moment ! Rejoins les autres outsters.`,
                data: {
                  eventId: topEvent.id,
                  screen: 'event-details',
                  subType: 'INACTIVE_REMINDER',
                },
              }))

              const BATCH = 50
              for (let i = 0; i < notifications.length; i += BATCH) {
                await createAndSendNotificationMany(fastify, notifications.slice(i, i + BATCH)).catch(() => {})
              }
              fastify.log.info(`[INACTIVE_CRON] Sent popular event reminder to ${targetUsers.length} inactive users`)
            }
          }
        }
      } catch (inactiveErr: any) {
        fastify.log.warn({ inactiveErr }, '[INACTIVE_CRON] Failed to process inactive user notifications')
      }

      // ── OUT RADAR : Expiration automatique de la visibilité et purge intégrale des coordonnées GPS ──
      try {
        await (fastify as any).prisma.radarVisibility.updateMany({
          where: {
            isVisible: true,
            expiresAt: { lte: now }
          },
          data: {
            isVisible: false,
            latitude: null,
            longitude: null,
            locationUpdatedAt: null
          }
        })

        // Expiration des invitations radar en attente
        await (fastify as any).prisma.radarInvite.updateMany({
          where: {
            status: 'PENDING',
            expiresAt: { lte: now }
          },
          data: {
            status: 'EXPIRED'
          }
        })
      } catch (radarErr: any) {
        fastify.log.warn({ radarErr }, '[OUT_RADAR_CRON] Failed to purge expired radar entries')
      }
    } catch (err: any) {
      fastify.log.error({ err }, 'Error running payout expiration cron:')
    }
  }

  // Initial run after a small delay to let the server start
  setTimeout(runCron, 5000)

  // Interval
  const timer = setInterval(runCron, INTERVAL_MS)

  // ── Paiements FedaPay : rattrapage des commandes payées mais non confirmées ──
  // Boucle dédiée et plus fréquente que le cron général : un acheteur ne doit pas attendre
  // 15 min ses billets si le webhook n'arrive pas. Une seule exécution à la fois.
  const PAYMENT_RECONCILE_MS = 2 * 60 * 1000
  let reconciling = false
  const runPaymentReconcile = async () => {
    if (reconciling) return
    reconciling = true
    try {
      const { reconcilePaymentIntents } = await import('../modules/payments/payments.routes')
      const results = await reconcilePaymentIntents(fastify)
      const processed = results.filter((r) => r.outcome === 'processed')
      if (processed.length) fastify.log.info({ processed }, '[FedaPay] Commandes confirmées par rattrapage')
    } catch (err: any) {
      fastify.log.error({ err }, '[FedaPay] Échec du rattrapage des commandes')
    } finally {
      reconciling = false
    }
  }
  setTimeout(runPaymentReconcile, 15_000)
  const paymentTimer = setInterval(runPaymentReconcile, PAYMENT_RECONCILE_MS)

  fastify.addHook('onClose', (_, done) => {
    clearInterval(timer)
    clearInterval(paymentTimer)
    done()
  })
})
