import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, title: true, createdAt: true, status: true, creatorId: true, coverUrl: true }
  })
  console.log(JSON.stringify(events, null, 2))
}
main().finally(() => prisma.$disconnect())
