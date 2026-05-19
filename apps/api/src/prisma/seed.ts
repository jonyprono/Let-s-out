import { PrismaClient, EventCategory, EventStatus, UserRole, AuthProvider, NotifType, MessageType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // 1. Create Users & Profiles
  const usersData = [
    {
      phone: '+33611111111',
      username: 'johndoe',
      displayName: 'John Doe',
      city: 'Paris',
      bio: 'Fan de sorties sportives et culturelles. Toujours partant !',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=face',
      role: UserRole.USER,
    },
    {
      phone: '+33622222222',
      username: 'janedoe',
      displayName: 'Jane Doe',
      city: 'Lyon',
      bio: 'Art lover et foodie. Je cherche toujours le prochain bon resto.',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
      role: UserRole.USER,
    },
    {
      phone: '+33633333333',
      username: 'alice_smith',
      displayName: 'Alice Smith',
      city: 'Marseille',
      bio: 'Organisatrice d\'événements passionnée. Always down for a party!',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
      role: UserRole.ORGANIZER,
    },
    {
      phone: '+33644444444',
      username: 'marc_leblanc',
      displayName: 'Marc Leblanc',
      city: 'Paris',
      bio: 'Développeur le jour, DJ la nuit.',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
      role: UserRole.USER,
    },
    {
      phone: '+33655555555',
      username: 'sophie_m',
      displayName: 'Sophie Martin',
      city: 'Paris',
      bio: 'Runner du dimanche et bruncheur professionnel.',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
      role: UserRole.USER,
    },
    {
      email: 'admin@letsout.app',
      username: 'admin',
      displayName: 'Admin LetsOut',
      city: 'Paris',
      bio: 'Administrator',
      role: UserRole.ADMIN,
    }
  ]

  const users: any[] = []

  for (const u of usersData) {
    const existing = await prisma.user.findFirst({
      where: u.phone ? { phone: u.phone } : { email: u.email }
    })

    if (!existing) {
      const user = await prisma.user.create({
        data: {
          phone: u.phone,
          email: u.email,
          provider: u.phone ? AuthProvider.PHONE : AuthProvider.EMAIL,
          isVerified: true,
          role: u.role,
          profile: {
            create: {
              username: u.username,
              displayName: u.displayName,
              city: u.city,
              bio: u.bio,
              avatarUrl: (u as any).avatarUrl,
              interests: ['Sorties', 'Sport', 'Musique'],
            }
          },
          wallet: { create: { balance: 1000 } }
        }
      })
      console.log(`✅ Created user: ${u.username}`)
      users.push(user)
    } else {
      console.log(`ℹ️ User already exists: ${u.username}`)
      users.push(existing)
    }
  }

  // 2. Create Events
  const organizerId = users.find(u => u.role === UserRole.ORGANIZER)?.id || users[0].id
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000

  const eventsData = [
    {
      title: 'Foot 5v5 Urban',
      description: 'Match de foot à 5 dans la salle flambant neuve d\'Urban Soccer. Niveau intermédiaire, viens avec tes crampons !',
      category: EventCategory.SPORT,
      status: EventStatus.PUBLISHED,
      price: 10,
      city: 'Paris',
      address: 'Urban Soccer, Porte d\'Aubervilliers',
      maxAttendees: 10,
      coverUrl: 'https://images.unsplash.com/photo-1546519638405-a9f48b0f51af?w=800&h=400&fit=crop',
      startAt: new Date(now + 2 * day),
      endAt: new Date(now + 2 * day + 2 * hour),
      tags: ['foot', 'sport', 'indoor'],
    },
    {
      title: 'Soirée Techno — Rex Club',
      description: 'Une nuit inoubliable au Rex Club avec les meilleurs DJs de la scène techno parisienne.',
      category: EventCategory.NIGHTLIFE,
      status: EventStatus.PUBLISHED,
      price: 25,
      city: 'Paris',
      address: 'Rex Club, Paris',
      maxAttendees: 200,
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=400&fit=crop',
      startAt: new Date(now + 5 * day),
      endAt: new Date(now + 5 * day + 6 * hour),
      tags: ['techno', 'nightlife', 'dj'],
    },
    {
      title: 'Exposition Art Moderne — Pompidou',
      description: 'Visite guidée groupée au Centre Pompidou. Découvrez les œuvres contemporaines avec un expert de l\'art moderne.',
      category: EventCategory.CULTURE,
      status: EventStatus.PUBLISHED,
      price: 15,
      city: 'Paris',
      address: 'Centre Pompidou, Paris 4ème',
      maxAttendees: 15,
      coverUrl: 'https://images.unsplash.com/photo-1533158388-350df61f1f2a?w=800&h=400&fit=crop',
      startAt: new Date(now + 7 * day),
      endAt: new Date(now + 7 * day + 3 * hour),
      tags: ['art', 'culture', 'musée'],
    },
    {
      title: 'Brunch du dimanche — Marais',
      description: 'Un brunch convivial dans un café tendance du Marais. Au programme : bons œufs bénédicte, mimosas et bonne humeur.',
      category: EventCategory.FOOD,
      status: EventStatus.PUBLISHED,
      price: 28,
      city: 'Paris',
      address: 'Café Pinson, Paris 3ème',
      maxAttendees: 12,
      coverUrl: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800&h=400&fit=crop',
      startAt: new Date(now + 3 * day),
      endAt: new Date(now + 3 * day + 2 * hour),
      tags: ['brunch', 'food', 'weekend'],
    },
    {
      title: 'Concert Jazz — Sunset Sunside',
      description: 'Une soirée Jazz intime au mythique Sunset Sunside. Avec le quartet de Lucas Bernard.',
      category: EventCategory.MUSIC,
      status: EventStatus.PUBLISHED,
      price: 18,
      city: 'Paris',
      address: 'Sunset Sunside, Paris 1er',
      maxAttendees: 60,
      coverUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&h=400&fit=crop',
      startAt: new Date(now + 4 * day),
      endAt: new Date(now + 4 * day + 3 * hour),
      tags: ['jazz', 'musique', 'live'],
    },
    {
      title: 'Running au Parc Monceau',
      description: 'Course matinale de 8km autour du Parc Monceau. Pour tous niveaux. Rendez-vous à l\'entrée principale.',
      category: EventCategory.SPORT,
      status: EventStatus.PUBLISHED,
      price: 0,
      city: 'Paris',
      address: 'Parc Monceau, Paris 8ème',
      maxAttendees: 30,
      coverUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=400&fit=crop',
      startAt: new Date(now + 1 * day),
      endAt: new Date(now + 1 * day + 90 * 60 * 1000),
      tags: ['running', 'sport', 'gratuit'],
    },
    {
      title: 'Atelier Cuisine Japonaise',
      description: 'Apprenez à faire vos propres sushis et ramens avec un chef étoilé. Tablier fourni, repas inclus !',
      category: EventCategory.FOOD,
      status: EventStatus.PUBLISHED,
      price: 55,
      city: 'Paris',
      address: 'L\'Atelier des Sens, Paris 11ème',
      maxAttendees: 8,
      coverUrl: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&h=400&fit=crop',
      startAt: new Date(now + 6 * day),
      endAt: new Date(now + 6 * day + 3 * hour),
      tags: ['cuisine', 'japonais', 'atelier'],
    },
    {
      title: 'Yoga & Méditation — Palais Royal',
      description: 'Séance de yoga en plein air dans les jardins du Palais Royal. Tapis fournis, eau et fruits offerts.',
      category: EventCategory.WELLNESS,
      status: EventStatus.PUBLISHED,
      price: 12,
      city: 'Paris',
      address: 'Jardins du Palais Royal, Paris 1er',
      maxAttendees: 20,
      coverUrl: 'https://images.unsplash.com/photo-1545389336-cf090694435e?w=800&h=400&fit=crop',
      startAt: new Date(now + 2 * day + 8 * hour),
      endAt: new Date(now + 2 * day + 10 * hour),
      tags: ['yoga', 'wellness', 'plein-air'],
    },
  ]

  const createdEvents: any[] = []

  for (const e of eventsData) {
    const existing = await prisma.event.findFirst({
      where: { title: e.title }
    })

    if (!existing) {
      const event = await prisma.event.create({
        data: {
          ...e,
          creatorId: organizerId,
        }
      })
      console.log(`✅ Created event: ${e.title}`)
      createdEvents.push(event)
    } else {
      console.log(`ℹ️ Event already exists: ${e.title}`)
      createdEvents.push(existing)
    }
  }

  // 3. Create Bookings (link users to events)
  const john = users[0]
  const jane = users[1]
  const marc = users[3]
  const sophie = users[4]

  const bookingsData = [
    { userId: john?.id, eventId: createdEvents[0]?.id }, // John → Foot
    { userId: john?.id, eventId: createdEvents[4]?.id }, // John → Concert Jazz
    { userId: jane?.id, eventId: createdEvents[2]?.id }, // Jane → Expo Art
    { userId: jane?.id, eventId: createdEvents[3]?.id }, // Jane → Brunch
    { userId: marc?.id, eventId: createdEvents[1]?.id }, // Marc → Soirée Techno
    { userId: sophie?.id, eventId: createdEvents[5]?.id }, // Sophie → Running
    { userId: sophie?.id, eventId: createdEvents[3]?.id }, // Sophie → Brunch
  ]

  for (const b of bookingsData) {
    if (!b.userId || !b.eventId) continue
    const existing = await prisma.booking.findUnique({
      where: { userId_eventId: { userId: b.userId, eventId: b.eventId } }
    })
    if (!existing) {
      await prisma.booking.create({
        data: { userId: b.userId, eventId: b.eventId, status: 'CONFIRMED' }
      })
      console.log(`✅ Created booking`)
    }
  }

  // 4. Create Conversations & Messages
  const conversationsData = [
    {
      name: 'Groupe Foot 5v5 🥅',
      isGroup: true,
      avatarUrl: 'https://images.unsplash.com/photo-1546519638405-a9f48b0f51af?w=100&h=100&fit=crop',
      memberIds: [john?.id, marc?.id, organizerId].filter(Boolean),
      messages: [
        { senderId: organizerId, content: 'Salut tout le monde ! Prêts pour samedi ? 💪' },
        { senderId: john?.id, content: 'Oui ! J\'amène mes crampons 🦶' },
        { senderId: marc?.id, content: 'Je serai là, à quelle heure exactement ?' },
        { senderId: organizerId, content: 'On se retrouve à 14h à l\'entrée !' },
        { senderId: john?.id, content: 'Super, j\'ai hâte !' },
      ]
    },
    {
      name: null, // Direct message: John ↔ Jane
      isGroup: false,
      avatarUrl: null,
      memberIds: [john?.id, jane?.id].filter(Boolean),
      messages: [
        { senderId: jane?.id, content: 'Hey ! T\'as vu le brunch de dimanche ?' },
        { senderId: john?.id, content: 'Oui ! Sophie m\'en a parlé, tu y vas ?' },
        { senderId: jane?.id, content: 'Oui je me suis inscrite 😊 on peut y aller ensemble !' },
        { senderId: john?.id, content: 'Deal ! On se retrouve devant le café à 11h ?' },
        { senderId: jane?.id, content: 'Parfait ! À dimanche alors 🥂' },
      ]
    },
    {
      name: 'Jazz & Co 🎷',
      isGroup: true,
      avatarUrl: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=100&h=100&fit=crop',
      memberIds: [john?.id, sophie?.id, organizerId].filter(Boolean),
      messages: [
        { senderId: sophie?.id, content: 'Quelqu\'un pour le concert jazz vendredi ?' },
        { senderId: john?.id, content: 'Je suis partant ! 🎶' },
        { senderId: organizerId, content: 'Moi aussi, j\'adore le Sunset Sunside !' },
        { senderId: sophie?.id, content: 'Super ! Je réserve 3 places alors.' },
      ]
    },
  ]

  for (const c of conversationsData) {
    // Check if conversation already exists (by name for groups, or by members for directs)
    let conversation: any = null

    if (c.isGroup && c.name) {
      conversation = await prisma.conversation.findFirst({ where: { name: c.name } })
    } else if (!c.isGroup && c.memberIds.length === 2) {
      // For direct, check if both users are already in a non-group conversation together
      const existing = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          members: {
            every: { userId: { in: c.memberIds } }
          }
        },
        include: { members: true }
      })
      if (existing && existing.members.length === 2) {
        conversation = existing
      }
    }

    if (!conversation) {
      const lastMsgTime = new Date(Date.now() - Math.floor(Math.random() * 60) * 60 * 1000)
      conversation = await prisma.conversation.create({
        data: {
          name: c.name,
          isGroup: c.isGroup,
          avatarUrl: c.avatarUrl,
          lastMessageAt: lastMsgTime,
          members: {
            create: c.memberIds.map((userId, idx) => ({
              userId,
              isAdmin: idx === 0,
            }))
          }
        }
      })
      console.log(`✅ Created conversation: ${c.name || 'Direct'}`)

      // Create messages
      let msgTime = new Date(Date.now() - c.messages.length * 5 * 60 * 1000)
      for (const msg of c.messages) {
        if (!msg.senderId) continue
        msgTime = new Date(msgTime.getTime() + 5 * 60 * 1000)
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: msg.senderId,
            type: MessageType.TEXT,
            content: msg.content,
            createdAt: msgTime,
          }
        })
      }
    } else {
      console.log(`ℹ️ Conversation already exists: ${c.name || 'Direct'}`)
    }
  }

  // 5. Create Notifications for John
  if (john?.id) {
    const existingNotif = await prisma.notification.findFirst({ where: { userId: john.id } })
    if (!existingNotif) {
      const notifsData = [
        {
          type: NotifType.EVENT_INVITE,
          title: 'Invitation à un événement',
          body: 'Alice vous invite à rejoindre "Soirée Techno — Rex Club"',
        },
        {
          type: NotifType.NEW_MESSAGE,
          title: 'Nouveau message',
          body: 'Jane Doe: "Hey ! T\'as vu le brunch de dimanche ?"',
        },
        {
          type: NotifType.JOIN_ACCEPTED,
          title: 'Demande acceptée',
          body: 'Votre demande pour "Foot 5v5 Urban" a été acceptée ✅',
        },
        {
          type: NotifType.FRIEND_REQUEST,
          title: 'Nouvelle demande d\'ami',
          body: 'Marc Leblanc souhaite vous ajouter en ami',
        },
      ]

      for (const n of notifsData) {
        await prisma.notification.create({
          data: { userId: john.id, ...n }
        })
      }
      console.log(`✅ Created notifications for ${john.id}`)
    }
  }

  console.log('✅ Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
