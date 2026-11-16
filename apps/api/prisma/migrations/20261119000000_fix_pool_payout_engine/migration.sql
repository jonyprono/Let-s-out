-- Cagnotte : moteur de déblocage fiable + suivi des retraits Mobile Money.
-- Migration IDEMPOTENTE. Aucun argent n'est déplacé : on reconstitue seulement l'état de chaque part
-- figée à partir de ce qui a réellement été versé, pour débloquer les demandes restées « en cours ».

-- 1. État de chaque part figée dans une demande de déblocage
ALTER TABLE "payout_booking_items" ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "payout_booking_items" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);
ALTER TABLE "payout_direct_items" ADD COLUMN IF NOT EXISTS "state" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "payout_direct_items" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);

-- 2. Suivi des retraits Mobile Money (payout FedaPay)
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "providerPayoutId" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "payoutStatus" TEXT;
CREATE INDEX IF NOT EXISTS "wallet_transactions_payoutStatus_idx" ON "wallet_transactions"("payoutStatus");

-- 3. Reconstitution de l'état des parts existantes (uniquement celles encore à l'état par défaut).
--    Ancien comportement : une part SANS délégation (delegatedToSnapshot NULL) n'était jamais versée,
--    même approuvée ; une part déléguée approuvée était versée ; un déblocage forcé par l'admin
--    (statut APPROVED) versait tout.
WITH x AS (
  SELECT i."id", r."status" AS req_status, i."delegatedToSnapshot" AS snap,
    (SELECT pa."status" FROM "PayoutApproval" pa
      WHERE pa."payoutRequestId" = i."payoutRequestId"
        AND pa."userId" = COALESCE(i."delegatedToSnapshot", b."userId")
      LIMIT 1) AS approval_status
  FROM "payout_booking_items" i
  JOIN "event_payout_requests" r ON r."id" = i."payoutRequestId"
  JOIN "bookings" b ON b."id" = i."bookingId"
  WHERE i."state" = 'PENDING'
)
UPDATE "payout_booking_items" i
SET "state" = CASE
    WHEN x.req_status = 'APPROVED' THEN 'RELEASED'
    WHEN x.req_status = 'REJECTED' THEN 'RETURNED'
    WHEN x.approval_status = 'APPROVED' AND x.snap IS NOT NULL THEN 'RELEASED'
    ELSE 'RETURNED'
  END
FROM x
WHERE x."id" = i."id"
  AND (x.approval_status IS DISTINCT FROM 'PENDING' OR x.req_status IN ('APPROVED', 'REJECTED'));

-- Dons directs : seul un déblocage forcé (APPROVED) les a réellement versés
UPDATE "payout_direct_items" d
SET "state" = CASE WHEN r."status" = 'APPROVED' THEN 'RELEASED' ELSE 'RETURNED' END
FROM "event_payout_requests" r
WHERE r."id" = d."payoutRequestId" AND d."state" = 'PENDING'
  AND r."status" NOT IN ('PENDING', 'PARTIAL');

-- 4. Le validateur de chaque part est toujours renseigné (le participant lui-même s'il n'a pas délégué)
UPDATE "payout_booking_items" i
SET "delegatedToSnapshot" = b."userId"
FROM "bookings" b
WHERE b."id" = i."bookingId" AND i."delegatedToSnapshot" IS NULL;

-- 5. Demandes « en cours » sans plus aucun validateur en attente → statut final.
--    Débloque les cagnottes : une nouvelle demande redevient possible.
WITH stuck AS (
  SELECT r."id"
  FROM "event_payout_requests" r
  WHERE r."status" IN ('PENDING', 'PARTIAL')
    AND NOT EXISTS (
      SELECT 1 FROM "PayoutApproval" pa
      WHERE pa."payoutRequestId" = r."id" AND pa."role" = 'VALIDATOR' AND pa."status" = 'PENDING'
    )
), totals AS (
  SELECT s."id",
    EXISTS (SELECT 1 FROM "payout_booking_items" i WHERE i."payoutRequestId" = s."id" AND i."state" = 'RELEASED') AS any_released,
    EXISTS (SELECT 1 FROM "payout_booking_items" i WHERE i."payoutRequestId" = s."id" AND i."state" <> 'RELEASED') AS any_not_released,
    EXISTS (SELECT 1 FROM "PayoutApproval" pa WHERE pa."payoutRequestId" = s."id" AND pa."role" = 'VALIDATOR' AND pa."status" = 'REJECTED') AS any_rejected
  FROM stuck s
)
UPDATE "event_payout_requests" r
SET "status" = CASE
    WHEN t.any_released AND NOT t.any_not_released THEN 'COMPLETED'
    WHEN t.any_released THEN 'PARTIAL_COMPLETED'
    WHEN t.any_rejected THEN 'REJECTED'
    ELSE 'EXPIRED'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM totals t
WHERE r."id" = t."id";

-- Parts encore « en attente » dans une demande désormais terminée → revenues dans la cagnotte
UPDATE "payout_booking_items" i SET "state" = 'RETURNED'
FROM "event_payout_requests" r
WHERE r."id" = i."payoutRequestId" AND i."state" = 'PENDING'
  AND r."status" NOT IN ('PENDING', 'PARTIAL');
UPDATE "payout_direct_items" d SET "state" = 'RETURNED'
FROM "event_payout_requests" r
WHERE r."id" = d."payoutRequestId" AND d."state" = 'PENDING'
  AND r."status" NOT IN ('PENDING', 'PARTIAL');
-- Approbations de co-organisateurs restées en attente sur une demande terminée
UPDATE "PayoutApproval" pa SET "status" = 'EXPIRED', "updatedAt" = CURRENT_TIMESTAMP
FROM "event_payout_requests" r
WHERE r."id" = pa."payoutRequestId" AND pa."status" = 'PENDING'
  AND r."status" NOT IN ('PENDING', 'PARTIAL');

-- 6. Retraits passés : ceux déjà recrédités sont marqués FAILED (suivi homogène)
UPDATE "wallet_transactions" w SET "payoutStatus" = 'FAILED'
WHERE w."type" = 'WITHDRAWAL' AND w."payoutStatus" IS NULL
  AND EXISTS (
    SELECT 1 FROM "wallet_transactions" x
    WHERE x."walletId" = w."walletId" AND x."type" = 'REFUND'
      AND x."amount" = w."amount" AND x."createdAt" >= w."createdAt"
      AND x."createdAt" <= w."createdAt" + INTERVAL '10 minutes'
  );
