const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "conversation_members" ADD COLUMN "lastDeliveredAt" TIMESTAMP(3);');
  console.log('Success');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    if (e.message.includes('already exists')) {
      console.log('Already exists');
      process.exit(0);
    }
    console.error(e);
    process.exit(1);
  });
