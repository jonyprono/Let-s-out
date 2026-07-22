import type { FastifyInstance } from 'fastify';

export default async function adminStatsRoutes(app: FastifyInstance) {
  // Auth is inherited from the parent adminRoutes plugin (authenticate + requireAdmin hooks)

  app.get('/stats', async (req, reply) => {
    const { period: _period, from, to } = req.query as { period?: string; from?: string; to?: string };
    
    // Default to last 30 days if not provided
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Calculate dynamic "active" threshold (e.g. 1 day ago) for retention
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    try {
      const [
        // Users
        totalUsers,
        dau,
        wau,
        mau,
        newUsersPeriod,
        newUsersPreviousPeriod,
        retained7d,
        retained30d,
        kycStats,
        geoStats,
        
        // Events
        totalEvents,
        eventsByStatus,
        eventsPeriod,
        eventsByCategory,
        freeEvents,
        paidEvents,
        
        // Payments & Validations
        totalPaymentVolume,
        transactionsPeriod,
        activePoolsCount,
        openValidatorVotes,
        
        // Engagement
        totalBadges,
        messagesPeriod,
        pendingReports,
        blockedUsers,
        totalFriendships,
      ] = await Promise.all([
        app.prisma.user.count(),
        app.prisma.user.count({ where: { lastSeenAt: { gte: oneDayAgo } } }),
        app.prisma.user.count({ where: { lastSeenAt: { gte: sevenDaysAgo } } }),
        app.prisma.user.count({ where: { lastSeenAt: { gte: thirtyDaysAgo } } }),
        
        // New users in selected period vs previous period (assuming same length)
        app.prisma.user.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        app.prisma.user.count({ where: { createdAt: { gte: new Date(fromDate.getTime() - (toDate.getTime() - fromDate.getTime())), lte: fromDate } } }),
        
        // Retention: users created ~7d/30d ago who have been seen after 24h of creation
        // Approximate this by checking users created before (now - 7d) but seen recently
        app.prisma.user.count({ where: { createdAt: { lte: sevenDaysAgo }, lastSeenAt: { gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) } } }),
        app.prisma.user.count({ where: { createdAt: { lte: thirtyDaysAgo }, lastSeenAt: { gte: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000) } } }),

        app.prisma.profile.groupBy({ by: ['kycStatus'], _count: true }),
        app.prisma.profile.groupBy({ by: ['city', 'country'], _count: true, orderBy: { _count: { city: 'desc' } }, take: 10 }),

        app.prisma.event.count(),
        app.prisma.event.groupBy({ by: ['status'], _count: true }),
        app.prisma.event.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        app.prisma.event.groupBy({ by: ['category'], _count: true }),
        app.prisma.event.count({ where: { price: 0 } }),
        app.prisma.event.count({ where: { price: { gt: 0 } } }),

        app.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'SUCCEEDED', createdAt: { gte: fromDate, lte: toDate } } }),
        app.prisma.payment.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        app.prisma.event.count({ where: { poolCollected: { gt: 0 }, poolReleased: false } }),
        app.prisma.event.count({ where: { validatorVoteStatus: 'OPEN' } }),

        app.prisma.userBadge.count(),
        app.prisma.message.count({ where: { createdAt: { gte: fromDate, lte: toDate }, isDeleted: false } }),
        app.prisma.report.groupBy({ by: ['status'], _count: true }),
        app.prisma.friendship.count({ where: { status: 'BLOCKED' } }),
        app.prisma.friendship.count({ where: { status: 'ACCEPTED' } }),
      ]);

      reply.send({
        computedAt: new Date().toISOString(),
        users: {
          total: totalUsers,
          dau,
          wau,
          mau,
          newPeriod: newUsersPeriod,
          newPreviousPeriod: newUsersPreviousPeriod,
          deltaPercentage: newUsersPreviousPeriod > 0 ? ((newUsersPeriod - newUsersPreviousPeriod) / newUsersPreviousPeriod) * 100 : 0,
          retention7d: totalUsers > 0 ? (retained7d / totalUsers) * 100 : 0, // Simplified for metric
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
          pendingReports: pendingReports.find(r => r.status === 'PENDING')?._count || 0,
          blockedUsers,
          avgFriendsPerUser: totalUsers > 0 ? totalFriendships / totalUsers : 0,
        }
      });
    } catch (err) {
      app.log.error(`[Admin Stats] ${String(err)}`);
      reply.code(500).send({ error: 'Failed to compute admin stats' });
    }
  });
}
