-- Billetterie multi-catégories & multi-billets + commission Let's Out.
-- Migration IDEMPOTENTE (relançable sans erreur). Aucune donnée existante n'est modifiée :
-- les événements gratuits / à prix unique / cagnottes gardent leur fonctionnement actuel.

-- Type de mouvement Wallet pour les recettes de billetterie
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'TICKET_SALES';

-- Événement : activation + date de versement des recettes
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ticketingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ticketRevenueReleasedAt" TIMESTAMP(3);

-- Compte Mobile Money de versement de l'organisateur : table SÉPARÉE pour que le numéro
-- ne soit jamais renvoyé avec l'événement (les routes publiques incluent toutes ses colonnes)
CREATE TABLE IF NOT EXISTS "event_payout_accounts" (
    "eventId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_payout_accounts_pkey" PRIMARY KEY ("eventId")
);

-- Paiement : ventilation financière figée à la vente
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platformFeeAmount" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "organizerNetAmount" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "commissionPercent" DOUBLE PRECISION;

-- Catégories de billets
CREATE TABLE IF NOT EXISTS "ticket_tiers" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ticket_tiers_pkey" PRIMARY KEY ("id")
);

-- Billets individuels (1 QR unique par place)
CREATE TABLE IF NOT EXISTS "tickets" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTierId" TEXT,
    "tierName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "ticketToken" TEXT NOT NULL,
    "paymentId" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ticket_tiers_eventId_idx" ON "ticket_tiers"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_ticketToken_key" ON "tickets"("ticketToken");
CREATE INDEX IF NOT EXISTS "tickets_bookingId_idx" ON "tickets"("bookingId");
CREATE INDEX IF NOT EXISTS "tickets_eventId_idx" ON "tickets"("eventId");
CREATE INDEX IF NOT EXISTS "tickets_ticketTierId_idx" ON "tickets"("ticketTierId");
CREATE INDEX IF NOT EXISTS "tickets_paymentId_idx" ON "tickets"("paymentId");

-- Clés étrangères (ajoutées seulement si absentes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ticket_tiers_eventId_fkey') THEN
    ALTER TABLE "ticket_tiers" ADD CONSTRAINT "ticket_tiers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_bookingId_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_eventId_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_ticketTierId_fkey') THEN
    ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticketTierId_fkey" FOREIGN KEY ("ticketTierId") REFERENCES "ticket_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_payout_accounts_eventId_fkey') THEN
    ALTER TABLE "event_payout_accounts" ADD CONSTRAINT "event_payout_accounts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Réglages administrables (valeurs par défaut validées ; jamais écrasées si déjà présentes)
INSERT INTO "system_settings" ("id", "key", "value", "description", "updatedAt") VALUES
  ('setting_ticket_commission_percent', 'TICKET_COMMISSION_PERCENT', '7', 'Commission Let''s Out sur chaque billet vendu (%), frais FedaPay inclus', CURRENT_TIMESTAMP),
  ('setting_ticket_payout_delay_hours', 'TICKET_PAYOUT_DELAY_HOURS', '24', 'Délai de sécurité après la fin de l''événement avant versement des recettes de billetterie (heures)', CURRENT_TIMESTAMP),
  ('setting_ticket_max_per_order', 'TICKET_MAX_PER_ORDER', '10', 'Nombre maximum de billets par commande (toutes catégories confondues)', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
