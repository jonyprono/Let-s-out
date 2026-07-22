import { PrismaClient } from '@prisma/client';
import fastifyJwt from '@fastify/jwt';
import Fastify from 'fastify';

const prisma = new PrismaClient();

async function main() {
  // Find an admin user
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        role: 'ADMIN',
        email: 'testadmin@letsout.app',
        profile: {
          create: {
            username: 'testadmin',
            displayName: 'Test Admin'
          }
        }
      }
    });
  }

  // Create a fastify instance just to sign the JWT
  const app = Fastify();
  app.register(fastifyJwt, { secret: process.env.JWT_SECRET || 'super-secret-jwt-change-in-prod' });
  await app.ready();

  const token = app.jwt.sign({ sub: adminUser.id, role: adminUser.role });
  
  console.log('Generated token:', token);
  
  // Now hit the API
  try {
    const res = await fetch('http://localhost:3001/api/v1/chat/admin/bots', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('GET /api/v1/chat/admin/bots Status:', res.status, await res.text().catch(()=>''));
  } catch (err: any) {
    console.log('GET /api/v1/chat/admin/bots Failed:', err);
  }
  
  try {
    const res = await fetch('http://localhost:3001/api/v1/chat/admin/bot-conversations', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('GET /api/v1/chat/admin/bot-conversations Status:', res.status, await res.text().catch(()=>''));
  } catch (err: any) {
    console.log('GET /api/v1/chat/admin/bot-conversations Failed:', err);
  }
  
  // Test stats endpoint too
  try {
    const res = await fetch('http://localhost:3001/api/v1/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('GET /api/v1/admin/stats Status:', res.status, await res.text().catch(()=>''));
  } catch (err: any) {
    console.log('GET /api/v1/admin/stats Failed:', err);
  }

  await prisma.$disconnect();
}

main();
