import { FastifyInstance } from 'fastify';

/**
 * Calcule le montant débloqué de la cagnotte en fonction des validations individuelles.
 */
export async function calculateAvailablePoolAmount(
  app: FastifyInstance,
  eventId: string
): Promise<{ availableAmount: number; totalCollected: number; pendingCount: number }> {
  const event = await (app as any).prisma.event.findUnique({
    where: { id: eventId },
    select: { enableNonVoterPenalties: true, poolClosedAt: true }
  });
  
  // On récupère toutes les réservations (même celles à 0 pour résoudre les délégations vers l'organisateur)
  const bookings = await (app as any).prisma.booking.findMany({
    where: { eventId, status: { not: 'REFUNDED' } },
    select: { userId: true, totalPaid: true, poolValidationStatus: true, delegatedToId: true },
  });

  const bookingsMap = new Map(bookings.map((b: any) => [b.userId, b]));
  
  let availableAmount = 0;
  let totalCollected = 0;
  let pendingCount = 0;

  // Si la cagnotte est fermée (décaissement) et les pénalités actives, on force la validation des PENDING
  const applyPenalties = event?.enableNonVoterPenalties && event?.poolClosedAt;

  for (const b of bookings) {
    if (b.totalPaid > 0) {
      totalCollected += b.totalPaid;
      
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
        availableAmount += b.totalPaid;
      } else {
        pendingCount++;
      }
    }
  }

  return { availableAmount, totalCollected, pendingCount };
}
