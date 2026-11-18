import { Resend } from 'resend'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { emailFromGeneral, emailFromTickets } from './email-senders'
import { ticketQrImageUrl, ticketQrPng } from './ticket.service'

export interface TicketEmailData {
  to: string
  userName: string
  eventName: string
  eventDate: Date
  location: string
  bookingId: string
  /** Jeton secret du billet (ensureTicketToken) — c'est LUI qui est encodé dans le QR */
  ticketToken: string
  price: number
  quantity: number
  coverImage?: string
}

export interface MultiTicketEmailData {
  to: string
  userName: string
  eventName: string
  eventDate: Date
  location: string
  /** Identifiant de la commande (paiement) */
  orderRef: string
  total: number
  coverImage?: string
  tickets: { token: string; tierName: string; price: number }[]
}

/** Résultat d'un envoi : `id` = identifiant Resend (retrouvable dans le tableau de bord Resend) */
export type EmailSendResult = { ok: true; id: string } | { ok: false; reason: string }

/** Masque une adresse dans les journaux : « sen…@gmail.com » (suivi possible sans exposer l'adresse) */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = String(email).split('@')
  return `${local.slice(0, 3)}…@${domain}`
}

/**
 * Interprète la réponse de `resend.emails.send`.
 * ATTENTION : le SDK `resend` 1.x ne LÈVE PAS d'erreur quand l'API refuse l'envoi (domaine non
 * vérifié, expéditeur invalide, quota…) : il RENVOIE le corps d'erreur { statusCode, message, name }.
 * Sans cette lecture, un refus passait totalement inaperçu (ni log, ni erreur).
 */
export function interpretResendResponse(res: any): EmailSendResult {
  if (res && typeof res.id === 'string') return { ok: true, id: res.id }
  if (res?.data?.id) return { ok: true, id: String(res.data.id) } // format des SDK récents
  const err = res?.error ?? res
  const reason = [err?.statusCode, err?.name, err?.message].filter(Boolean).join(' — ') || 'Réponse Resend inattendue'
  return { ok: false, reason }
}

export function logEmailResult(kind: string, to: string, subject: string, result: EmailSendResult) {
  if (result.ok) {
    console.log(`[EMAIL] ${kind} envoyé — à ${maskEmail(to)} — « ${subject} » — id Resend ${result.id}`)
  } else {
    console.error(`[EMAIL] ${kind} NON envoyé — à ${maskEmail(to)} — « ${subject} » — ${result.reason}`)
  }
}

export class EmailService {
  private resend: Resend | null = null

