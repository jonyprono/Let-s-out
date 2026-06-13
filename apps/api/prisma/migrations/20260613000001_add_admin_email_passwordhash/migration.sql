-- Migration: add email and passwordHash to admins table
-- Also ensures the admins table exists (created outside of initial migration)

-- CreateTable admins if it doesn't exist yet
CREATE TABLE IF NOT EXISTS "admins" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- AddColumn email (safe: only if it doesn't exist)
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- AddColumn passwordHash (safe: only if it doesn't exist)
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- CreateIndex for email uniqueness (safe: only if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email");

-- CreateIndex for phone uniqueness (safe: only if it doesn't exist)
CREATE UNIQUE INDEX IF NOT EXISTS "admins_phone_key" ON "admins"("phone");
