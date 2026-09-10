-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- Insert default flags (désactivés par défaut)
INSERT INTO "feature_flags" ("id", "key", "isActive", "description", "updatedAt") VALUES
    (gen_random_uuid()::text, 'profile_pro_banner', false, 'Affiche le bandeau Pass Let''s Out PRO sur la page profil', now()),
    (gen_random_uuid()::text, 'event_transport_card', false, 'Affiche la carte "S''y rendre" sur la page détails événement', now());
