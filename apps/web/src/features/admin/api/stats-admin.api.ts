import { apiClient } from '@/lib/api-client';

export interface AdminStatsResponse {
  computedAt: string;
  users: {
    total: number;
    dau: number;
    wau: number;
    mau: number;
    newPeriod: number;
    newPreviousPeriod: number;
    deltaPercentage: number;
    retention7d: number;
    retention30d: number;
    kyc: { kycStatus: string; _count: number }[];
    geo: { city: string; country: string; _count: number }[];
  };
  events: {
    total: number;
    byStatus: { status: string; _count: number }[];
    period: number;
    byCategory: { category: string; _count: number }[];
    free: number;
    paid: number;
  };
  payments: {
    volume: number;
    transactions: number;
    activePoolsCount: number;
    openValidatorVotes: number;
    totalIncomingAllTime: number;
    totalCompletedPayouts: number;
    completedPayoutsCount: number;
    totalCommissionsPerceived: number;
  };
  engagement: {
    totalBadges: number;
    messagesPeriod: number;
    pendingReports: number;
    blockedUsers: number;
    avgFriendsPerUser: number;
  };
}

export const fetchAdminStats = async (period: 'today' | '7d' | '30d' | 'all'): Promise<AdminStatsResponse> => {
  let fromDate = new Date();
  
  if (period === 'today') {
    fromDate.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    fromDate.setDate(fromDate.getDate() - 7);
  } else if (period === '30d') {
    fromDate.setDate(fromDate.getDate() - 30);
  } else {
    // Arbitrary long time ago for 'all'
    fromDate = new Date(2020, 0, 1);
  }

  const { data } = await apiClient.get('/admin/stats', {
    params: {
      period,
      from: fromDate.toISOString(),
      to: new Date().toISOString()
    },
    timeout: 60000 // Admin stats are heavy (25+ counts), give them up to 60s
  });

  return data;
};
