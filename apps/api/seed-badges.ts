import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const defaultBadges = [
    {
      name: 'Early Adopter',
      description: 'Récompense les pionniers qui ont rejoint Let\'s Out lors du lancement.',
      icon: '🚀',
      category: 'legendary',
      xpReward: 500,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'accountAgeDays', operator: 'GTE', value: 0 }]
      }
    },
    {
      name: 'Social Star',
      description: 'Décerné aux membres avec une grande vie sociale sur la plateforme.',
      icon: '⭐',
      category: 'rare',
      xpReward: 200,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'friendsCount', operator: 'GTE', value: 10 }]
      }
    },
    {
      name: 'Party Maker',
      description: 'Pour les organisateurs dont la cagnotte atteint au moins 90% de son objectif.',
      icon: '🎉',
      category: 'rare',
      xpReward: 300,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'eventsCreated', operator: 'GTE', value: 1 }] // Mock rule since logic is complex
      }
    },
    {
      name: 'Top Donateur',
      description: 'Récompense la générosité envers la communauté.',
      icon: '🎁',
      category: 'standard',
      xpReward: 150,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'eventsJoined', operator: 'GTE', value: 5 }] // Mock rule
      }
    },
    {
      name: 'Top Organisateur',
      description: 'Décerné aux créateurs d\'événements les plus réussis.',
      icon: '🎖️',
      category: 'legendary',
      xpReward: 500,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [
          { field: 'eventsCreated', operator: 'GTE', value: 5 },
          { field: 'rating', operator: 'GTE', value: 4.5 }
        ]
      }
    },
    {
      name: 'Ponctuel',
      description: 'Toujours à l\'heure, toujours présent.',
      icon: '⏰',
      category: 'standard',
      xpReward: 100,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'rating', operator: 'GTE', value: 4.5 }]
      }
    },
    {
      name: 'Fiable',
      description: 'La communauté peut compter sur vous.',
      icon: '🤝',
      category: 'rare',
      xpReward: 200,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'validationsPerformed', operator: 'GTE', value: 5 }]
      }
    },
    {
      name: 'Accueillant',
      description: 'Votre accueil fait la différence.',
      icon: '🤗',
      category: 'standard',
      xpReward: 100,
      isActive: true,
      conditionsLogic: {
        type: 'AND',
        rules: [{ field: 'eventsCreated', operator: 'GTE', value: 3 }]
      }
    }
  ]

  console.log('Seeding default badges...')
  
  for (const badge of defaultBadges) {
    const existing = await prisma.badge.findFirst({ where: { name: badge.name } })
    if (!existing) {
      await prisma.badge.create({ data: badge })
      console.log(`Created badge: ${badge.name}`)
    } else {
      await prisma.badge.update({ where: { id: existing.id }, data: badge })
      console.log(`Updated badge: ${badge.name}`)
    }
  }

  console.log('Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
