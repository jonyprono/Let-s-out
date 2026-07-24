#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# render-build.sh — Script de build pour Render.com
#
# Problème résolu : Prisma `migrate deploy` échoue si la table `_prisma_migrations`
# n'existe pas encore (nouvelle DB) OU si les migrations initiales ne sont pas
# enregistrées dedans (schema existant créé hors Prisma, i.e. via `db push`).
#
# Solution : on marque chaque migration ANCIENNE comme déjà appliquée
# (`migrate resolve --applied`) avant de déployer. Seules les nouvelles
# migrations seront réellement appliquées.
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Arrêt immédiat si une commande échoue

echo "📦 Installation des dépendances..."
pnpm install --prod=false

echo "🗄️  Application des migrations Prisma..."
cd apps/api

# Marquer les migrations existantes comme appliquées (sans les rejouer).
# --applied est sans danger si la migration est déjà dans _prisma_migrations :
# Prisma ignore silencieusement le doublon.
MIGRATIONS=(
  "20260429001319_init"
  "20260613000001_add_admin_email_passwordhash"
  "20260714130000_add_last_delivered_at"
  "20260720_add_feature_flags"
)

for migration in "${MIGRATIONS[@]}"; do
  echo "  ✔ Baseline: $migration"
  npx prisma migrate resolve --applied "$migration" 2>/dev/null || true
done

echo "  🚀 Deploy new migrations..."
npx prisma migrate deploy

cd ../..

echo "⚙️  Génération du client Prisma..."
npx prisma generate

echo "🏗️  Build de l'API..."
pnpm run build

echo "✅ Build terminé avec succès !"
