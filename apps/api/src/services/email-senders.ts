/**
 * Expéditeurs des e-mails transactionnels — source unique.
 *
 * - GÉNÉRAL  : bienvenue, codes OTP / sécurité, notifications, reçus de retrait.
 * - BILLETS  : uniquement l'envoi des billets d'événements.
 *
 * Surchargeables par variables d'environnement (EMAIL_FROM_GENERAL / EMAIL_FROM_TICKETS),
 * lues à chaque envoi. Les adresses doivent appartenir à un domaine vérifié dans Resend.
 */
export function emailFromGeneral(): string {
  return process.env.EMAIL_FROM_GENERAL || "Let's Out <contact@letsout.app>"
}

export function emailFromTickets(): string {
  return process.env.EMAIL_FROM_TICKETS || "Let's Out Billetterie <tickets@letsout.app>"
}
