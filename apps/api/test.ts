import { PrismaClient } from '@prisma/client';
const app = { prisma: new PrismaClient() };
async function run() {
  try {
    const toDate = new Date();
    const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const previousFromDate = new Date(fromDate.getTime() - (toDate.getTime() - fromDate.getTime()));
    const previousToDate = fromDate;

    const [totalUsers, dau, wau, mau, newUsersPeriod, newUsersPreviousPeriod, retained7d, retained30d] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.user.count({ where: { lastSeenAt: { gte: oneDayAgo } } }),
      app.prisma.user.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
      app.prisma.user.count({ where: { lastSeenAt: { gte: thirtyDaysAgo } } }),
      app.prisma.user.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
      app.prisma.user.count({ where: { createdAt: { gte: previousFromDate, lte: previousToDate } } }),
      app.prisma.user.count({ where: { createdAt: { lte: sevenDaysAgo }, lastSeenAt: { gte: sevenDaysAgo } } }),
      app.prisma.user.count({ where: { createdAt: { lte: thirtyDaysAgo }, lastSeenAt: { gte: thirtyDaysAgo } } }),
    ]);

    const [kycStats, geoStats, totalEvents, eventsByStatus, eventsPeriod, eventsByCategory] = await Promise.all([
      app.prisma.profile.groupBy({ by: ['kycStatus'], _count: true }),
      app.prisma.profile.groupBy({ by: ['city'], _count: true, orderBy: { _count: { city: 'desc' } }, take: 5 }),
      app.prisma.event.count(),
      app.prisma.event.groupBy({ by: ['status'], _count: true }),
      app.prisma.event.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
      app.prisma.event.groupBy({ by: ['category'], _count: true }),
    ]);

    const [freeEvents, paidEvents, totalPaymentVolume, transactionsPeriod, activePoolsCount] = await Promise.all([
      app.prisma.event.count({ where: { price: 0 } }),
      app.prisma.event.count({ where: { price: { gt: 0 } } }),
      app.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'SUCCEEDED', createdAt: { gte: fromDate, lte: toDate } } }),
      app.prisma.payment.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
      app.prisma.event.count({ where: { poolCollected: { gt: 0 }, poolReleased: false } }),
    ]);

    const [openValidatorVotes, totalBadges, messagesPeriod, pendingReports, totalFriendships, blockedUsers] = await Promise.all([
      app.prisma.event.count({ where: { validatorVoteStatus: 'OPEN' } }),
      app.prisma.userBadge.count(),
      app.prisma.message.count({ where: { createdAt: { gte: fromDate, lte: toDate }, isDeleted: false } }),
      app.prisma.report.groupBy({ by: ['status'], _count: true }),
      app.prisma.friendship.count({ where: { status: 'ACCEPTED' } }),
      app.prisma.friendship.count({ where: { status: 'BLOCKED' } }),
    ]);

    const payload = {
      computedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        dau,
        wau,
        mau,
        newPeriod: newUsersPeriod,
        newPreviousPeriod: newUsersPreviousPeriod,
        deltaPercentage: newUsersPreviousPeriod > 0 ? ((newUsersPeriod - newUsersPreviousPeriod) / newUsersPreviousPeriod) * 100 : 0,
        retention7d: totalUsers > 0 ? (retained7d / totalUsers) * 100 : 0,
        retention30d: totalUsers > 0 ? (retained30d / totalUsers) * 100 : 0,
        kyc: kycStats,
        geo: geoStats.filter(g => g.city !== null),
      },
      events: {
        total: totalEvents,
        byStatus: eventsByStatus,
        period: eventsPeriod,
        byCategory: eventsByCategory,
        free: freeEvents,
        paid: paidEvents,
      },
      payments: {
        volume: totalPaymentVolume._sum.amount || 0,
        transactions: transactionsPeriod,
        activePoolsCount,
        openValidatorVotes,
      },
      engagement: {
        totalBadges,
        messagesPeriod,
        pendingReports: pendingReports.find((r: any) => r.status === 'PENDING')?._count || 0,
        blockedUsers,
        avgFriendsPerUser: totalUsers > 0 ? totalFriendships / totalUsers : 0,
      }
    };
    
    console.log("PAYLOAD JSON:");
    console.log(JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error("ERROR GENERATING PAYLOAD:", e);
  } finally {
    await app.prisma.$disconnect();
  }
}
run();
