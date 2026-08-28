import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const events = await prisma.event.findMany({
  where: { poolTarget: { not: null } },
  select: { id: true, title: true, poolTarget: true, poolMinAmount: true }
})
const bad = events.filter(e => e.poolMinAmount !== null && e.poolTarget !== null && e.poolMinAmount >= e.poolTarget)
console.log('Bad events (poolMinAmount >= poolTarget):')
console.log(JSON.stringify(bad, null, 2))
console.log(`Total: ${bad.length}`)
await prisma.$disconnect()
