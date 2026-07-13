import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.eventPayoutRequest.findFirst({ orderBy: { createdAt: 'desc' } }).then(req => console.dir(req, { depth: null })).finally(() => prisma.$disconnect());
