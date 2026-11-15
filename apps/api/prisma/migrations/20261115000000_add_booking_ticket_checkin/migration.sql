-- Billets : jeton secret unique + contrôle d'entrée (anti double scan).
-- Idempotente : peut être rejouée sans erreur. Colonnes nullables → aucun impact sur les réservations existantes.
-- Les jetons des réservations existantes sont générés par l'API (crypto.randomBytes) à la première
-- consultation du billet ou au premier envoi d'e-mail — pas en SQL (random() n'est pas cryptographique).

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "ticketToken" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "checkedInById" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_ticketToken_key" ON "bookings"("ticketToken");
