import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const admins = ['+2290156363337', '+2290154315976']
  for (const phone of admins) {
    await prisma.admin.upsert({
      where: { phone },
      update: {},
      create: { phone, name: 'Admin Principal' }
    })
    console.log(`✅ Admin ${phone} upserted.`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
