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

  await prisma.featureFlag.upsert({
    where: { key: 'settings_pro_banner' },
    update: {},
    create: {
      key: 'settings_pro_banner',
      isActive: false,
      description: "Affiche le bandeau Pass Let's Out PRO sur la page Paramètres",
    },
  })

  console.log('📋 Création des system settings par défaut...')
  
  await prisma.systemSetting.upsert({
    where: { key: 'PAYOUT_COMMISSION_RATE' },
    update: {},
    create: {
      key: 'PAYOUT_COMMISSION_RATE',
      value: '0.10',
      description: 'Taux de commission de la plateforme sur les cagnottes (ex: 0.10 = 10%)'
    }
  })

  await prisma.systemSetting.upsert({
    where: { key: 'FEDAPAY_WITHDRAWAL_FEE_RATE' },
    update: {},
    create: {
      key: 'FEDAPAY_WITHDRAWAL_FEE_RATE',
      value: '0.02',
      description: 'Frais de retrait Mobile Money (FedaPay) prévus pour le futur (ex: 0.02 = 2%)'
    }
  })

  console.log('✅ Feature flags et System Settings créés avec succès !')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
