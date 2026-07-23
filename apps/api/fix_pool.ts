import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.updateMany({
    where: {
      poolClosedAt: { not: null }
    },
    data: {
      poolClosedAt: null
    }
  });
  console.log(`Updated ${events.count} events to clear poolClosedAt`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
