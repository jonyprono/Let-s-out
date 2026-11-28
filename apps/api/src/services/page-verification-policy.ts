/**
 * Règles de certification des pages (badge officiel anti-usurpation).
 *
 * Types de structure, pièces exigées et couleur du badge attribué :
 *  - Badge BLEU : entreprises, marques, lieux (bars / clubs…), artistes, créateurs, personnalités.
 *  - Badge OR   : ONG / organisations humanitaires et institutions officielles.
 * La couleur découle du type de structure validé : l'admin ne la choisit pas à la main.
 */
import type { PageVerificationBadge } from '@prisma/client'

export const PAGE_ENTITY_TYPES = ['COMPANY', 'VENUE', 'PUBLIC_FIGURE', 'NGO', 'INSTITUTION'] as const
export type PageEntityType = typeof PAGE_ENTITY_TYPES[number]

export const PAGE_DOC_FIELDS = ['rccm', 'ifu', 'receipt', 'managerId', 'notoriety', 'officialLetter'] as const

/** Pièces obligatoires par type (les autres champs de PAGE_DOC_FIELDS restent facultatifs). */
export const REQUIRED_PAGE_DOCS: Record<PageEntityType, readonly string[]> = {
  COMPANY: ['rccm', 'managerId'],              // + IFU facultatif
  VENUE: ['rccm', 'managerId'],                // lieu exploité par une structure enregistrée
  PUBLIC_FIGURE: ['managerId', 'notoriety'],   // artistes, créateurs, personnalités
  NGO: ['receipt', 'managerId'],               // récépissé de déclaration d'association / ONG
  INSTITUTION: ['officialLetter', 'managerId'], // lettre officielle ou mandat de l'institution
}

/** Badge attribué à la validation, selon le type de structure. */
export function badgeForEntityType(entityType: string): PageVerificationBadge {
  return entityType === 'NGO' || entityType === 'INSTITUTION' ? 'GOLD' : 'BLUE'
}
