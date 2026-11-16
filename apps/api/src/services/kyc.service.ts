import type { PrismaClient } from '@prisma/client'

/**
 * Règle unique « compte vérifié » pour toute fonction financière (cagnotte, billetterie) :
 * le profil a un KYC validé par l'admin (`profile.kycStatus === 'verified'`).
 * Ne pas confondre avec `user.isVerified` (simple vérification OTP du téléphone / e-mail).
 */
export async function isKycVerified(prisma: PrismaClient, userId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({ where: { userId }, select: { kycStatus: true } })
  return profile?.kycStatus === 'verified'
}
