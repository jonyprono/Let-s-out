const fs = require('fs');
let content = fs.readFileSync('c:/Users/carlo/Desktop/Lets out/apps/api/src/modules/payments/wallet.routes.ts', 'utf8');

const importBcrypt = `import bcrypt from 'bcryptjs'\n`;
if (!content.includes('bcryptjs')) {
  content = importBcrypt + content;
}

const authPinMiddleware = `
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

    const token = app.jwt.sign({ sub, purpose: 'wallet_access' }, { expiresIn: '15m' })
    return reply.send({ success: true, token })
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

    const token = app.jwt.sign({ sub, purpose: 'wallet_access' }, { expiresIn: '15m' })
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
`;

if (!content.includes('verifyWalletPin')) {
  content = content.replace('export default async function walletRoutes(app: FastifyInstance) {', 'export default async function walletRoutes(app: FastifyInstance) {' + authPinMiddleware);
}

// Secure the existing routes
content = content.replace(
  `app.get('/', { preHandler: [app.authenticate] }, async (req, reply) => {`,
  `app.get('/', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {`
);

content = content.replace(
  `app.get('/transactions', { preHandler: [app.authenticate] }, async (req, reply) => {`,
  `app.get('/transactions', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {`
);

content = content.replace(
  `app.post('/payout', { preHandler: [app.authenticate] }, async (req, reply) => {`,
  `app.post('/payout', { preHandler: [app.authenticate, verifyWalletPin] }, async (req, reply) => {`
);

fs.writeFileSync('c:/Users/carlo/Desktop/Lets out/apps/api/src/modules/payments/wallet.routes.ts', content);
