#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# render-build.sh — Script de build pour Render.com (API)
#
# ARCHITECTURE DE MIGRATION :
#   Ce projet utilise un schéma de "baseline + deploy" :
#   - Les migrations dans BASELINE_MIGRATIONS sont supposées DÉJÀ appliquées
#     en production (elles ont été appliquées manuellement avant l'adoption
#     de Prisma Migrate, ou lors d'un run précédent).
#   - `prisma migrate deploy` applique TOUTES les migrations NON encore dans
#     la table _prisma_migrations.
#
# RÈGLE : Quand tu crées une nouvelle migration avec `prisma migrate dev`,
#   NE PAS l'ajouter dans BASELINE_MIGRATIONS. Elle sera appliquée
#   automatiquement par `prisma migrate deploy` au prochain déploiement.
#   Ajouter une migration dans BASELINE_MIGRATIONS = dire "cette migration
#   est déjà dans la DB, ne la rejoue pas". C'est UNIQUEMENT pour les
#   migrations historiques créées avant l'adoption de ce script.
# ─────────────────────────────────────────────────────────────────────────────

set -e  # Arrêt immédiat si une commande échoue

echo "📦 Installation des dépendances..."
pnpm install --prod=false

echo "🗄️  Application des migrations Prisma..."

# ─────────────────────────────────────────────────────────────────────────────
# BASELINE : migrations historiques déjà présentes en base de production.
# ⚠️  NE PAS ajouter les nouvelles migrations ici.
# ⚠️  Une migration absente de cette liste sera appliquée par `migrate deploy`.
# ─────────────────────────────────────────────────────────────────────────────
BASELINE_MIGRATIONS=(
  "20260429001319_init"
  "20260613000001_add_admin_email_passwordhash"
  "20260714130000_add_last_delivered_at"
  "20260720_add_feature_flags"
  "20260724120000_add_payout_idempotency_key"
  "20260901000000_add_reactions_comments"
  "20260909000000_add_kyc_document_type"
)

echo "  📋 Marquage des migrations historiques comme appliquées (baseline)..."
for migration in "${BASELINE_MIGRATIONS[@]}"; do
  # --applied marque la migration sans la rejouer. Idempotent si déjà marquée.
  if npx prisma migrate resolve --applied "$migration" 2>/dev/null; then
    echo "  ✔ Baseline OK: $migration"
  else
    echo "  ⚠ Baseline already resolved or not found: $migration (continuing)"
  fi
done

echo "  🚀 Application des nouvelles migrations (non encore en base)..."
npx prisma migrate deploy

echo "⚙️  Génération du client Prisma..."
npx prisma generate

echo "🏗️  Build de l'API..."
pnpm run build

echo "✅ Build terminé avec succès !"
