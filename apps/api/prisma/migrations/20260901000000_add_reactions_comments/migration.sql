-- CreateTable
CREATE TABLE "event_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_reactions_eventId_idx" ON "event_reactions"("eventId");

-- CreateIndex
CREATE INDEX "event_reactions_userId_idx" ON "event_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_reactions_userId_eventId_key" ON "event_reactions"("userId", "eventId");

-- CreateIndex
CREATE INDEX "event_comments_eventId_idx" ON "event_comments"("eventId");

-- CreateIndex
CREATE INDEX "event_comments_userId_idx" ON "event_comments"("userId");

-- AddForeignKey
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reactions" ADD CONSTRAINT "event_reactions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
