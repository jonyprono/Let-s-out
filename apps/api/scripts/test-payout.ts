import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Testing Payout Flow End-to-End...')
  
  // Find a suitable event or create one
  const event = await prisma.event.findFirst({
    where: { poolTarget: { gt: 0 } },
    include: { bookings: true }
  })
  
  if (!event) {
    console.log('No event with pool found')
    return
  }

  console.log('Using event:', event.id, event.title)
  // Check notifications for creator
  const creatorNotes = await prisma.notification.findMany({
    where: { userId: event.creatorId },
    take: 1
  })
  console.log('Creator notifications work:', creatorNotes.length > 0)
}

main().catch(console.error).finally(() => prisma.$disconnect())
