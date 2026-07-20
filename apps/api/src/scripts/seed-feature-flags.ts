import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📋 Création des feature flags...')

  await prisma.featureFlag.upsert({
    where: { key: 'profile_pro_banner' },
    update: {},
    create: {
      key: 'profile_pro_banner',
      isActive: false,
      description: "Affiche le bandeau Pass Let's Out PRO sur la page profil",
    },
  })

  await prisma.featureFlag.upsert({
    where: { key: 'event_transport_card' },
    update: {},
    create: {
      key: 'event_transport_card',
      isActive: false,
      description: 'Affiche la carte "S\'y rendre" sur la page détails événement',
    },
  })

  console.log('✅ Feature flags créés avec succès !')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
