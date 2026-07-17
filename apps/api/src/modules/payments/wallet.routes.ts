import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { AuthService } from '../auth/auth.service'

export default async function walletRoutes(app: FastifyInstance) {
  // Middleware to verify wallet PIN token
  const verifyWalletPin = async (req: any, reply: any) => {
    const pinToken = req.headers['x-wallet-pin-token']
    if (!pinToken) return reply.code(403).send({ error: 'Code PIN du portefeuille requis' })
    try {
      const decoded = req.server.jwt.verify(pinToken)
      if (decoded.sub !== req.user.sub || decoded.purpose !== 'wallet_access') {
        throw new Error('Invalid token')
      }
    } catch (e) {
      return reply.code(403).send({ error: 'Session PIN expirée ou invalide. Veuillez saisir votre code PIN.' })
    }
  }

  app.get('/pin/status', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    return reply.send({ isConfigured: !!user?.walletPinHash })
  })

  app.post('/pin/setup', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { pin } = req.body as { pin: string }
    
    if (!pin || pin.length !== 5) return reply.code(400).send({ error: 'Le code PIN doit contenir exactement 5 chiffres' })

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    if (user?.walletPinHash) {
      return reply.code(400).send({ error: 'Un code PIN existe déjà' })
    }

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(pin, salt)

    await app.prisma.user.update({
      where: { id: sub },
      data: { walletPinHash: hash, walletPinSalt: salt }
    })

    const token = app.jwt.sign({ sub, purpose: 'wallet_access' }, { expiresIn: '1h' })
    return reply.send({ success: true, token })
  })

  app.post('/pin/reset/request-otp', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { password, channel = 'sms' } = req.body as { password?: string; channel?: 'sms' | 'whatsapp' }

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    
    if (user?.passwordHash) {
      if (!password) {
        return reply.code(403).send({ error: 'PASSWORD_REQUIRED', message: 'Veuillez saisir votre mot de passe pour réinitialiser le code PIN' })
      }
      const isValid = await bcrypt.compare(password, user.passwordHash)
      if (!isValid) {
        return reply.code(403).send({ error: 'Mot de passe incorrect' })
      }
    }

    if (!user?.phone) {
      return reply.code(400).send({ error: 'Numéro de téléphone introuvable pour envoyer l\'OTP' })
    }

    const authService = new AuthService(app.prisma, app.redis)
    await authService.generateAndSendOtp(user.phone, 'phone', channel)

    return reply.send({ success: true, message: `Un code OTP a été envoyé via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}` })
  })

  app.post('/pin/reset/verify', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { otp, idToken } = req.body as { otp?: string; idToken?: string }

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    if (!user?.phone) return reply.code(400).send({ error: 'Numéro de téléphone introuvable' })

    const authService = new AuthService(app.prisma, app.redis)
    let isValid = false

    if (idToken) {
      isValid = await authService.verifyFirebaseToken(idToken, user.phone)
    } else if (otp) {
      isValid = await authService.verifyOtp(user.phone, otp)
    }

    if (!isValid) {
      return reply.code(403).send({ error: 'Code OTP invalide ou expiré' })
    }

    await app.prisma.user.update({
      where: { id: sub },
      data: { walletPinHash: null, walletPinSalt: null, walletPinAttempts: 0, walletPinLockedUntil: null }
    })

    return reply.send({ success: true })
  })

  app.post('/pin/verify', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { pin } = req.body as { pin: string }

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    if (!user?.walletPinHash) {
      return reply.code(400).send({ error: 'Aucun code PIN configuré' })
    }

    if (user.walletPinLockedUntil && user.walletPinLockedUntil > new Date()) {
      return reply.code(403).send({ error: 'Trop de tentatives échouées. Réessayez plus tard.' })
    }

    const isValid = await bcrypt.compare(pin, user.walletPinHash)
    
    if (!isValid) {
      const attempts = (user.walletPinAttempts || 0) + 1
      const updateData: any = { walletPinAttempts: attempts }
      
      if (attempts >= 3) {
        // Bloquer pour 15 minutes
        updateData.walletPinLockedUntil = new Date(Date.now() + 15 * 60 * 1000)
        updateData.walletPinAttempts = 0
      }
      
      await app.prisma.user.update({ where: { id: sub }, data: updateData })
      return reply.code(403).send({ error: 'Code PIN incorrect' })
    }

    // Réinitialiser les tentatives
    await app.prisma.user.update({ where: { id: sub }, data: { walletPinAttempts: 0, walletPinLockedUntil: null } })

    const token = app.jwt.sign({ sub, purpose: 'wallet_access' }, { expiresIn: '1h' })
    return reply.send({ success: true, token })
  })

  app.post('/pin/change', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { oldPin, newPin } = req.body as { oldPin: string, newPin: string }

    if (!newPin || newPin.length !== 5) return reply.code(400).send({ error: 'Le nouveau code PIN doit contenir exactement 5 chiffres' })

    const user = await app.prisma.user.findUnique({ where: { id: sub } })
    if (!user?.walletPinHash) return reply.code(400).send({ error: 'Aucun code PIN configuré' })

    const isValid = await bcrypt.compare(oldPin, user.walletPinHash)
    if (!isValid) return reply.code(403).send({ error: 'Ancien code PIN incorrect' })

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(newPin, salt)

    await app.prisma.user.update({
      where: { id: sub },
      data: { walletPinHash: hash, walletPinSalt: salt, walletPinAttempts: 0, walletPinLockedUntil: null }
    })

    return reply.send({ success: true })
  })

  // Obtenir le solde et les informations du portefeuille
  app.get('/', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    const wallet = await app.prisma.wallet.upsert({
      where: { userId: sub },
      create: { userId: sub, balance: 0 },
      update: {},
    })

    return reply.send({ data: wallet })
  })

  // Statistiques du portefeuille
  app.get('/stats', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    const wallet = await app.prisma.wallet.findUnique({ where: { userId: sub } })

    let totalEarned = 0;
    let totalWithdrawn = 0;

    if (wallet) {
      const agg = await app.prisma.walletTransaction.groupBy({
        by: ['type'],
        where: { walletId: wallet.id },
        _sum: { amount: true },
      })
      
      const depositAgg = agg.find(a => a.type === 'DEPOSIT')
      if (depositAgg?._sum?.amount) totalEarned = depositAgg._sum.amount
      
      const withdrawAgg = agg.find(a => a.type === 'WITHDRAWAL')
      if (withdrawAgg?._sum?.amount) totalWithdrawn = withdrawAgg._sum.amount
    }

    const now = new Date()
    const activeEventsCount = await app.prisma.event.count({
      where: {
        creatorId: sub,
        status: 'PUBLISHED',
        endAt: { gte: now }
      }
    })

    const poolEvents = await app.prisma.event.findMany({
      where: {
        creatorId: sub,
        poolCollected: { gt: 0 },
        poolReleased: true,
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        city: true,
        coverUrl: true,
        poolCollected: true,
        status: true,
      },
      orderBy: { startAt: 'desc' }
    })

    return reply.send({ 
      data: {
        totalEarned,
        totalWithdrawn,
        activeEventsCount,
        poolEvents
      }
    })
  })

  // Historique des transactions
  app.get('/transactions', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    const wallet = await app.prisma.wallet.findUnique({
      where: { userId: sub },
    })

    if (!wallet) return reply.send({ data: [] })

    const transactions = await app.prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return reply.send({ data: transactions })
  })

  // Retrait (Payout) vers Mobile Money
  app.post('/payout', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }
    const { amount, phone, network } = req.body as { amount: number; phone: string; network: string }

    if (!amount || amount <= 0) return reply.code(400).send({ error: 'Montant invalide' })
    if (!phone) return reply.code(400).send({ error: 'Numéro de téléphone requis' })

    const wallet = await app.prisma.wallet.findUnique({ where: { userId: sub } })
    if (!wallet || wallet.balance < amount) {
      return reply.code(400).send({ error: 'Solde insuffisant' })
    }

    try {
      // MODE DEV: Simuler le succès si pas de clé
      if (!process.env.FEDAPAY_SECRET_KEY) {
        await app.prisma.$transaction([
          app.prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: amount } },
          }),
          app.prisma.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amount,
              type: 'WITHDRAWAL',
              balanceAfter: wallet.balance - amount,
              description: `Retrait Mobile Money (${phone})`,
              refId: phone,
            },
          }),
        ])
        return reply.send({ success: true, message: 'Retrait simulé avec succès' })
      }

      // MODE PROD / SANDBOX: Appeler l'API FedaPay Payouts
      const baseUrl = process.env.FEDAPAY_SECRET_KEY?.startsWith('sk_sandbox_') 
        ? 'https://sandbox-api.fedapay.com/v1' 
        : 'https://api.fedapay.com/v1';

      const payoutRes = await fetch(`${baseUrl}/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
        },
        body: JSON.stringify({
          amount: amount,
          currency: { iso: 'XOF' },
          mode: network, // e.g. 'mtn', 'moov'
          // FedaPay expects the local number without country code
          customer: { phone_number: { number: phone.replace(/^\+229/, '').replace(/^229/, ''), country: 'BJ' } },
          send_now: true,
        }),
      })

      const payoutData = (await payoutRes.json()) as any

      if (!payoutRes.ok || payoutData.error) {
        // Pino logger expects the object as the first argument
        app.log.error({ payoutData }, '[FedaPay Payout Error]')
        const errMsg = payoutData?.message 
          || payoutData?.error?.message 
          || (payoutData?.errors ? Object.values(payoutData.errors).flat().join(', ') : null)
          || 'Erreur lors du transfert FedaPay'
        return reply.code(500).send({ error: errMsg, details: payoutData })
      }

      // Étape 2 : Mettre à jour la base de données
      await app.prisma.$transaction([
        app.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } },
        }),
        app.prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount,
            type: 'WITHDRAWAL',
            balanceAfter: wallet.balance - amount,
            description: `Retrait Mobile Money (${phone})`,
            refId: payoutData.v1?.payout?.id?.toString() || phone,
          },
        }),
      ])

      return reply.send({ success: true, message: 'Retrait initié avec succès' })
    } catch (err: any) {
      app.log.error('[Payout Error]', err)
      return reply.code(500).send({ error: 'Erreur interne lors du retrait' })
    }
  })
}
