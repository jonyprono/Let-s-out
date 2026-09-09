-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('CIP', 'CARTE_BIOMETRIQUE', 'CARTE_IDENTITE_NATIONALE', 'PASSEPORT', 'PERMIS_CONDUIRE');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "kycDocumentType" "KycDocumentType";
