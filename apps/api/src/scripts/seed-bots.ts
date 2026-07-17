import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const bots = [
  {
    id: 'bot_armand',
    name: 'Armand',
    role: 'Support Client',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Armand&backgroundColor=b6e3f4',
    prompt: "Vous êtes Armand, un assistant du support client général pour Let's Out. Vous êtes amical, chaleureux et professionnel. Vous aidez les utilisateurs à naviguer dans l'application, trouver des événements et comprendre les bases. Soyez concis."
  },
  {
    id: 'bot_estelle',
    name: 'Estelle',
    role: 'Support Technique',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Estelle&backgroundColor=ffdfbf',
    prompt: "Vous êtes Estelle, du support technique pour Let's Out. Vous aidez les utilisateurs rencontrant des bugs, des problèmes d'affichage ou d'inscription. Demandez des détails précis pour le diagnostic, soyez claire et méthodique. Soyez concise."
  },
  {
    id: 'bot_brice',
    name: 'Brice',
    role: 'Support Paiements',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Brice&backgroundColor=c0aede',
    prompt: "Vous êtes Brice, expert du support paiements pour Let's Out. Vous traitez les questions de retraits, remboursements, frais et facturation. Vous êtes très professionnel, rassurant et rigoureux. Ne promettez jamais un remboursement direct, expliquez le processus. Soyez concis."
  },
  {
    id: 'bot_aicha',
    name: 'Aïcha',
    role: 'Support Général',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aicha&backgroundColor=ffb8b8',
    prompt: "Vous êtes Aïcha, agent de support général pour Let's Out. Vous êtes dynamique et toujours de bonne humeur. Vous répondez aux questions générales, aux réclamations modérées, et orientez les utilisateurs vers les bonnes pratiques de la plateforme. Soyez concise."
  }
];

async function seedBots() {
  console.log('Seeding bots...');
  
  for (const bot of bots) {
    const existingBot = await prisma.user.findUnique({ where: { id: bot.id } });
    
    if (!existingBot) {
      await prisma.user.create({
        data: {
          id: bot.id,
          phone: `+000${bot.name}`, // unique fake phone
          isBot: true,
          botPrompt: bot.prompt,
          profile: {
            create: {
              username: `bot_${bot.name.toLowerCase()}`,
              displayName: bot.name,
              avatarUrl: bot.avatarUrl,
              bio: bot.role
            }
          }
        }
      });
      console.log(`Created bot: ${bot.name}`);
    } else {
      await prisma.user.update({
        where: { id: bot.id },
        data: {
          botPrompt: bot.prompt,
          isBot: true,
        }
      });
      await prisma.profile.update({
        where: { userId: bot.id },
        data: {
          avatarUrl: bot.avatarUrl,
          bio: bot.role,
          displayName: bot.name
        }
      });
      console.log(`Updated bot: ${bot.name}`);
    }
  }
  
  console.log('Bot seeding completed.');
}

seedBots()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
