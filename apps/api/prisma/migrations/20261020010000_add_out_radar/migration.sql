-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "RadarInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "radar_visibilities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT false,
    "durationMinutes" INTEGER,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "outingType" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radar_visibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "radar_invites" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "RadarInviteStatus" NOT NULL DEFAULT 'PENDING',
    "outingType" TEXT,
    "message" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radar_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "radar_visibilities_userId_key" ON "radar_visibilities"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radar_visibilities_isVisible_expiresAt_idx" ON "radar_visibilities"("isVisible", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radar_invites_senderId_receiverId_status_idx" ON "radar_invites"("senderId", "receiverId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "radar_invites_receiverId_status_idx" ON "radar_invites"("receiverId", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "radar_visibilities" ADD CONSTRAINT "radar_visibilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "radar_invites" ADD CONSTRAINT "radar_invites_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "radar_invites" ADD CONSTRAINT "radar_invites_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
