import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function syncMissedFedaPay() {
  console.log('Fetching recent FedaPay transactions...')
  const secret = process.env.FEDAPAY_SECRET_KEY
  if (!secret) throw new Error('FEDAPAY_SECRET_KEY not set')

  const res = await fetch('https://api.fedapay.com/v1/transactions?limit=100', {
    headers: { Authorization: 'Bearer ' + secret }
  })
  const data = await res.json() as any
  const transactions = data['v1/transactions'] || data.data || data.transactions || []

  let synced = 0
  for (const tx of transactions) {
    if (tx.status !== 'approved') continue

    let meta: any = {}
    try {
      meta = typeof tx.custom_metadata === 'string' ? JSON.parse(tx.custom_metadata) :
             (typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata || tx.custom_metadata))
    } catch (e) {}

    const userId = meta?.userId
    const eventId = meta?.eventId
    if (!userId || !eventId) continue

    const existingBooking = await prisma.booking.findUnique({
      where: { userId_eventId: { userId, eventId } }
    })

    if (!existingBooking) {
      console.log('Syncing missing booking for user ' + userId + ' and event ' + eventId + ', amount: ' + tx.amount)
      const event = await prisma.event.findUnique({ where: { id: eventId } })
      if (!event) continue

      const isPool = !!(event.poolTarget && event.poolTarget > 0)
      
      await prisma.$transaction([
        prisma.booking.create({
          data: { userId, eventId, status: 'CONFIRMED', totalPaid: tx.amount }
        }),
        prisma.event.update({
          where: { id: eventId },
          data: {
            currentAttendees: { increment: 1 },
            ...(isPool ? { poolCollected: { increment: tx.amount } } : {})
          }
        })
      ])
      console.log('Synced successfully!')
      synced++
    }
  }

  console.log('Finished syncing. Synced ' + synced + ' missing transactions.')
}

syncMissedFedaPay().catch(console.error).finally(() => prisma.$disconnect())
