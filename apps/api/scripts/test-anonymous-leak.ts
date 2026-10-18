import 'dotenv/config'
import Fastify from 'fastify'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env') })

async function runLeakTest() {
  console.log('🧪 Starting Anonymous Contribution Leak Tests...')

  const app = Fastify()
  await app.register(import('../src/plugins/prisma'))
  await app.register(import('../src/plugins/jwt'))
  await app.register(import('../src/modules/events/events.routes'), { prefix: '/events' })
  await app.register(import('../src/modules/payments/event-payout.routes'), { prefix: '/events' })
  await app.register(import('../src/modules/admin/admin.routes'), { prefix: '/admin' })
  await app.ready()

  const prisma = app.prisma

  const secretId = `test_secret_user_${Date.now()}`
  const secretDisplayName = `SecretDonor_${Date.now()}`
  const secretAvatar = `https://example.com/avatars/secret_${Date.now()}.jpg`
  const secretPhone = `+22997${String(Date.now()).slice(-6)}`

  // 1. Create a creator and an anonymous contributor
  const creator = await prisma.user.create({
    data: {
      phone: `+22996${String(Date.now()).slice(-6)}`,
      role: 'USER',
      profile: {
        create: {
          displayName: 'Event Organizer',
          username: `organizer_${Date.now()}`,
        }
      }
    }
  })

  const anonymousDonor = await prisma.user.create({
    data: {
      id: secretId,
      phone: secretPhone,
      role: 'USER',
      profile: {
        create: {
          displayName: secretDisplayName,
          username: `anon_${Date.now()}`,
          avatarUrl: secretAvatar,
        }
      }
    }
  })

  const adminUser = await prisma.user.create({
    data: {
      phone: `+22999${String(Date.now()).slice(-6)}`,
      role: 'ADMIN',
      profile: {
        create: {
          displayName: 'Admin Inspector',
          username: `admin_${Date.now()}`,
        }
      }
    }
  })

  // 2. Create test event with pool
  const testEvent = await prisma.event.create({
    data: {
      title: `Leak Test Pool Event ${Date.now()}`,
      description: 'Testing anonymous contribution data isolation',
      category: 'OTHER' as any,
      creatorId: creator.id,
      poolTarget: 50000,
      poolMinAmount: 500,
      poolMode: 'libre',
      poolCollected: 15000,
      startAt: new Date(Date.now() + 86400000),
      endAt: new Date(Date.now() + 172800000),
    }
  })

  // 3. Create an anonymous direct payment
  const anonymousPayment = await prisma.payment.create({
    data: {
      userId: anonymousDonor.id,
      eventId: testEvent.id,
      amount: 15000,
      status: 'SUCCEEDED',
      isAnonymous: true,
      currency: 'XOF',
    }
  })

  try {
    console.log('\n--- 1. Testing GET /events/:id/attendees ---')
    const resAttendees = await app.inject({
      method: 'GET',
      url: `/events/${testEvent.id}/attendees`
    })

    if (resAttendees.statusCode !== 200) {
      throw new Error(`Attendees request failed with status ${resAttendees.statusCode}: ${resAttendees.body}`)
    }

    const rawAttendees = resAttendees.body

    // Assert NO identity leakage in raw JSON
    if (rawAttendees.includes(secretId)) {
      throw new Error(`❌ LEAK DETECTED: secretId (${secretId}) found in attendees JSON!`)
    }
    if (rawAttendees.includes(secretDisplayName)) {
      throw new Error(`❌ LEAK DETECTED: secretDisplayName (${secretDisplayName}) found in attendees JSON!`)
    }
    if (rawAttendees.includes(secretAvatar)) {
      throw new Error(`❌ LEAK DETECTED: secretAvatar (${secretAvatar}) found in attendees JSON!`)
    }
    if (rawAttendees.includes(secretPhone)) {
      throw new Error(`❌ LEAK DETECTED: secretPhone (${secretPhone}) found in attendees JSON!`)
    }

    if (!rawAttendees.includes('Contribution anonyme')) {
      throw new Error('❌ Missing "Contribution anonyme" line in attendees JSON')
    }
    if (!rawAttendees.includes('15000')) {
      throw new Error('❌ Missing payment amount 15000 in attendees JSON')
    }

    console.log('✅ Attendees JSON passed: Zero identity leaks, "Contribution anonyme" properly rendered with amount 15,000 F.')

    console.log('\n--- 2. Testing GET /events/:id/payout/status ---')
    const creatorToken = app.jwt.sign({ sub: creator.id, role: 'USER' })
    const resPayout = await app.inject({
      method: 'GET',
      url: `/events/${testEvent.id}/payout/status`,
      headers: {
        authorization: `Bearer ${creatorToken}`
      }
    })

    if (resPayout.statusCode !== 200) {
      throw new Error(`Payout status request failed with status ${resPayout.statusCode}: ${resPayout.body}`)
    }

    const rawPayout = resPayout.body

    // Assert NO identity leakage in payout status JSON
    if (rawPayout.includes(secretId)) {
      throw new Error(`❌ LEAK DETECTED: secretId (${secretId}) found in payout/status JSON!`)
    }
    if (rawPayout.includes(secretDisplayName)) {
      throw new Error(`❌ LEAK DETECTED: secretDisplayName (${secretDisplayName}) found in payout/status JSON!`)
    }
    if (rawPayout.includes(secretAvatar)) {
      throw new Error(`❌ LEAK DETECTED: secretAvatar (${secretAvatar}) found in payout/status JSON!`)
    }

    const payoutData = JSON.parse(rawPayout).data
    if (payoutData.directDonationsTotal !== 15000) {
      throw new Error(`Expected directDonationsTotal 15000, got ${payoutData.directDonationsTotal}`)
    }
    if (payoutData.directDonationsCount !== 1) {
      throw new Error(`Expected directDonationsCount 1, got ${payoutData.directDonationsCount}`)
    }

    console.log('✅ Payout status JSON passed: Zero identity leaks, directDonationsTotal=15,000 and directDonationsCount=1.')

    console.log('\n--- 3. Testing Admin Identity Inspection & AuditLog ---')
    const adminToken = app.jwt.sign({ sub: adminUser.id, role: 'ADMIN' })

    const resAdmin = await app.inject({
      method: 'GET',
      url: `/admin/payments/${anonymousPayment.id}/anonymous-identity`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    })

    if (resAdmin.statusCode !== 200) {
      throw new Error(`Admin inspection failed with status ${resAdmin.statusCode}: ${resAdmin.body}`)
    }

    const adminBody = JSON.parse(resAdmin.body)
    if (adminBody.user?.id !== secretId) {
      throw new Error(`Expected admin to receive donor userId ${secretId}, got ${adminBody.user?.id}`)
    }

    // Verify AuditLog record was written
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        action: 'ANONYMOUS_IDENTITY_VIEWED' as any,
        targetId: anonymousPayment.id,
        actorId: adminUser.id
      }
    })

    if (!auditRecord) {
      throw new Error('❌ Missing AuditLog entry for ANONYMOUS_IDENTITY_VIEWED!')
    }

    console.log('✅ Admin inspection and AuditLog passed: Identity retrieved securely by Admin and logged in AuditLog.')

    console.log('\n🏆 ALL CHECKS PASSED SUCCESSFULLY WITHOUT ERROR!')
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test records...')
    await prisma.auditLog.deleteMany({ where: { targetId: anonymousPayment.id } }).catch(() => {})
    await prisma.payment.deleteMany({ where: { id: anonymousPayment.id } }).catch(() => {})
    await prisma.event.deleteMany({ where: { id: testEvent.id } }).catch(() => {})
    await prisma.profile.deleteMany({ where: { userId: { in: [creator.id, anonymousDonor.id, adminUser.id] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [creator.id, anonymousDonor.id, adminUser.id] } } }).catch(() => {})
    await app.close()
    await prisma.$disconnect()
  }
}

runLeakTest().catch((err) => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
