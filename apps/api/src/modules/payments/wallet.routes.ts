import type { FastifyInstance } from 'fastify'

export default async function walletRoutes(app: FastifyInstance) {
  // Obtenir le solde et les informations du portefeuille
  app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { sub } = req.user as { sub: string }

    const wallet = await app.prisma.wallet.upsert({
      where: { userId: sub },
      create: { userId: sub, balance: 0 },
      update: {},
    })

    return reply.send({ data: wallet })
  })

  // Historique des transactions
  app.get('/transactions', { preHandler: [app.authenticate] }, async (req, reply) => {
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
  app.post('/payout', { preHandler: [app.authenticate] }, async (req, reply) => {
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

      // MODE PROD: Appeler l'API FedaPay Payouts
      // Étape 1 : Créer le Payout
      const payoutRes = await fetch('https://api.fedapay.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
        },
        body: JSON.stringify({
          amount: amount,
          currency: { iso: 'XOF' },
          mode: network, // par exemple 'mtn', 'moov'
          customer: { phone_number: { number: phone, country: 'BJ' } },
          send_now: true, // Envoyer immédiatement
        }),
      })

      const payoutData = (await payoutRes.json()) as any

      if (!payoutRes.ok || payoutData.error) {
        app.log.error('[FedaPay Payout Error]', payoutData)
        return reply.code(500).send({ error: payoutData.message || payoutData.error?.message || 'Erreur lors du transfert FedaPay' })
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
