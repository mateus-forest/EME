import { expect, test } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { config as loadEnv } from 'dotenv'
import { Pool } from 'pg'

loadEnv({ path: '.env.local', override: false })
loadEnv({ path: '.env', override: false })

const FIXTURE_EMAIL = 'marketplace-e2e@eme.test'
const FIXTURE_SLUG = 'marketplace-e2e-corretor'
const FIXTURE_PASSWORD = 'Marketplace-e2e-2026'
const shouldRun = process.env.RUN_MARKETPLACE_DB_E2E === '1'

test.describe('Marketplace integrado ao EME', () => {
  test.skip(!shouldRun, 'Defina RUN_MARKETPLACE_DB_E2E=1 para executar contra o banco de testes configurado.')
  test.setTimeout(120_000)

  let pool: Pool
  let prisma: PrismaClient
  let brokerId = ''
  let propertyIds: string[] = []

  async function removeFixture() {
    const broker = await prisma.broker.findUnique({ where: { catalogSlug: FIXTURE_SLUG }, select: { id: true, userId: true } })
    const user = await prisma.user.findUnique({ where: { email: FIXTURE_EMAIL }, select: { id: true, broker: { select: { id: true } } } })
    const fixtureBrokerId = broker?.id || user?.broker?.id
    const fixtureUserId = user?.id || broker?.userId

    if (fixtureBrokerId) {
      await prisma.catalogEvent.deleteMany({ where: { brokerId: fixtureBrokerId } })
      await prisma.lead.deleteMany({ where: { brokerId: fixtureBrokerId, source: 'marketplace' } })
      await prisma.catalog.deleteMany({ where: { ownerType: 'BROKER', ownerId: fixtureBrokerId } })
    }
    if (fixtureUserId) await prisma.user.delete({ where: { id: fixtureUserId } })
  }

  test.beforeAll(async () => {
    if (!shouldRun) return
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await removeFixture()

    const passwordHash = await hash(FIXTURE_PASSWORD, 10)
    const user = await prisma.user.create({
      data: {
        name: 'Corretora Integração EME',
        email: FIXTURE_EMAIL,
        passwordHash,
        role: 'BROKER',
        phone: '5554999991234',
        broker: {
          create: {
            phone: '5554999991234',
            catalogSlug: FIXTURE_SLUG,
            status: 'ACTIVE',
            creci: '99999-F',
            marketplaceSpecialty: 'Casas e apartamentos',
            marketplaceRegion: 'Vacaria e região',
            marketplaceTransactions: 'BOTH',
            marketplaceAbout: 'Atendimento consultivo para compra e locação.',
          },
        },
      },
      include: { broker: true },
    })
    brokerId = user.broker!.id
    await prisma.catalog.create({ data: { slug: FIXTURE_SLUG, ownerType: 'BROKER', ownerId: brokerId } })

    const commonLegalData = { city: 'Vacaria', state: 'RS', district: 'Centro', privateArea: '120' }
    const records = await Promise.all([
      prisma.property.create({ data: { publicCode: 98001, title: 'Casa Integração Marketplace', description: 'Casa pronta para morar com pátio amplo no Centro.', price: 72000000, city: 'Vacaria', neighborhood: 'Centro', bedrooms: 3, bathrooms: 2, parkingSpots: 2, type: 'HOUSE', purpose: 'SALE', status: 'DRAFT', published: false, imageUrls: ['/marketplace/placeholder.svg'], legalData: commonLegalData, brokerId } }),
      prisma.property.create({ data: { publicCode: 98002, title: 'Apartamento Integração Marketplace', description: 'Apartamento novo e pronto para morar no Centro.', price: 61000000, city: 'Vacaria', neighborhood: 'Centro', bedrooms: 2, bathrooms: 2, parkingSpots: 1, type: 'APARTMENT', purpose: 'SALE', status: 'DRAFT', published: false, imageUrls: ['/marketplace/placeholder.svg'], legalData: { ...commonLegalData, privateArea: '88' }, brokerId } }),
      prisma.property.create({ data: { publicCode: 98003, title: 'Casa para Alugar Integração', description: 'Casa mobiliada para locação com quintal.', price: 350000, city: 'Vacaria', neighborhood: 'Bela Vista', bedrooms: 2, bathrooms: 1, parkingSpots: 1, type: 'HOUSE', purpose: 'RENT', status: 'DRAFT', published: false, imageUrls: ['/marketplace/placeholder.svg'], legalData: { ...commonLegalData, district: 'Bela Vista', privateArea: '95' }, brokerId } }),
    ])
    propertyIds = records.map((property) => property.id)
  })

  test.afterAll(async () => {
    if (!shouldRun || !prisma) return
    await removeFixture()
    await prisma.$disconnect()
    await pool.end()
  })

  test('publica imóveis sem alterar o catálogo e percorre imóvel, corretor, comparação e lead', async ({ page }) => {
    const login = await page.request.post('/api/auth/login', {
      data: { method: 'password', email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD },
    })
    expect(login.ok()).toBe(true)

    const configured = await page.request.patch('/api/brokers/catalog', {
      data: {
        slug: FIXTURE_SLUG,
        displayName: 'Corretora Integração EME',
        specialty: 'Residencial e primeiro imóvel',
        region: 'Vacaria e região',
        transactions: 'BOTH',
        about: 'Atendimento consultivo para encontrar o imóvel adequado.',
      },
    })
    expect(configured.ok()).toBe(true)

    const unavailableCatalog = await page.request.get('/api/brokers/catalog')
    const unavailableSettings = await unavailableCatalog.json()
    expect(unavailableSettings.settings.marketplaceProfileAvailable).toBe(false)
    await page.goto('/corretor/catalogo')
    await expect(page.getByRole('button', { name: /Ver no Marketplace/ })).toBeDisabled()

    const slugs: string[] = []
    for (const propertyId of propertyIds) {
      const response = await page.request.patch(`/api/properties/${propertyId}/marketplace`, { data: { published: true } })
      expect(response.ok()).toBe(true)
      const data = await response.json()
      expect(data.property.published).toBe(false)
      expect(data.property.marketplacePublished).toBe(true)
      slugs.push(data.property.marketplaceSlug)
    }

    const catalogResponse = await page.request.get('/api/brokers/catalog')
    const catalog = await catalogResponse.json()
    expect(catalog.settings.activeListings).toBe(3)
    expect(catalog.settings.specialty).toBe('Residencial e primeiro imóvel')
    expect(catalog.settings.marketplaceProfileAvailable).toBe(true)

    await page.goto('/corretor/catalogo')
    const marketplaceProfileLink = page.getByRole('link', { name: /Ver no Marketplace/ })
    await expect(marketplaceProfileLink).toHaveAttribute('href', `/imoveis/corretores/${FIXTURE_SLUG}`)
    await expect(marketplaceProfileLink).toHaveAttribute('target', '_blank')

    await page.goto('/imoveis/busca?finalidade=compra')
    await expect(page.getByText('Casa Integração Marketplace').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('results-area').getByText('Casa para Alugar Integração')).toHaveCount(0)
    await page.goto('/imoveis/busca?q=casa%20com%20p%C3%A1tio%20no%20centro%20at%C3%A9%20R%24%20750%20mil')
    await expect(page.getByText('Casa Integração Marketplace').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Perto do centro').first()).toBeVisible()
    await expect(page.getByText('Pátio').first()).toBeVisible()
    await expect(page.getByText('Até R$ 750.000').first()).toBeVisible()
    await page.reload()
    await expect(page.getByText('Perto do centro').first()).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => prisma.searchEvent.count({ where: { brokerId, source: 'marketplace' } })).toBeGreaterThan(0)

    await page.getByRole('link', { name: 'Casa Integração Marketplace', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/imoveis/imovel/${slugs[0]}$`))
    await expect(page.getByText('Corretora Integração EME').first()).toBeVisible()

    await page.getByRole('button', { name: 'Tenho interesse' }).first().click()
    const dialog = page.getByRole('dialog', { name: /Tenho interesse/ })
    await dialog.getByLabel('Seu nome').fill('Cliente Marketplace E2E')
    await dialog.getByLabel('WhatsApp').fill('(54) 98888-7777')
    const leadResponse = page.waitForResponse((response) => response.url().endsWith('/api/leads') && response.request().method() === 'POST')
    await dialog.getByRole('button', { name: 'Continuar pelo WhatsApp' }).click()
    expect((await leadResponse).status()).toBe(201)
    await expect(dialog.getByRole('link', { name: 'Abrir WhatsApp' })).toBeVisible()

    const lead = await prisma.lead.findFirst({ where: { name: 'Cliente Marketplace E2E' }, orderBy: { createdAt: 'desc' } })
    expect(lead).toMatchObject({ source: 'marketplace', brokerId, propertyId: propertyIds[0] })
    await expect.poll(async () => prisma.catalogEvent.count({ where: { brokerId, source: 'marketplace', eventType: 'lead', propertyId: propertyIds[0] } })).toBeGreaterThan(0)
    await expect.poll(async () => prisma.catalogEvent.count({ where: { brokerId, source: 'marketplace', eventType: 'property_view', propertyId: propertyIds[0] } })).toBeGreaterThan(0)

    await page.goto(`/imoveis/corretores/${FIXTURE_SLUG}`)
    await expect(page.getByText('Residencial e primeiro imóvel').first()).toBeVisible()
    const activeListingsStat = page.getByText('Imóveis ativos').locator('..')
    await expect(activeListingsStat.getByText('3', { exact: true })).toBeVisible()

    await page.goto('/imoveis/corretores')
    await expect(page.getByRole('button', { name: '4,8+' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Corretores em destaque' })).toHaveCount(0)

    await page.goto(`/imoveis/comparar?imoveis=${slugs.join(',')}`)
    await expect(page.getByRole('heading', { name: 'Análise da comparação' })).toBeVisible()
    await expect(page.getByText(/menor valor por m²/i).first()).toBeVisible()

    const removed = await page.request.patch(`/api/properties/${propertyIds[0]}/marketplace`, { data: { published: false } })
    expect(removed.ok()).toBe(true)
    const stored = await prisma.property.findUnique({ where: { id: propertyIds[0] }, select: { published: true, marketplacePublished: true } })
    expect(stored).toEqual({ published: false, marketplacePublished: false })
  })
})
