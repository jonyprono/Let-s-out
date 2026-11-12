import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Each admin's initial password is read from its own env var — never hardcoded.
// Usage: ADMIN_PASSWORD_2290156363337=... ADMIN_PASSWORD_2290154315976=... pnpm --filter @letsout/api seed:admins
const admins = ['+2290156363337', '+2290154315976']

function envKeyFor(phone: string) {
  return `ADMIN_PASSWORD_${phone.replace(/[^0-9A-Za-z]/g, '')}`
}

async function main() {
  for (const phone of admins) {
    const password = process.env[envKeyFor(phone)]
    const existing = await prisma.admin.findUnique({ where: { phone } })

    if (existing) {
      if (password && !existing.passwordHash) {
        const passwordHash = await bcrypt.hash(password, 10)
        await prisma.admin.update({ where: { phone }, data: { passwordHash } })
        console.log(`✅ Admin ${phone}: mot de passe initialisé.`)
      } else {
        console.log(`ℹ️  Admin ${phone} déjà présent (inchangé).`)
      }
      continue
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : undefined
    await prisma.admin.create({
      data: { phone, name: 'Admin Principal', passwordHash },
    })
    console.log(
      password
        ? `✅ Admin ${phone} créé avec mot de passe.`
        : `✅ Admin ${phone} créé SANS mot de passe — définissez ${envKeyFor(phone)} et relancez ce script pour l'activer.`
    )
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
