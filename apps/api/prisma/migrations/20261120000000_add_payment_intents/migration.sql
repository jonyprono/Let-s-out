-- Commandes FedaPay enregistrées dès la création de la transaction (rattachement fiable
-- transaction → acheteur / événement / billets, indépendant des métadonnées FedaPay).
-- Migration IDEMPOTENTE et purement additive : aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "payment_intents" (
    "providerTransactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerStatus" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("providerTransactionId")
);
CREATE INDEX IF NOT EXISTS "payment_intents_status_createdAt_idx" ON "payment_intents"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "payment_intents_userId_eventId_idx" ON "payment_intents"("userId", "eventId");