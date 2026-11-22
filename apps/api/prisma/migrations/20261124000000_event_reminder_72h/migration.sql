-- Rappel J-3 (72h avant le début) envoyé aux participants confirmés
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "reminder72hSent" BOOLEAN NOT NULL DEFAULT false;
