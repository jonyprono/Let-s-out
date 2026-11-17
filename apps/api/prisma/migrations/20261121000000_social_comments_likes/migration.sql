-- Commentaires « réseau social » : likes de commentaires, réponses (1 niveau) et likes des
-- publications de pages (avant : like local jamais enregistré).
-- Migration IDEMPOTENTE et purement additive : aucune donnée existante n'est modifiée
-- (les commentaires existants deviennent des commentaires racines, parentId = NULL).

-- Notification « réponse à votre commentaire »
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'COMMENT_REPLY';

-- Réponses (1 niveau) : commentaire racine parent
ALTER TABLE "event_video_comments" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "page_post_comments" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "event_video_comments_parentId_idx" ON "event_video_comments"("parentId");
CREATE INDEX IF NOT EXISTS "page_post_comments_parentId_idx" ON "page_post_comments"("parentId");
CREATE INDEX IF NOT EXISTS "page_post_comments_postId_idx" ON "page_post_comments"("postId");

-- Likes des commentaires de vlogs
CREATE TABLE IF NOT EXISTS "event_video_comment_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_video_comment_likes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_video_comment_likes_userId_commentId_key" ON "event_video_comment_likes"("userId", "commentId");
CREATE INDEX IF NOT EXISTS "event_video_comment_likes_commentId_idx" ON "event_video_comment_likes"("commentId");

-- Likes des publications de pages
CREATE TABLE IF NOT EXISTS "page_post_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_post_likes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "page_post_likes_userId_postId_key" ON "page_post_likes"("userId", "postId");
CREATE INDEX IF NOT EXISTS "page_post_likes_postId_idx" ON "page_post_likes"("postId");

-- Likes des commentaires de publications de pages
CREATE TABLE IF NOT EXISTS "page_post_comment_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_post_comment_likes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "page_post_comment_likes_userId_commentId_key" ON "page_post_comment_likes"("userId", "commentId");
CREATE INDEX IF NOT EXISTS "page_post_comment_likes_commentId_idx" ON "page_post_comment_likes"("commentId");

-- Clés étrangères (ajoutées seulement si absentes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_video_comments_parentId_fkey') THEN
    ALTER TABLE "event_video_comments" ADD CONSTRAINT "event_video_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "event_video_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_post_comments_parentId_fkey') THEN
    ALTER TABLE "page_post_comments" ADD CONSTRAINT "page_post_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "page_post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_video_comment_likes_userId_fkey') THEN
    ALTER TABLE "event_video_comment_likes" ADD CONSTRAINT "event_video_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_video_comment_likes_commentId_fkey') THEN
    ALTER TABLE "event_video_comment_likes" ADD CONSTRAINT "event_video_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "event_video_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_post_likes_userId_fkey') THEN
    ALTER TABLE "page_post_likes" ADD CONSTRAINT "page_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_post_likes_postId_fkey') THEN
    ALTER TABLE "page_post_likes" ADD CONSTRAINT "page_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "page_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_post_comment_likes_userId_fkey') THEN
    ALTER TABLE "page_post_comment_likes" ADD CONSTRAINT "page_post_comment_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'page_post_comment_likes_commentId_fkey') THEN
    ALTER TABLE "page_post_comment_likes" ADD CONSTRAINT "page_post_comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "page_post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;