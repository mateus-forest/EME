import { expect, test, type Page } from '@playwright/test'
import { loginAsBroker } from './helpers/auth'

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
}

const broker = {
  id: 'broker-1', slug: 'corretor-real', name: 'Corretora Real', creci: 'CRECI 12345-F', region: 'Centro', regionSlug: 'centro', specialty: 'Residencial', about: 'Atendimento consultivo.', phone: '5554999999999', image: '/marketplace/placeholder-user.jpg', activeListings: 2, rating: 4.8, reviewCount: 5, reviews: [], featured: false, verified: true, transaction: 'ambos', propertyTypes: [],
}

test.describe('Comunicação e descoberta do Marketplace', () => {
  test('filtros rápidos abrem fora da faixa rolável e aplicam valor, quartos e área', async ({ page }) => {
    await page.goto('/imoveis/busca')
    for (const label of ['Faixa de valor', 'Quartos', 'Área']) {
      await page.getByRole('button', { name: label }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await page.getByRole('button', { name: 'Quartos' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '3+' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('button', { name: '3+ quartos', exact: true })).toBeVisible()
  })

  test('pedido de ajuda pesquisa corretores e não usa envio demonstrativo', async ({ page }) => {
    await page.route('**/api/marketplace/broker-matches', (route) => route.fulfill({ json: { matches: [{ broker, score: 77, reasons: ['Atua em Centro', '2 imóveis ativos compatíveis'], compatibleListings: 2 }] } }))
    await page.goto('/imoveis/busca')
    await page.getByRole('button', { name: 'Quero ajuda para encontrar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Pesquisar corretores' })
    await dialog.getByLabel('Nome').fill('Cliente Teste')
    await dialog.getByLabel('Telefone/WhatsApp').fill('(54) 99999-9999')
    await dialog.getByLabel('Localização').fill('Centro')
    await dialog.getByLabel('Resumo da busca').fill('Apartamento com 2 quartos para comprar')
    await expect(dialog.getByRole('button', { name: 'Enviar pedido' })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Pesquisar corretores' }).click()
    await expect(dialog.getByText('Corretora Real')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Falar agora' })).toBeVisible()
  })

  test('área Marketplace do corretor usa perfil real e mantém conversas em mobile', async ({ page }) => {
    await loginAsBroker(page)
    await page.route('**/api/brokers/marketplace', (route) => route.fulfill({ json: { profile: broker, settings: { slug: broker.slug, displayName: broker.name, photoUrl: broker.image, specialty: broker.specialty, region: broker.region, transactions: 'BOTH', about: broker.about }, publicPath: `/imoveis/corretores/${broker.slug}`, properties: [{ id: 'property-1', title: 'Apartamento real', marketplaceSlug: 'apartamento-real', purpose: 'SALE', price: 500000, city: 'Centro', image: '/marketplace/placeholder.svg' }], leads: [{ id: 'lead-1', name: 'Cliente Real', phone: '5554999999999', intent: 'Compra', status: 'NEW', createdAt: new Date().toISOString() }], counts: { conversations: 1, properties: 1, leads: 1, reviews: { PENDING_REVIEW: 1 } } } }))
    await page.route('**/api/brokers/marketplace/conversations', (route) => route.fulfill({ json: { conversations: [{ id: 'conversation-1', customerName: 'Cliente Real', customerPhone: '5554999999999', status: 'OPEN', property: { title: 'Apartamento real' }, lastMessageAt: new Date().toISOString(), reviewRequestedAt: null, messages: [{ id: 'message-1', sender: 'CUSTOMER', body: 'Gostaria de visitar.', createdAt: new Date().toISOString() }] }] } }))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/corretor/marketplace')
    await expect(page.getByRole('heading', { name: 'Seu atendimento público em um só lugar' })).toBeVisible()
    await expect(page.getByText('Corretora Real').first()).toBeVisible()
    await expect(page.getByText('Gostaria de visitar.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver perfil público' })).toHaveAttribute('href', `/imoveis/corretores/${broker.slug}`)
    await expectNoHorizontalOverflow(page)
  })
})
