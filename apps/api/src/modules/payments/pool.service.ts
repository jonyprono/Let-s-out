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
): Promise<{ availableAmount: number; totalCollected: number; pendingCount: number; breakdowns: PoolBookingInfo[] }> {
  const event = await (app as any).prisma.event.findUnique({
    where: { id: eventId },
    select: { enableNonVoterPenalties: true, poolClosedAt: true }
  });
  
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
        select: { amount: true, payoutRequest: { select: { status: true } } }
      }
    },
  });

  const bookingsMap = new Map(bookings.map((b: any) => [b.userId, b]));
  
  let availableAmount = 0;
  let totalCollected = 0;
  let pendingCount = 0;
  const breakdowns: PoolBookingInfo[] = [];

  const applyPenalties = event?.enableNonVoterPenalties && event?.poolClosedAt;

  for (const b of bookings) {
    if (b.totalPaid > 0) {
      totalCollected += b.totalPaid;
      
      // Calculer le montant restant (non encore retiré)
      const deducted = b.payoutItems
        .filter((item: any) => item.payoutRequest.status !== 'REJECTED' && item.payoutRequest.status !== 'CANCELLED')
        .reduce((sum: number, item: any) => sum + item.amount, 0);
      
      const remainingAmount = Math.max(0, b.totalPaid - deducted);
      
      let isPartValidated = false;
      
      if (b.poolValidationStatus === 'VALIDATED') {
        isPartValidated = true;
      } else if (b.poolValidationStatus === 'DELEGATED' && b.delegatedToId) {
        // Resolve delegation
        const delegatee = bookingsMap.get(b.delegatedToId) as any;
        if (delegatee && delegatee.poolValidationStatus === 'VALIDATED') {
          isPartValidated = true;
        } else if (applyPenalties) {
          isPartValidated = true;
        }
      } else if (applyPenalties) {
        isPartValidated = true;
      }

      if (isPartValidated) {
        availableAmount += remainingAmount;
      } else if (remainingAmount > 0) {
        pendingCount++;
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

  return { availableAmount, totalCollected, pendingCount, breakdowns };
}
