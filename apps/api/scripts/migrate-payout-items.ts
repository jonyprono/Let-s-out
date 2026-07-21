import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration of PayoutBookingItems...');

  const payoutRequests = await prisma.eventPayoutRequest.findMany({
    where: {
      status: {
        in: ['PENDING', 'VOTING', 'APPROVED', 'COMPLETED']
      }
    }
  });

  console.log(`Found ${payoutRequests.length} payout requests to process.`);

  let createdCount = 0;

  for (const payoutReq of payoutRequests) {
    // Get confirmed bookings for this event
    const bookings = await prisma.booking.findMany({
      where: {
        eventId: payoutReq.eventId,
        status: 'CONFIRMED'
      }
    });

    if (bookings.length === 0) continue;

    // Calculate how much to deduct per booking (evenly distributed for simplicity in this migration)
    const amountPerBooking = payoutReq.amount / bookings.length;

    for (const booking of bookings) {
      // Check if item already exists
      const existing = await prisma.payoutBookingItem.findFirst({
        where: {
          payoutRequestId: payoutReq.id,
          bookingId: booking.id
        }
      });

      if (!existing) {
        await prisma.payoutBookingItem.create({
          data: {
            payoutRequestId: payoutReq.id,
            bookingId: booking.id,
            amountDeducted: amountPerBooking,
            validationStatusSnapshot: booking.poolValidationStatus,
            delegatedToSnapshot: booking.delegatedToId
          }
        });
        createdCount++;
      }
    }
  }

  console.log(`Migration completed successfully. Created ${createdCount} PayoutBookingItems.`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
