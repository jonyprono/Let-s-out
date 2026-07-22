import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const toDate = now;
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const results = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { lastSeenAt: { gte: oneDayAgo } } }),
        prisma.user.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
        prisma.user.count({ where: { lastSeenAt: { gte: thirtyDaysAgo } } }),
        
        prisma.user.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.user.count({ where: { createdAt: { gte: new Date(fromDate.getTime() - (toDate.getTime() - fromDate.getTime())), lte: fromDate } } }),
        
        prisma.user.count({ where: { createdAt: { lte: sevenDaysAgo }, lastSeenAt: { gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } } }),
        prisma.user.count({ where: { createdAt: { lte: thirtyDaysAgo }, lastSeenAt: { gte: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) } } }),

        prisma.profile.groupBy({ by: ['kycStatus'], _count: true }),
        prisma.profile.groupBy({ by: ['city', 'country'], _count: true, orderBy: { _count: { city: 'desc' } }, take: 10 }),

        prisma.event.count(),
        prisma.event.groupBy({ by: ['status'], _count: true }),
        prisma.event.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.event.groupBy({ by: ['category'], _count: true }),
        prisma.event.count({ where: { price: 0 } }),
        prisma.event.count({ where: { price: { gt: 0 } } }),

        prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'SUCCEEDED', createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.payment.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.event.count({ where: { poolCollected: { gt: 0 }, poolReleased: false } }),
        prisma.event.count({ where: { validatorVoteStatus: 'OPEN' } }),

        prisma.userBadge.count(),
        prisma.message.count({ where: { createdAt: { gte: fromDate, lte: toDate }, isDeleted: false } }),
        prisma.report.groupBy({ by: ['status'], _count: true }),
        prisma.friendship.count({ where: { status: 'BLOCKED' } }),
        prisma.friendship.count({ where: { status: 'ACCEPTED' } }),
      ]);
      console.log('Success', results);
  } catch (e) {
      console.error('Error in query', e);
  } finally {
      await prisma.$disconnect();
  }
}

main();
