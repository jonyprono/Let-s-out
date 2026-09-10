-- ============================================================
-- MIGRATION FINTECH AUDIT V1
-- À exécuter dans Supabase SQL Editor (ou psql)
-- ============================================================

-- 1. Mise à jour de event_payout_requests
-- Ajout des colonnes manquantes

ALTER TABLE "event_payout_requests"
  ADD COLUMN IF NOT EXISTS "rejections"         TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "snapshotVoterIds"   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "voteDurationHours"  INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS "threshold"          FLOAT   NOT NULL DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS "expiresAt"          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason"    TEXT;

-- Mise à jour des index
CREATE INDEX IF NOT EXISTS "event_payout_requests_status_idx"    ON "event_payout_requests"("status");
CREATE INDEX IF NOT EXISTS "event_payout_requests_expiresAt_idx" ON "event_payout_requests"("expiresAt");

-- 2. Mise à jour de events pour permettre les retraits partiels
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "poolWithdrawn" FLOAT NOT NULL DEFAULT 0;

-- 3. Création de la table audit_logs

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "actorId"     TEXT,
  "actorRole"   TEXT,
  "action"      TEXT        NOT NULL,
  "targetType"  TEXT,
  "targetId"    TEXT,
  "eventId"     TEXT,
  "oldValue"    JSONB,
  "newValue"    JSONB,
  "amount"      FLOAT,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "comment"     TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_actorId_idx"   ON "audit_logs"("actorId");
CREATE INDEX IF NOT EXISTS "audit_logs_eventId_idx"   ON "audit_logs"("eventId");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"    ON "audit_logs"("action");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- 4. Wallet système pour tracer les commissions
-- Insertion du wallet système (idempotente)
-- Note: Prisma créera ce wallet automatiquement via upsert au premier déblocage.
-- Cette ligne garantit l'existence même si la table wallets a une contrainte unique sur userId.
INSERT INTO "wallets" ("id", "userId", "balance", "currency", "createdAt", "updatedAt")
VALUES (
  'system_platform_wallet',
  'SYSTEM_PLATFORM',
  0,
  'XOF',
  NOW(),
  NOW()
)
ON CONFLICT ("userId") DO NOTHING;

-- 5. Vérification
SELECT 'Migration fintech_audit_v1 appliquée avec succès' AS status;
