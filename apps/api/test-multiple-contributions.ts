import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { calculateAvailablePoolAmount } from './src/modules/payments/pool.service'

const prisma = new PrismaClient()

// Mock fastify app
const app = {
  prisma
} as unknown as FastifyInstance

async function runTest() {
  console.log('--- TEST: MULTIPLE CONTRIBUTIONS ---')
  
  // 1. Create event
  const user = await prisma.user.findFirst()
  if (!user) throw new Error('No user found')
    
  const event = await prisma.event.create({
    data: {
      creatorId: user.id,
      title: 'Test Refund Multiple Contributions',
      description: 'Test',
      address: 'Test',
      city: 'Paris',
      latitude: 48.8,
      longitude: 2.3,
      isPrivate: false,
      status: 'COMPLETED',
      poolTarget: 10000,
      category: 'OTHER',
      startAt: new Date(),
      endAt: new Date(),
      price: 10000,
    }
  })
  
  // 2. Create Booking
  const participant = await prisma.user.findFirst({ where: { id: { not: user.id } } })
  if (!participant) throw new Error('No participant found')

  const booking = await prisma.booking.create({
    data: {
      userId: participant.id,
      eventId: event.id,
      status: 'CONFIRMED',
      totalPaid: 10000, // 3 contributions of 5000 + 3000 + 2000
    }
  })
  
  // 3. Create payments to simulate the 3 contributions
  await prisma.payment.createMany({
    data: [
      { userId: participant.id, bookingId: booking.id, amount: 5000, status: 'SUCCEEDED' },
      { userId: participant.id, bookingId: booking.id, amount: 3000, status: 'SUCCEEDED' },
      { userId: participant.id, bookingId: booking.id, amount: 2000, status: 'SUCCEEDED' },
    ]
  })
  
  // 4. Test calculateAvailablePoolAmount BEFORE any payout
  let stats = await calculateAvailablePoolAmount(app, event.id)
  let pStats = stats.breakdowns.find(b => b.userId === participant.id)
  console.log('Total Paid:', booking.totalPaid, 'Remaining Amount:', pStats?.remainingAmount)
  if (pStats?.remainingAmount !== 10000) {
    throw new Error('Test failed! Expected 10000')
  }

  // 5. Organizer requests partial payout (e.g. 4000)
  const req = await prisma.payoutRequest.create({
    data: {
      eventId: event.id,
      organizerId: user.id,
      amount: 4000,
      status: 'PENDING',
    }
  })
  await prisma.payoutBookingItem.create({
    data: {
      payoutRequestId: req.id,
      bookingId: booking.id,
      amountDeducted: 4000,
    }
  })

  // 6. Test calculateAvailablePoolAmount AFTER pending payout
  stats = await calculateAvailablePoolAmount(app, event.id)
  pStats = stats.breakdowns.find(b => b.userId === participant.id)
  console.log('Total Paid:', booking.totalPaid, 'Remaining Amount:', pStats?.remainingAmount)
  if (pStats?.remainingAmount !== 6000) {
    throw new Error('Test failed! Expected 6000')
  }

  console.log('SUCCESS! The calculateAvailablePoolAmount aggregates properly.')

  // Cleanup
  await prisma.payoutBookingItem.deleteMany({ where: { payoutRequestId: req.id } })
  await prisma.payoutRequest.delete({ where: { id: req.id } })
  await prisma.payment.deleteMany({ where: { bookingId: booking.id } })
  await prisma.booking.delete({ where: { id: booking.id } })
  await prisma.event.delete({ where: { id: event.id } })
}

runTest().catch(console.error).finally(() => prisma.$disconnect())
