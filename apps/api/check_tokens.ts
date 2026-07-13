import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const tokens = await prisma.deviceToken.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' }
  });
  console.dir(tokens);
}

check().then(() => prisma.$disconnect());
