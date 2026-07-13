import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fix() {
  const eventId = 'cmribkrbi000jj6g4y77m8nw1';
  
  // Remove dummy coHost
  await prisma.event.update({
    where: { id: eventId },
    data: { coHostIds: [] }
  });

  // Re-run the logic
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { payoutRequest: true }
  });

  const payoutReq = event.payoutRequest;
  const updatedApprovals = payoutReq.approvals;
  const requiredApprovers = new Set<string>();
  if (event.coHostIds) event.coHostIds.forEach(id => id !== event.creatorId && requiredApprovers.add(id));
  if (event.validatorIds) event.validatorIds.forEach(id => id !== event.creatorId && requiredApprovers.add(id));

  const allApproved = Array.from(requiredApprovers).every(id => updatedApprovals.includes(id));
  
  if (allApproved) {
    console.log("All approved! Releasing funds...");
    await prisma.eventPayoutRequest.update({
      where: { eventId },
      data: { status: 'APPROVED' }
    });
    
    // Simulate releaseFunds manually since we don't want to import the whole backend logic 
    await prisma.event.update({
      where: { id: eventId },
      data: { poolReleased: true },
    });

    const wallet = await prisma.wallet.upsert({
      where: { userId: event.creatorId },
      create: { userId: event.creatorId, balance: payoutReq.amount },
      update: { balance: { increment: payoutReq.amount } },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: payoutReq.amount,
        type: 'DEPOSIT',
        balanceAfter: wallet.balance,
        description: `Déblocage des fonds pour "${event.title}"`,
        refId: eventId,
      },
    });

    await prisma.notification.create({
      data: {
        userId: event.creatorId,
        type: 'SYSTEM',
        title: '💸 Fonds débloqués',
        body: `La cagnotte de "${event.title}" a été débloquée avec succès.`,
        data: { eventId },
        isRead: false,
      }
    });
    console.log("Done.");
  }
}

fix().then(() => prisma.$disconnect());
