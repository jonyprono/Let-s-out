import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export default async function adminListsRoutes(app: FastifyInstance) {
  // ── Users List ────────────────────────────────────────────────────────
  app.get('/users', async (req, reply) => {
    const query = z.object({
      search: z.string().optional(),
      kycStatus: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      sort: z.enum(['newest', 'oldest', 'lastActive']).default('newest'),
    }).parse(req.query);

    const where: any = {};
    if (query.kycStatus) {
      where.profile = { kycStatus: query.kycStatus };
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { profile: { displayName: { contains: q, mode: 'insensitive' } } },
        { profile: { username: { contains: q, mode: 'insensitive' } } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (query.sort === 'oldest') orderBy = { createdAt: 'asc' };
    else if (query.sort === 'lastActive') orderBy = { lastSeenAt: 'desc' };

    const [total, rows] = await Promise.all([
      app.prisma.user.count({ where }),
      app.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          profile: { select: { displayName: true, username: true, avatarUrl: true, kycStatus: true } },
        },
      }),
    ]);

    return reply.send({
      data: rows,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit) || 1,
    });
  });

  // ── Events List ────────────────────────────────────────────────────────
  app.get('/events', async (req, reply) => {
    const query = z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { joinCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      app.prisma.event.count({ where }),
      app.prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          creator: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        },
      }),
    ]);

    return reply.send({
      data: rows,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit) || 1,
    });
  });

  // ── Active Pools ────────────────────────────────────────────────────────
  app.get('/pools/active', async (_req, reply) => {
    const events = await app.prisma.event.findMany({
      where: { poolCollected: { gt: 0 }, poolReleased: false },
      orderBy: { poolCollected: 'desc' },
      take: 50,
      include: {
        creator: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
      }
    });
    return reply.send({ data: events });
  });

  // ── Active Validator Votes ───────────────────────────────────────────────
  app.get('/votes/active', async (_req, reply) => {
    const events = await app.prisma.event.findMany({
      where: { validatorVoteStatus: 'OPEN' },
      orderBy: { startAt: 'desc' },
      take: 50,
      include: {
        creator: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        validatorVotes: true,
      }
    });
    return reply.send({ data: events });
  });

  // ── Pending Reports ──────────────────────────────────────────────────────
  app.get('/reports', async (req, reply) => {
    const query = z.object({
      status: z.string().default('PENDING'),
    }).parse(req.query);

    const reports = await app.prisma.report.findMany({
      where: { status: query.status as any },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        reported: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
      }
    });
    return reply.send({ data: reports });
  });

  // ── Blocked Users ────────────────────────────────────────────────────────
  app.get('/blocks', async (_req, reply) => {
    const blocks = await app.prisma.friendship.findMany({
      where: { status: 'BLOCKED' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        initiator: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        receiver: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
      }
    });
    return reply.send({ data: blocks });
  });

  // ── System Settings (Commission) ────────────────────────────────────────
  app.get('/settings/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const setting = await app.prisma.systemSetting.findUnique({
      where: { key }
    });
    return reply.send({ data: setting });
  });

  app.put('/settings/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    const { value, description } = z.object({
      value: z.string(),
      description: z.string().optional()
    }).parse(req.body);

    const setting = await app.prisma.systemSetting.upsert({
      where: { key },
      update: { value, ...(description ? { description } : {}) },
      create: { key, value, description },
    });
    
    return reply.send({ data: setting });
  });
}
