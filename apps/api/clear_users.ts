import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Nettoyage en profondeur des données utilisateur...')
  
  // On supprime d'abord les tables dépendantes pour éviter les erreurs de clés étrangères
  const deleteOps = [
    prisma.messageReaction?.deleteMany({}),
    prisma.message?.deleteMany({}),
    prisma.conversationMember?.deleteMany({}),
    prisma.conversation?.deleteMany({}),
    prisma.notification?.deleteMany({}),
    prisma.payment?.deleteMany({}),
    prisma.walletTransaction?.deleteMany({}),
    prisma.wallet?.deleteMany({}),
    prisma.booking?.deleteMany({}),
    prisma.eventPayoutRequest?.deleteMany({}),
    prisma.event?.deleteMany({}),
    prisma.review?.deleteMany({}),
    prisma.report?.deleteMany({}),
    prisma.friendship?.deleteMany({}),
    prisma.follow?.deleteMany({}),
    prisma.userBadge?.deleteMany({}),
    prisma.refreshToken?.deleteMany({}),
    prisma.deviceToken?.deleteMany({}),
    prisma.otpCode?.deleteMany({}),
    prisma.deletedAccountTracker?.deleteMany({}),
    prisma.profile?.deleteMany({}),
  ].filter(Boolean)

  for (const op of deleteOps) {
    try {
      await op
    } catch (e) {
      // Ignorer si la table n'existe pas
    }
  }

  // Enfin, supprimer tous les utilisateurs (User)
  const result = await prisma.user.deleteMany({})

  console.log(`✅ ${result.count} utilisateurs et toutes leurs données ont été supprimés.`)
  
  const adminCount = await prisma.admin.count()
  console.log(`✅ ${adminCount} administrateurs conservés dans la table Admin.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
