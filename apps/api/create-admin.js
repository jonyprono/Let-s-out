const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAdmin() {
  const email = 'admin@letsout.app';
  const existing = await prisma.user.findFirst({ where: { email } });
  
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN' }
      });
      console.log('User role updated to ADMIN');
    } else {
      console.log('Admin user already exists');
    }
    return;
  }

  await prisma.user.create({
    data: {
      email,
      provider: 'EMAIL',
      isVerified: true,
      role: 'ADMIN',
      profile: {
        create: {
          username: 'admin_letsout',
          displayName: 'Administrateur',
          city: 'Paris',
          interests: [],
        }
      },
      wallet: { create: { balance: 0 } }
    }
  });
  console.log('Admin user created successfully');
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
