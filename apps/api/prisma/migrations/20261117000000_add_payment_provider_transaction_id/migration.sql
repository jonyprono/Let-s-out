-- Unicité stricte des paiements FedaPay : une transaction n'est comptée qu'une seule fois.
-- Migration idempotente (relançable sans erreur). Aucune donnée existante n'est modifiée :
-- les anciens paiements gardent providerTransactionId = NULL (NULL multiples autorisés par l'index unique).
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "providerTransactionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "payments_providerTransactionId_key" ON "payments"("providerTransactionId");
