-- AlterTable
ALTER TABLE "event_payout_requests" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "event_payout_requests_eventId_idempotencyKey_key" ON "event_payout_requests"("eventId", "idempotencyKey");
