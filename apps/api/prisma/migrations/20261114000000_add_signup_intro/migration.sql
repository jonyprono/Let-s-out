-- Parcours d'accueil avant inscription (prénom / nom / naissance / genre)
-- Migration idempotente : peut être rejouée sans erreur ni effet de bord.

-- AlterTable : prénom et nom séparés (nullable → aucun impact sur les comptes existants)
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- Seed : âge minimum d'inscription, modifiable ensuite depuis l'admin.
-- ON CONFLICT DO NOTHING : ne remplace jamais une valeur déjà réglée par un admin.
INSERT INTO "system_settings" ("id", "key", "value", "description", "updatedAt")
VALUES (
  'setting_min_signup_age',
  'MIN_SIGNUP_AGE',
  '18',
  'Âge minimum requis pour créer un compte (inscription et OUT RADAR)',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
