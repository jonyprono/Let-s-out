#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# render-build.sh — Script de build pour Render.com (API)
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Arrêt immédiat si une commande échoue

echo "📦 Installation des dépendances..."
# Attention : Render exécute ceci depuis apps/api
pnpm install --prod=false

echo "🗄️  Application des migrations Prisma..."
# Nous sommes déjà dans apps/api grâce au "Root Directory" de Render

# Marquer les migrations existantes comme appliquées (sans les rejouer).
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

echo "⚙️  Génération du client Prisma..."
npx prisma generate

echo "🏗️  Build de l'API..."
pnpm run build

echo "✅ Build terminé avec succès !"
