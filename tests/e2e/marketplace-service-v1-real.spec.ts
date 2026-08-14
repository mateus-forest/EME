import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'

loadEnv({ path: '.env.local', override: false })
loadEnv({ path: '.env', override: false })

const BROKER_EMAIL = 'marketplace-v1-broker@eme.test'
const ADMIN_EMAIL = 'marketplace-v1-admin@eme.test'
const PASSWORD = 'Marketplace-v1-2026'
const BROKER_SLUG = 'marketplace-v1-corretor'
const PROPERTY_SLUG = 'marketplace-v1-imovel'
const shouldRun = process.env.RUN_MARKETPLACE_DB_E2E === '1'

test.describe('Marketplace atendimento e avaliações V1 reais', () => {
  test.skip(!shouldRun, 'Defina RUN_MARKETPLACE_DB_E2E=1 para executar contra o banco de testes configurado.')
  test.setTimeout(180_000)

  let pool: Pool
  let prisma: PrismaClient
  let brokerId = ''
  let propertyId = ''
  let leadId = ''

  async function cleanup() {
    const users = await prisma.user.findMany({ where: { email: { in: [BROKER_EMAIL, ADMIN_EMAIL] } }, select: { id: true } })
    for (const user of users) await prisma.user.delete({ where: { id: user.id } })
  }

  test.beforeAll(async () => {
    if (!shouldRun) return
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()
    const passwordHash = await hash(PASSWORD, 10)
    const brokerUser = await prisma.user.create({
      data: {
        name: 'Corretora V1 EME', email: BROKER_EMAIL, passwordHash, role: 'BROKER', phone: '5554999991234',
        broker: { create: { phone: '5554999991234', catalogSlug: BROKER_SLUG, status: 'ACTIVE', creci: '98765-F', marketplaceSpecialty: 'Residencial', marketplaceRegion: 'Vacaria', marketplaceTransactions: 'BOTH' } },
      },
      include: { broker: true },
    })
    brokerId = brokerUser.broker!.id
    await prisma.user.create({ data: { name: 'Admin Marketplace V1', email: ADMIN_EMAIL, passwordHash, role: 'ADMIN', phone: '5554999990000' } })
    const property = await prisma.property.create({
      data: {
        brokerId, publicCode: 98901, title: 'Apartamento V1 Marketplace', description: 'Apartamento publicado para teste controlado.', price: 55000000, city: 'Vacaria', neighborhood: 'Centro', bedrooms: 2, bathrooms: 1, parkingSpots: 1, type: 'APARTMENT', purpose: 'SALE', status: 'PUBLISHED', published: false, marketplacePublished: true, marketplacePublishedAt: new Date(), marketplaceSlug: PROPERTY_SLUG, imageUrls: ['/marketplace/placeholder.svg'],
      },
    })
    propertyId = property.id
    const lead = await prisma.lead.create({ data: { brokerId, propertyId, name: 'Cliente Verificado V1', phone: '54988887777', whatsapp: '54988887777', source: 'marketplace_chat', status: 'NEW' } })
    leadId = lead.id
  })

  test.afterAll(async () => {
    if (!shouldRun || !prisma) return
    await cleanup()
    await prisma.$disconnect()
    await pool.end()
  })

  test('persiste cards, vincula avaliações, bloqueia duplicidade e modera apenas como admin', async ({ page }) => {
    const brokerLogin = await page.request.post('/api/auth/login', { data: { method: 'password', email: BROKER_EMAIL, password: PASSWORD } })
    expect(brokerLogin.ok()).toBe(true)

    const conversationResponse = await page.request.post('/api/marketplace/conversations', { data: { brokerSlug: BROKER_SLUG, propertyId, customerName: 'Cliente Verificado V1', customerPhone: '54988887777', message: 'Gostaria de receber os detalhes.' } })
    expect(conversationResponse.status()).toBe(201)
    const conversation = (await conversationResponse.json()).conversation
    const proposal = await prisma.brokerDocument.create({ data: { brokerId, leadId, propertyId, type: 'proposal', title: 'Proposta compatível V1', content: '<p>Proposta V1</p>', status: 'generated' } })

    const optionsResponse = await page.request.get(`/api/brokers/marketplace/conversations/${conversation.id}`)
    expect(optionsResponse.ok()).toBe(true)
    const options = await optionsResponse.json()
    expect(options.properties).toEqual(expect.arrayContaining([expect.objectContaining({ id: propertyId, title: 'Apartamento V1 Marketplace' })]))
    expect(options.proposals).toEqual(expect.arrayContaining([expect.objectContaining({ id: proposal.id, title: 'Proposta compatível V1' })]))
    expect((await page.request.post(`/api/brokers/marketplace/conversations/${conversation.id}`, { data: { kind: 'PROPERTY', referenceId: propertyId } })).ok()).toBe(true)
    expect((await page.request.post(`/api/brokers/marketplace/conversations/${conversation.id}`, { data: { kind: 'PROPOSAL', referenceId: proposal.id } })).ok()).toBe(true)

    const publicConversation = (await (await page.request.get(`/api/marketplace/conversations/${conversation.token}`)).json()).conversation
    expect(publicConversation.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'PROPERTY', metadata: expect.objectContaining({ propertyId, title: 'Apartamento V1 Marketplace' }) }),
      expect.objectContaining({ kind: 'PROPOSAL', metadata: expect.objectContaining({ proposalId: proposal.id, title: 'Proposta compatível V1' }) }),
    ]))

    expect((await page.request.patch(`/api/brokers/marketplace/conversations/${conversation.id}`, { data: { action: 'close', requestReview: true } })).ok()).toBe(true)
    const postChatResponse = await page.request.post('/api/marketplace/reviews', { data: { token: conversation.token, rating: 4, comment: 'Bom' } })
    expect(postChatResponse.status()).toBe(201)
    const postChatReview = await prisma.marketplaceReview.findUnique({ where: { conversationId: conversation.id } })
    expect(postChatReview).toMatchObject({ brokerId, leadId, authorPhone: '54988887777', rating: 4, comment: 'Bom', origin: 'POST_CHAT', verified: true, status: 'PENDING_REVIEW' })
    expect((await page.request.post('/api/marketplace/reviews', { data: { token: conversation.token, rating: 5, comment: 'Outra' } })).status()).toBe(409)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/imoveis/corretores/${BROKER_SLUG}`)
    await page.getByRole('button', { name: 'Avaliar atendimento' }).click()
    const reviewDialog = page.getByRole('dialog', { name: 'Como foi o atendimento?' })
    await reviewDialog.getByLabel('Nome').fill('Cliente Público V1')
    await reviewDialog.getByLabel('Telefone/WhatsApp').fill('(54) 97777-6666')
    await reviewDialog.getByRole('button', { name: '5 estrelas' }).click()
    await reviewDialog.getByLabel('Comentário').fill('Excelente')
    await reviewDialog.getByText('Confirmo que fui atendido por este profissional.').click()
    const viewport = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
    expect(viewport.scroll).toBeLessThanOrEqual(viewport.client + 1)
    const publicReviewResponse = page.waitForResponse((response) => response.url().endsWith('/api/marketplace/reviews') && response.request().method() === 'POST')
    await reviewDialog.getByRole('button', { name: 'Enviar avaliação' }).click()
    expect((await publicReviewResponse).status()).toBe(201)
    await expect(reviewDialog.getByText('Avaliação enviada para moderação')).toBeVisible()
    const profileReview = await prisma.marketplaceReview.findFirst({ where: { brokerId, authorPhone: '54977776666' } })
    expect(profileReview).toMatchObject({ origin: 'PUBLIC_PROFILE', verified: false, attendanceConfirmed: true, status: 'PENDING_REVIEW' })
    expect((await page.request.post('/api/marketplace/reviews', { data: { brokerSlug: BROKER_SLUG, authorName: 'Cliente Público V1', authorPhone: '54977776666', rating: 5, comment: 'Repetida', attendanceConfirmed: true } })).status()).toBe(409)

    const profileLead = await prisma.lead.create({ data: { brokerId, propertyId, name: 'Cliente Lead V1', phone: '54966665555', whatsapp: '54966665555', source: 'marketplace', status: 'CONTACTED' } })
    const linkedReviewResponse = await page.request.post('/api/marketplace/reviews', { data: { brokerSlug: BROKER_SLUG, authorName: 'Cliente Lead V1', authorPhone: '54966665555', rating: 5, comment: 'Atendimento verificado pelo lead.', attendanceConfirmed: true } })
    expect(linkedReviewResponse.status()).toBe(201)
    const linkedReview = await prisma.marketplaceReview.findFirst({ where: { brokerId, authorPhone: '54966665555' } })
    expect(linkedReview).toMatchObject({ leadId: profileLead.id, origin: 'PUBLIC_PROFILE', verified: true, status: 'PENDING_REVIEW' })

    const brokerCannotModerate = await page.request.patch(`/api/admin/marketplace/reviews/${profileReview!.id}`, { data: { status: 'APPROVED' } })
    expect(brokerCannotModerate.status()).toBe(403)

    const adminLogin = await page.request.post('/api/auth/login', { data: { method: 'password', email: ADMIN_EMAIL, password: PASSWORD } })
    expect(adminLogin.ok()).toBe(true)
    const queueResponse = await page.request.get('/api/admin/marketplace/reviews?status=PENDING_REVIEW')
    expect(queueResponse.ok()).toBe(true)
    const queue = (await queueResponse.json()).reviews
    expect(queue).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: postChatReview!.id, authorPhone: '54988887777', origin: 'POST_CHAT', verified: true, conversation: expect.objectContaining({ id: conversation.id }), lead: expect.objectContaining({ id: leadId }) }),
      expect.objectContaining({ id: profileReview!.id, authorPhone: '54977776666', origin: 'PUBLIC_PROFILE', verified: false, conversation: null, lead: null }),
      expect.objectContaining({ id: linkedReview!.id, authorPhone: '54966665555', origin: 'PUBLIC_PROFILE', verified: true, conversation: null, lead: expect.objectContaining({ id: profileLead.id }) }),
    ]))
    expect((await page.request.patch(`/api/admin/marketplace/reviews/${linkedReview!.id}`, { data: { status: 'APPROVED' } })).ok()).toBe(true)
    expect((await page.request.patch(`/api/admin/marketplace/reviews/${postChatReview!.id}`, { data: { status: 'REJECTED', reason: 'Motivo controlado V1' } })).ok()).toBe(true)
    const [approved, rejected, broker] = await Promise.all([
      prisma.marketplaceReview.findUnique({ where: { id: linkedReview!.id } }),
      prisma.marketplaceReview.findUnique({ where: { id: postChatReview!.id } }),
      prisma.broker.findUnique({ where: { id: brokerId } }),
    ])
    expect(approved?.status).toBe('APPROVED')
    expect(rejected).toMatchObject({ status: 'REJECTED', rejectionReason: 'Motivo controlado V1' })
    expect(broker?.marketplaceReviewCount).toBe(1)
    expect(Number(broker?.marketplaceRating)).toBe(5)
    await page.goto(`/imoveis/corretores/${BROKER_SLUG}`)
    await expect(page.getByText('Atendimento verificado pelo lead.')).toBeVisible()
    await expect(page.getByText('(54) 96666-5555')).toHaveCount(0)
  })
})
