-- AlterTable
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "allowGuestShare" BOOLEAN NOT NULL DEFAULT false;
