import { Resend } from 'resend'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface TicketEmailData {
  to: string
  userName: string
  eventName: string
  eventDate: Date
  location: string
  bookingId: string
  price: number
  quantity: number
  coverImage?: string
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

    const qrCodeUrl = `https://quickchart.io/qr?text=${encodeURIComponent(data.bookingId)}&size=300&margin=2`
    
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
            <p class="booking-id">${data.bookingId.toUpperCase()}</p>
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

    try {
      const response = await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'tickets@letsout.app',
        to: data.to,
        subject: `Votre ticket pour ${data.eventName}`,
        html: htmlContent
      })
      console.log(`[DEBUG EMAIL] Resend API response for ${data.to}:`, JSON.stringify(response))
    } catch (err) {
      console.error('[DEBUG EMAIL] Failed to send ticket email:', err)
    }
  }

  // ── Welcome email (Google Sign-In first connection) ────────────────────────
  // Fire-and-forget — never throws, never blocks the login response.
  async sendWelcomeEmail(data: { to: string; displayName: string }): Promise<void> {
    if (!this.resend) {
      console.log(`[DEV EMAIL] Welcome email would be sent to ${data.to} (displayName: ${data.displayName})`)
      return
    }
    try {
      await this.resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Let's Out <noreply@letsout.app>",
        to: data.to,
        subject: "Bienvenue sur Let's Out ! 🎉",
        html: buildWelcomeHtml(data.displayName),
      })
      console.log(`[EmailService] Welcome email sent to ${data.to}`)
    } catch (err) {
      // Log only — never rethrow (must not block login)
      console.error('[EmailService] Failed to send welcome email:', err)
    }
  }

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
        from: process.env.RESEND_FROM_EMAIL || "Let's Out <noreply@letsout.app>",
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

function buildWelcomeHtml(displayName: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur Let's Out</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:20px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
    <div style="background:linear-gradient(135deg,#FF7A00,#FF991C);padding:48px 32px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">🎉</div>
      <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">Bienvenue sur Let's Out !</h1>
    </div>
    <div style="padding:36px 32px;">
      <p style="font-size:18px;font-weight:600;color:#18181b;margin:0 0 12px;">Bonjour ${displayName} 👋</p>
      <p style="color:#52525b;line-height:1.7;margin:0 0 16px;">Votre compte <strong>Let's Out</strong> a été créé avec succès via Google. Vous pouvez maintenant :</p>
      <ul style="color:#52525b;line-height:2;padding-left:20px;margin:0 0 28px;">
        <li>Explorer des événements près de chez vous</li>
        <li>Rencontrer de nouvelles personnes</li>
        <li>Créer et gérer vos propres événements</li>
        <li>Utiliser votre portefeuille Let's Out</li>
      </ul>
      <div style="text-align:center;margin:32px 0 24px;">
        <a href="https://letsout.app" style="display:inline-block;background:#FF7A00;color:#ffffff;text-decoration:none;padding:16px 36px;border-radius:16px;font-weight:700;font-size:16px;">Découvrir Let's Out →</a>
      </div>
      <hr style="border:none;border-top:1px solid #f4f4f5;margin:24px 0;">
      <p style="color:#a1a1aa;font-size:12px;text-align:center;margin:0;">© 2025 Let's Out. Tous droits réservés.<br>Cet email vous a été envoyé car vous avez créé un compte.</p>
    </div>
  </div>
</body>
</html>`
}

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
