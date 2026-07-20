import { PrismaClient } from '@prisma/client'

export type Operator = 'EQ' | 'GT' | 'GTE' | 'LT' | 'LTE'
export type Field = 'eventsCreated' | 'eventsJoined' | 'friendsCount' | 'rating' | 'accountAgeDays' | 'votesParticipated' | 'timesAppointedValidator' | 'validationsPerformed'

export interface Rule {
  field: Field
  operator: Operator
  value: number
}

export interface ConditionLogic {
  type: 'AND' | 'OR'
  rules: Rule[]
}

function evaluateRule(rule: Rule, stats: Record<Field, number>): boolean {
  const actualValue = stats[rule.field] || 0
  switch (rule.operator) {
    case 'EQ': return actualValue === rule.value
    case 'GT': return actualValue > rule.value
    case 'GTE': return actualValue >= rule.value
    case 'LT': return actualValue < rule.value
    case 'LTE': return actualValue <= rule.value
    default: return false
  }
}

function evaluateLogic(logic: ConditionLogic | null, stats: Record<Field, number>): boolean {
  if (!logic || !logic.rules || logic.rules.length === 0) return true // default to true if no rules? Or false? Let's say true to allow manual badges

  if (logic.type === 'OR') {
    return logic.rules.some(r => evaluateRule(r, stats))
  }
  
  // Default to AND
  return logic.rules.every(r => evaluateRule(r, stats))
}

export async function evaluateUserBadges(prisma: PrismaClient, userId: string) {
  // 1. Get user stats
  const [
    user,
    eventsCreatedCount,
    eventsJoinedCount,
    friendsCount,
    _profile,
    eventsForRating,
    votesParticipated,
    timesAppointedValidator,
    validationsPerformed
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.event.count({ where: { creatorId: userId } }),
    prisma.booking.count({ where: { userId, status: { not: 'CANCELLED' } } }),
    prisma.friendship.count({
      where: {
        status: 'ACCEPTED',
        OR: [{ initiatorId: userId }, { receiverId: userId }]
      }
    }),
    prisma.profile.findUnique({ where: { userId } }),
    prisma.event.findMany({ where: { creatorId: userId }, include: { reviews: true } }),
    prisma.validatorVote.count({ where: { userId } }),
    prisma.event.count({ where: { validatorIds: { has: userId } } }),
    prisma.validatorVote.count({ where: { userId, event: { validatorIds: { has: userId } } } })
  ])

  if (!user) return

  let reviewCount = 0
  let totalRating = 0
  for (const e of eventsForRating) {
    for (const r of e.reviews) {
      reviewCount++
      totalRating += r.rating
    }
  }
  const rating = reviewCount > 0 ? totalRating / reviewCount : 0

  const accountAgeDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))

  const stats: Record<Field, number> = {
    eventsCreated: eventsCreatedCount,
    eventsJoined: eventsJoinedCount,
    friendsCount,
    rating,
    accountAgeDays,
    votesParticipated,
    timesAppointedValidator,
    validationsPerformed
  }

  // 2. Fetch all active badges
  const allBadges = await prisma.badge.findMany({ where: { isActive: true } })

  // 3. Evaluate each badge
  const newBadgeIds: string[] = []
  for (const badge of allBadges) {
    // Check if badge is expired (endDate has passed)
    if (badge.endDate && badge.endDate < new Date()) {
      continue
    }

    const logic = badge.conditionsLogic as unknown as ConditionLogic
    const isEligible = evaluateLogic(logic, stats)
    
    if (isEligible) {
      newBadgeIds.push(badge.id)
    }
  }

  if (newBadgeIds.length === 0) return

  // 4. Upsert UserBadges (we use upsert to ignore if already earned)
  for (const badgeId of newBadgeIds) {
    await prisma.userBadge.upsert({
      where: {
        userId_badgeId: {
          userId,
          badgeId
        }
      },
      update: {}, // do nothing if already exists
      create: {
        userId,
        badgeId
      }
    })
  }

  return { newBadgeIds, stats }
}

export async function assignBadgeByName(prisma: PrismaClient, userId: string, badgeName: string) {
  const badge = await prisma.badge.findFirst({ where: { name: badgeName } })
  if (!badge) return false;
  
  const existing = await prisma.userBadge.findUnique({ where: { userId_badgeId: { userId, badgeId: badge.id } } })
  if (existing) return false;
  
  await prisma.userBadge.create({ data: { userId, badgeId: badge.id } })
  return true;
}
