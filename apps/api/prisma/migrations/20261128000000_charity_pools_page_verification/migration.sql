-- 1. Cagnottes solidaires / santé supervisées par une ONG partenaire agréée
-- 2. Certification des pages (badge officiel anti-usurpation)
-- Migration IDEMPOTENTE et purement additive (aucune donnée existante modifiée).

-- ── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "PageVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PageVerificationBadge" AS ENUM ('BLUE', 'GOLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PartnerOrgStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nouvelle catégorie d'événement « Solidaire / Aide médicale »
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'CHARITY';

-- ── ONG partenaires ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "partner_orgs" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "address" TEXT,
    "ifu" TEXT,
    "rccmOrReceiptNumber" TEXT NOT NULL,
    "kycStatus" "PartnerOrgStatus" NOT NULL DEFAULT 'PENDING',
    "documentsUrls" JSONB NOT NULL,
    "isEligibleForFundraisers" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "partner_orgs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "partner_orgs_kycStatus_idx" ON "partner_orgs"("kycStatus");
CREATE INDEX IF NOT EXISTS "partner_orgs_applicantId_idx" ON "partner_orgs"("applicantId");
DO $$ BEGIN
  ALTER TABLE "partner_orgs" ADD CONSTRAINT "partner_orgs_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Événements : cagnotte solidaire ────────────────────────────────────────
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "charityOrgId" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "isCharityPool" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "medicalProofUrl" TEXT;
CREATE INDEX IF NOT EXISTS "events_charityOrgId_idx" ON "events"("charityOrgId");
DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_charityOrgId_fkey"
    FOREIGN KEY ("charityOrgId") REFERENCES "partner_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Pages : certification ──────────────────────────────────────────────────
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "verificationStatus" "PageVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "verificationBadge" "PageVerificationBadge";
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "page_verification_requests" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "documents" JSONB NOT NULL,
    "status" "PageVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "badge" "PageVerificationBadge",
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "page_verification_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "page_verification_requests_status_idx" ON "page_verification_requests"("status");
CREATE INDEX IF NOT EXISTS "page_verification_requests_pageId_idx" ON "page_verification_requests"("pageId");
DO $$ BEGIN
  ALTER TABLE "page_verification_requests" ADD CONSTRAINT "page_verification_requests_pageId_fkey"
    FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "page_verification_requests" ADD CONSTRAINT "page_verification_requests_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