  constructor() {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(process.env.RESEND_API_KEY)
    } else {
      console.warn('RESEND_API_KEY is not defined. Emails will not be sent.')
    }
  }

  async sendTicketEmail(data: TicketEmailData): Promise<void> {
    if (!this.resend) return

    // QR = jeton secret du billet, image générée par NOTRE API (plus de quickchart.io : le service
    // tiers recevait l'identifiant). Le PNG est aussi joint, pour un accès hors connexion.
    const qrCodeUrl = ticketQrImageUrl(data.ticketToken)
    const bookingRef = data.bookingId.slice(-8).toUpperCase()
    
    const formattedDate = format(data.eventDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })
    
    // Fallback image if cover is not provided
    const coverUrl = data.coverImage || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Votre Ticket pour ${data.eventName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header-image { width: 100%; height: 200px; object-fit: cover; }
        .content { padding: 32px; }
        .title { font-size: 24px; font-weight: 800; color: #18181b; margin-top: 0; margin-bottom: 8px; }
        .subtitle { font-size: 16px; color: #71717a; margin-top: 0; margin-bottom: 24px; }
        .details-box { background: #f9fafb; border-radius: 16px; padding: 20px; margin-bottom: 32px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #e4e4e7; padding-bottom: 12px; }
        .detail-row:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
        .detail-label { color: #71717a; font-size: 14px; }
        .detail-value { color: #18181b; font-weight: 600; font-size: 14px; text-align: right; }
        .qr-section { text-align: center; margin-bottom: 24px; padding: 24px; border: 2px dashed #e4e4e7; border-radius: 20px; }
        .qr-image { width: 200px; height: 200px; border-radius: 12px; margin-bottom: 16px; }
        .qr-text { color: #71717a; font-size: 14px; margin: 0; }
        .booking-id { font-family: monospace; font-size: 16px; font-weight: 700; color: #18181b; letter-spacing: 2px; }
        .footer { text-align: center; color: #a1a1aa; font-size: 12px; padding-top: 24px; border-top: 1px solid #f4f4f5; }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="${coverUrl}" alt="Event Cover" class="header-image" />
        <div class="content">
          <h1 class="title">${data.eventName}</h1>
          <p class="subtitle">Bonjour ${data.userName}, voici votre reçu !</p>
          
          <div class="qr-section">
            <img src="${qrCodeUrl}" alt="QR Code" class="qr-image" />
            <p class="qr-text">Présentez ce QR Code à l'entrée</p>
            <p class="booking-id">${bookingRef}</p>
            <p class="qr-text">Billet personnel à usage unique — valable pour une seule entrée.</p>
          </div>

          <!-- Avertissement anti-fraude : styles en ligne (certains clients e-mail ignorent <style>) -->
          <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:16px;padding:16px 18px;margin-bottom:24px;">
            <p style="margin:0;font-size:14px;line-height:1.5;color:#9A3412;">
              <strong>🔒 Important :</strong> ce billet et son QR code sont strictement personnels et valables pour une seule entrée. Ne les partagez pas pour éviter toute usurpation.
            </p>
          </div>

          <div class="details-box">
            <div class="detail-row">
              <span class="detail-label">Date & Heure</span>
              <span class="detail-value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Lieu</span>
              <span class="detail-value">${data.location}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Places</span>
              <span class="detail-value">${data.quantity} x Ticket</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Montant Payé</span>
              <span class="detail-value">${data.price > 0 ? `${data.price} F CFA` : 'Gratuit'}</span>
            </div>
          </div>
          
          <div class="footer">
            Cet email sert de reçu officiel. Merci d'utiliser Let's Out !
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const subject = `Votre ticket pour ${data.eventName}`
    try {
      const response = await this.resend.emails.send({
        from: emailFromTickets(), // billets : expéditeur Billetterie exclusivement
        to: data.to,
        subject,
        html: htmlContent,
        attachments: [{ filename: `billet-${bookingRef}.png`, content: await ticketQrPng(data.ticketToken) }],
      })
      logEmailResult('Billet', data.to, subject, interpretResendResponse(response))
    } catch (err: any) {
      logEmailResult('Billet', data.to, subject, { ok: false, reason: `Exception : ${err?.message ?? err}` })
    }
  }

  /**
   * Billetterie multi-billets : UN e-mail avec tous les billets de la commande.
   * Chaque billet a son propre QR (LO1.<token>) et sa catégorie ; les PNG sont joints
   * (accès hors connexion, transfert facile à un invité).
   */
  async sendTicketsEmail(data: MultiTicketEmailData): Promise<EmailSendResult> {
    if (data.tickets.length === 0) return { ok: false, reason: 'Aucun billet à envoyer' }
    if (!this.resend) {
      const result = { ok: false as const, reason: 'RESEND_API_KEY non configurée' }
      logEmailResult('Billets', data.to, `Billets ${data.eventName}`, result)
      return result
    }
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
    const orderRef = data.orderRef.slice(-8).toUpperCase()
    const formattedDate = format(data.eventDate, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })
    const coverUrl = data.coverImage || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
    const n = data.tickets.length

    const ticketBlocks = data.tickets.map((t, i) => `
          <div style="text-align:center;margin-bottom:20px;padding:20px;border:2px dashed #e4e4e7;border-radius:20px;">
            <p style="margin:0 0 6px;font-size:12px;color:#71717a;">Billet ${i + 1} / ${n}</p>
            <p style="margin:0 0 12px;font-size:20px;font-weight:800;color:#FF7A00;letter-spacing:1px;">${esc(t.tierName.toUpperCase())}</p>
            <img src="${ticketQrImageUrl(t.token)}" alt="QR Code" width="200" height="200" style="border-radius:12px;" />
            <p style="margin:12px 0 0;font-family:monospace;font-size:15px;font-weight:700;color:#18181b;letter-spacing:2px;">${t.token.slice(0, 8).toUpperCase()}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#71717a;">1 entrée · ${t.price.toLocaleString('fr-FR')} F CFA</p>
          </div>`).join('')

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Vos billets pour ${esc(data.eventName)}</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:20px;">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;">
        <img src="${coverUrl}" alt="" style="width:100%;height:200px;object-fit:cover;" />
        <div style="padding:32px;">
          <h1 style="font-size:24px;font-weight:800;color:#18181b;margin:0 0 8px;">${esc(data.eventName)}</h1>
          <p style="font-size:16px;color:#71717a;margin:0 0 24px;">Bonjour ${esc(data.userName)}, voici ${n > 1 ? `vos ${n} billets` : 'votre billet'} !</p>
          ${ticketBlocks}
          <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:16px;padding:16px 18px;margin:0 0 24px;">
            <p style="margin:0;font-size:14px;line-height:1.5;color:#9A3412;">
              <strong>🔒 Important :</strong> ${n > 1 ? 'ces billets et leurs QR codes sont strictement personnels' : 'ce billet et son QR code sont strictement personnels'} et chaque QR code n'est valable que pour <strong>une seule entrée</strong>.
              Ne les publiez jamais (réseaux sociaux, groupes) pour éviter toute usurpation.
              ${n > 1 ? "Pour un invité, transférez-lui uniquement son billet : il lui suffit de présenter son QR code à l'entrée." : ''}
            </p>
          </div>
          <div style="background:#f9fafb;border-radius:16px;padding:20px;margin-bottom:24px;font-size:14px;">
            <p style="margin:0 0 10px;"><span style="color:#71717a;">Date & heure :</span> <strong>${esc(formattedDate)}</strong></p>
            <p style="margin:0 0 10px;"><span style="color:#71717a;">Lieu :</span> <strong>${esc(data.location)}</strong></p>
            <p style="margin:0 0 10px;"><span style="color:#71717a;">Commande :</span> <strong style="font-family:monospace;">${orderRef}</strong></p>
            <p style="margin:0;"><span style="color:#71717a;">Montant payé :</span> <strong>${data.total.toLocaleString('fr-FR')} F CFA</strong></p>
          </div>
          <p style="text-align:center;color:#a1a1aa;font-size:12px;border-top:1px solid #f4f4f5;padding-top:24px;margin:0;">
            Cet e-mail sert de reçu officiel. Merci d'utiliser Let's Out !
          </p>
        </div>
      </div>
    </body>
    </html>`

    const subject = n > 1 ? `Vos ${n} billets pour ${data.eventName}` : `Votre billet pour ${data.eventName}`
    let result: EmailSendResult
    try {
      const attachments = await Promise.all(
        data.tickets.map(async (t, i) => ({
          filename: `billet-${i + 1}-${t.tierName.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.png`,
          content: await ticketQrPng(t.token),
        })),
      )
      const response = await this.resend.emails.send({
        from: emailFromTickets(),
        to: data.to,
        subject,
        html: htmlContent,
        attachments,
      })
      result = interpretResendResponse(response)
    } catch (err: any) {
      result = { ok: false, reason: `Exception : ${err?.message ?? err}` }
    }
    logEmailResult(`Billets (${n})`, data.to, subject, result)
    return result
  }

  // (Ancien sendWelcomeEmail SUPPRIMÉ : second e-mail de bienvenue envoyé en doublon aux
  //  inscriptions Google. L'unique bienvenue est AuthService.sendWelcomeEmail.)

  // ── Withdrawal receipt email ───────────────────────────────────────────────
  // Fire-and-forget — never throws, never blocks the payout response.
  async sendWithdrawalReceiptEmail(data: {
    to: string
    displayName: string
    amount: number
    phone: string
    network: string
    eventTitle?: string
  }): Promise<void> {
    if (!this.resend) {
      console.log(`[DEV EMAIL] Withdrawal receipt would be sent to ${data.to} — ${data.amount} F CFA`)
      return
    }
    try {
      await this.resend.emails.send({
        from: emailFromGeneral(), // reçu financier : expéditeur général, pas la billetterie
        to: data.to,
        subject: `Confirmation de retrait — ${data.amount.toLocaleString('fr-FR')} F CFA`,
        html: buildWithdrawalReceiptHtml(data),
      })
      console.log(`[EmailService] Withdrawal receipt sent to ${data.to}`)
    } catch (err) {
      // Log only — never rethrow (must not block payout response)
      console.error('[EmailService] Failed to send withdrawal receipt email:', err)
    }
  }
}

// ── HTML Templates ─────────────────────────────────────────────────────────────

function buildWithdrawalReceiptHtml(data: {
  displayName: string
  amount: number
  phone: string
  network: string
  eventTitle?: string
}): string {
  // Mask phone for privacy — show only last 4 digits
  const maskedPhone = data.phone.length > 4
    ? data.phone.slice(0, -4).replace(/\d/g, '•') + data.phone.slice(-4)
    : data.phone

  const networkLabel = data.network.toUpperCase()
  const amountFormatted = data.amount.toLocaleString('fr-FR')
  const dateFormatted = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmation de retrait</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#18181b,#27272a);padding:40px 32px;text-align:center;">
      <p style="color:#FF991C;font-weight:700;margin:0 0 8px;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Retrait confirmé ✓</p>
      <h1 style="color:#ffffff;font-size:40px;margin:0;font-weight:800;">${amountFormatted} F CFA</h1>
      <p style="color:#a1a1aa;font-size:13px;margin:12px 0 0;">${dateFormatted}</p>
    </div>
    <div style="padding:36px 32px;">
      <p style="color:#52525b;margin:0 0 24px;">Bonjour <strong style="color:#18181b;">${data.displayName}</strong>, votre demande de retrait a été initiée avec succès.</p>
      <div style="background:#f9fafb;border-radius:16px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e4e4e7;">
            <td style="color:#71717a;font-size:14px;padding:10px 0;">Opérateur</td>
            <td style="color:#18181b;font-weight:600;font-size:14px;text-align:right;padding:10px 0;">${networkLabel} Mobile Money</td>
          </tr>
          <tr${data.eventTitle ? ' style="border-bottom:1px solid #e4e4e7;"' : ''}>
            <td style="color:#71717a;font-size:14px;padding:10px 0;">Numéro</td>
            <td style="color:#18181b;font-weight:600;font-size:14px;text-align:right;padding:10px 0;">${maskedPhone}</td>
          </tr>
          ${data.eventTitle ? `<tr>
            <td style="color:#71717a;font-size:14px;padding:10px 0;">Événement</td>
            <td style="color:#18181b;font-weight:600;font-size:14px;text-align:right;padding:10px 0;">${data.eventTitle}</td>
          </tr>` : ''}
        </table>
      </div>
      <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 24px;">Le montant sera crédité sur votre Mobile Money sous quelques minutes. En cas de problème, contactez notre support.</p>
      <hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0;">
      <p style="color:#a1a1aa;font-size:12px;text-align:center;margin:0;">© 2025 Let's Out. Tous droits réservés.<br>Cet email est un reçu officiel de transaction.</p>
    </div>
  </div>
</body>
</html>`
}
