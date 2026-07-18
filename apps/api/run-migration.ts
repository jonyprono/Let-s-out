import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL?.replace(':5432/', ':6543/')
const prisma = new PrismaClient({ datasources: { db: { url } } })

async function main() {
  try {
    const statements = [
      `INSERT INTO "users" ("id", "email", "phone", "role", "isVerified", "isActive", "provider", "createdAt", "updatedAt")
       VALUES ('SYSTEM_PLATFORM', 'system@letsout.app', '+00000000000', 'ADMIN', true, true, 'PHONE', NOW(), NOW())
       ON CONFLICT ("id") DO NOTHING;`,
       
      `INSERT INTO "wallets" ("id", "userId", "balance", "currency", "createdAt", "updatedAt")
       VALUES ('system_platform_wallet', 'SYSTEM_PLATFORM', 0, 'XOF', NOW(), NOW())
       ON CONFLICT ("userId") DO NOTHING;`
    ]

    console.log("Executing system wallet creation...")
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt)
      console.log("Executed:", stmt.substring(0, 50) + "...")
    }
    console.log("System wallet created!")
  } catch (err) {
    console.error("Migration failed:", err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
