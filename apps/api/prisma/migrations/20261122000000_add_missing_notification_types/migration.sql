-- Types de notification déjà utilisés par l'API mais absents de l'enum "NotifType" :
-- chaque insertion échouait (notification non enregistrée, ni WebSocket ni push envoyés).
-- Concernés : nouvelle publication d'une page suivie, co-organisation, demande de participation
-- acceptée / refusée, nouveau badge, nouvel abonné.
-- Migration IDEMPOTENTE et purement additive (aucune donnée modifiée).
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'PAGE_POST';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'CO_HOST_INVITE';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'JOIN_APPROVED';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'JOIN_REJECTED';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'NEW_BADGE';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'NEW_FOLLOWER';