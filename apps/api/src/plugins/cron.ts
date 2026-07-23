import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { createAndSendNotificationMany } from '../modules/notifications/notifications.routes'

export default fp(async (fastify: FastifyInstance) => {
  // Check every 15 minutes
  const INTERVAL_MS = 15 * 60 * 1000

  const runCron = async () => {
    try {
      const now = new Date()

      // Find pending or partial payout requests that have expired
      const setting = await (fastify as any).prisma.systemSetting.findUnique({ where: { key: 'PAYOUT_APPROVAL_DEADLINE_HOURS' } });
      const deadlineHours = setting && !isNaN(Number(setting.value)) ? Number(setting.value) : 48;
      
      const expiredRequests = await (fastify as any).prisma.eventPayoutRequest.findMany({
        where: {
          status: { in: ['PENDING', 'PARTIAL'] }
        },
        include: { event: true, approvalsList: { where: { status: 'PENDING' }, include: { user: { include: { profile: true } } } } }
      })

      for (const req of expiredRequests) {
        if (req.approvalsList.length === 0) continue

        await (fastify as any).prisma.$transaction(async (tx: any) => {
          for (const approval of req.approvalsList) {
            // Check if this specific approval has exceeded the deadline since its creation
            const approvalAgeMs = now.getTime() - new Date(approval.createdAt).getTime()
            const deadlineMs = deadlineHours * 60 * 60 * 1000

            if (approvalAgeMs < deadlineMs) {
              continue // Give this specific approval more time (happens when fallback re-delegates)
            }

            // 1. Mark approval as EXPIRED
            await tx.payoutApproval.update({
              where: { id: approval.id },
              data: { status: 'EXPIRED' }
            })

            // 2. Find delegators who were depending on this validator
            const affectedItems = await tx.payoutBookingItem.findMany({
              where: {
                payoutRequestId: req.id,
                delegatedToSnapshot: approval.userId
              },
              include: { booking: true }
            })

            const affectedBookingIds = affectedItems.map((item: any) => item.bookingId)
            if (affectedBookingIds.length > 0) {
              await tx.booking.updateMany({
                where: { id: { in: affectedBookingIds } },
                data: { poolValidationStatus: 'PENDING', delegatedToId: null }
              })
            }

            const affectedUserIds = affectedItems.map((item: any) => item.booking.userId)
            const uniqueUserIds = [...new Set(affectedUserIds)].filter(uid => uid !== req.event.creatorId) as string[]

            const notifications: any[] = []

            if (uniqueUserIds.length > 0) {
              // 3. Notify them to fallback
              uniqueUserIds.forEach((uid: string) => {
                notifications.push({
                  userId: uid,
                  type: 'SYSTEM',
                  title: 'Reprise en main requise',
                  body: `Votre validateur n'a pas répondu à temps pour le déblocage de ${req.amount} F sur ${req.event.title} — choisissez qui doit valider votre part.`,
                  data: { eventId: req.eventId, payoutId: req.id, action: 'FALLBACK_REQUIRED', screen: 'pool-validation' }
                })
              })
            }

            // 4. Notify the validator
            notifications.push({
              userId: approval.userId,
              type: 'SYSTEM',
              title: 'Délai de validation dépassé',
              body: `Vous n'avez pas répondu à temps pour le déblocage de ${req.amount} F sur ${req.event.title}. Vos droits ont été révoqués pour cette demande.`,
              data: { eventId: req.eventId, payoutId: req.id, screen: 'event-details' }
            })

            // 5. Notify the organizer
            if (approval.userId !== req.event.creatorId) {
              const validatorName = approval.user?.profile?.displayName || 'Un validateur'
              notifications.push({
                userId: req.event.creatorId,
                type: 'SYSTEM',
                title: 'Un validateur n\'a pas répondu',
                body: `${validatorName} n'a pas répondu à temps pour le déblocage de ${req.amount} F sur ${req.event.title}. Ses délégataires ont été invités à reprendre la main.`,
                data: { eventId: req.eventId, payoutId: req.id, screen: 'event-details' }
              })
            }

            if (notifications.length > 0) {
              // Note: We don't await this inside the transaction to avoid blocking it for too long, 
              // but createAndSendNotificationMany saves to DB then sends push.
              await createAndSendNotificationMany(fastify, notifications).catch((err: any) => {
                fastify.log.error({ err }, `Failed to send fallback notifications for payout ${req.id}:`)
              })
            }
          }
        })
      }
    } catch (err: any) {
      fastify.log.error({ err }, 'Error running payout expiration cron:')
    }
  }

  // Initial run after a small delay to let the server start
  setTimeout(runCron, 5000)

  // Interval
  const timer = setInterval(runCron, INTERVAL_MS)

  fastify.addHook('onClose', (_, done) => {
    clearInterval(timer)
    done()
  })
})
