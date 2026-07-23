import { FastifyInstance } from 'fastify';

export interface PoolBookingInfo {
  id: string;
  userId: string;
  totalPaid: number;
  remainingAmount: number;
  poolValidationStatus: string;
  delegatedToId: string | null;
  isValidated: boolean;
}

/**
 * Calcule le montant débloqué de la cagnotte en fonction des validations individuelles
 * et prend en compte les retraits partiels déjà effectués.
 */
export async function calculateAvailablePoolAmount(
  app: FastifyInstance,
  eventId: string
): Promise<{ availableAmount: number; totalCollected: number; pendingCount: number; breakdowns: PoolBookingInfo[]; hasPool: boolean }> {
  const event = await (app as any).prisma.event.findUnique({
    where: { id: eventId },
    select: { enableNonVoterPenalties: true, poolClosedAt: true, poolTarget: true, validatorVoteDeadline: true }
  });
  
  if (!event || !event.poolTarget || event.poolTarget <= 0) {
    return { availableAmount: 0, totalCollected: 0, pendingCount: 0, breakdowns: [], hasPool: false };
  }
  
  // On récupère toutes les réservations avec leurs déductions
  const bookings = await (app as any).prisma.booking.findMany({
    where: { eventId, status: { not: 'REFUNDED' } },
    select: { 
      id: true,
      userId: true, 
      totalPaid: true, 
      poolValidationStatus: true, 
      delegatedToId: true,
      payoutItems: {
        select: { amountDeducted: true, payoutRequest: { select: { status: true } } }
      }
    },
  });

  let availableAmount = 0;
  let totalCollected = 0;
  let pendingCount = 0;
  const breakdowns: PoolBookingInfo[] = [];

  for (const b of bookings) {
    if (b.totalPaid > 0) {
      totalCollected += b.totalPaid;
      
      // Calculer le montant restant (non encore retiré)
      const deducted = b.payoutItems
        .filter((item: any) => item.payoutRequest.status !== 'REJECTED' && item.payoutRequest.status !== 'CANCELLED')
        .reduce((sum: number, item: any) => sum + item.amountDeducted, 0);
      
      const remainingAmount = Math.max(0, b.totalPaid - deducted);
      
      // All remaining funds are considered available (eligible) for a payout request
      let isPartValidated = true;
      
      // We still track pendingCount to know how many haven't made a choice
      if (b.poolValidationStatus === 'PENDING') {
        pendingCount++;
      }

      if (isPartValidated) {
        availableAmount += remainingAmount;
      }

      breakdowns.push({
        id: b.id,
        userId: b.userId,
        totalPaid: b.totalPaid,
        remainingAmount,
        poolValidationStatus: b.poolValidationStatus,
        delegatedToId: b.delegatedToId,
        isValidated: isPartValidated
      });
    }
  }

  return { availableAmount, totalCollected, pendingCount, breakdowns, hasPool: true };
}
