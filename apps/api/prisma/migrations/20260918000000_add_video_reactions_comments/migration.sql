-- CreateTable
CREATE TABLE IF NOT EXISTS "event_video_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_video_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "event_video_comments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_video_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_video_reactions_videoId_idx" ON "event_video_reactions"("videoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_video_reactions_userId_idx" ON "event_video_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "event_video_reactions_userId_videoId_key" ON "event_video_reactions"("userId", "videoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_video_comments_videoId_idx" ON "event_video_comments"("videoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_video_comments_userId_idx" ON "event_video_comments"("userId");

-- AddForeignKey
ALTER TABLE "event_video_reactions" ADD CONSTRAINT "event_video_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_video_reactions" ADD CONSTRAINT "event_video_reactions_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "event_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_video_comments" ADD CONSTRAINT "event_video_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_video_comments" ADD CONSTRAINT "event_video_comments_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "event_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
