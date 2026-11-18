-- « Quitter l'événement » :
--  1. nouveau type de notification PARTICIPANT_LEFT (organisateur prévenu d'un départ) ;
--  2. bookings.leftAt : date du départ VOLONTAIRE du participant. Un refus de l'organisateur
--     passe aussi la réservation en CANCELLED mais laisse leftAt à NULL : seul un participant
--     parti de lui-même peut rejoindre / redemander à nouveau.
-- Migration IDEMPOTENTE et purement additive (aucune donnée existante modifiée).
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'PARTICIPANT_LEFT';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
