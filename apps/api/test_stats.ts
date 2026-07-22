import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import adminStatsRoutes from './modules/admin/admin-stats.routes';

const app = Fastify();
const prisma = new PrismaClient();
app.decorate('prisma', prisma);
app.decorate('log', console);

app.register(adminStatsRoutes, { prefix: '/admin' });

async function main() {
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/stats',
    });
    console.log('Status:', res.statusCode);
    if (res.statusCode >= 400) {
      console.error('Body:', res.body);
    } else {
      console.log('Success, body starts with:', res.body.substring(0, 100));
    }
  } catch(e) {
    console.error('ERROR', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
