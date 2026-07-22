import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.profile.groupBy({
      by: ['city', 'country'],
      _count: true,
      orderBy: { _count: { city: 'desc' } },
      take: 10
    });
    console.log('OK', res);
  } catch(e) {
    console.error('ERROR', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
