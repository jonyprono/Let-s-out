-- ============================================================
-- Migration: add_anonymous_contribution
-- Date: 2026-10-17
-- Adds:
--   1. payments.eventId  (nullable, backfillé via booking)
--   2. payments.isAnonymous (boolean, default false)
--   3. Table payout_direct_items (dons directs sans Booking)
--   4. Index payments(eventId)
--   5. FK payments -> events
-- ============================================================

-- Step 1: Add new columns to payments
ALTER TABLE "payments"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Backfill eventId from the linked booking
-- Tous les paiements existants ont un bookingId -> on récupère l'eventId via la table bookings
UPDATE "payments" p
SET "eventId" = b."eventId"
FROM "bookings" b
WHERE p."bookingId" = b."id"
  AND p."eventId" IS NULL;

-- Step 3: Index on eventId for uniform event-based queries
CREATE INDEX "payments_eventId_idx" ON "payments"("eventId");

-- Step 4: FK payments -> events (SET NULL on cascade so orphan payments stay intact)
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Create payout_direct_items table
-- Fige les dons directs (bookingId = null) dans une demande de déblocage,
-- symétriquement à payout_booking_items pour les participants.
CREATE TABLE "payout_direct_items" (
    "id"              TEXT NOT NULL,
    "payoutRequestId" TEXT NOT NULL,
    "paymentId"       TEXT NOT NULL,
    "amountDeducted"  DOUBLE PRECISION NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_direct_items_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "payout_direct_items_payoutRequestId_idx" ON "payout_direct_items"("payoutRequestId");
CREATE INDEX "payout_direct_items_paymentId_idx"       ON "payout_direct_items"("paymentId");

-- FK payout_direct_items -> event_payout_requests
ALTER TABLE "payout_direct_items"
  ADD CONSTRAINT "payout_direct_items_payoutRequestId_fkey"
  FOREIGN KEY ("payoutRequestId") REFERENCES "event_payout_requests"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FK payout_direct_items -> payments
ALTER TABLE "payout_direct_items"
  ADD CONSTRAINT "payout_direct_items_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
