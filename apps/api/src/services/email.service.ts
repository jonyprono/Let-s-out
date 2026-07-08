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
      await this.resend.emails.send({
        from: 'Let\'s Out <tickets@letsout.app>', // Mettez votre domaine vérifié ici
        to: data.to,
        subject: `Votre ticket pour ${data.eventName}`,
        html: htmlContent
      })
      console.log(`Ticket email sent successfully to ${data.to}`)
    } catch (err) {
      console.error('Failed to send ticket email:', err)
    }
  }
}
