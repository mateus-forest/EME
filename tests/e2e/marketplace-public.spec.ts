import { expect, test, type Page } from '@playwright/test'

import { loginAsBroker } from './helpers/auth'

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
}

test.describe('Marketplace público', () => {
  test.setTimeout(90_000)

  test('filtros claros usam máscara BRL e persistem valores numéricos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')
    await page.getByRole('button', { name: 'Buscar por filtros' }).click()
    const dialog = page.getByRole('dialog', { name: 'Buscar por filtros' })
    const minimum = dialog.getByLabel('Mínimo')
    const maximum = dialog.getByLabel('Máximo')
    await minimum.fill('7500')
    await maximum.fill('1200000')
    await expect(minimum).toHaveValue(/R\$\s*7\.500/)
    await expect(maximum).toHaveValue(/R\$\s*1\.200\.000/)
    await dialog.getByRole('button', { name: 'Ver imóveis' }).click()
    await expect(page).toHaveURL(/precoMin=7500/)
    await expect(page).toHaveURL(/precoMax=1200000/)
  })

  test('preserva intenções na URL, chips, refresh e ajuste de busca', async ({ page }) => {
    await page.goto('/imoveis/busca?finalidade=aluguel&intencao=perto-do-trabalho,pronto-para-morar')
    await expect(page.getByText('Alugar').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Perto do trabalho').first()).toBeVisible()
    await expect(page.getByText('Pronto para morar').first()).toBeVisible()
    await page.reload()
    await expect(page.getByText('Perto do trabalho').first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('region', { name: 'Interpretação da busca' }).getByRole('button', { name: 'Ajustar busca' }).click()
    const dialog = page.getByRole('dialog', { name: 'Ajustar busca' })
    await expect(dialog.getByRole('button', { name: 'Perto do trabalho' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('rota de comparação não injeta imóveis demonstrativos', async ({ page }) => {
    await page.goto('/imoveis/comparar')
    await expect(page.getByRole('heading', { name: /Selecione pelo menos dois/ })).toBeVisible()
  })

  test('corretores não exibem métricas demonstrativas', async ({ page }) => {
    await page.goto('/imoveis/corretores')
    await expect(page.getByRole('heading', { name: 'Todos os corretores' })).toBeVisible()
    await expect(page.getByText('Responde rápido')).toHaveCount(0)
    await expect(page.getByText('Carla Goulart')).toHaveCount(0)
  })

  test('ordenação fica acima do mapa', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis/busca')
    await page.getByRole('button', { name: /Mais compatíveis/ }).click()
    const menu = page.getByRole('dialog').filter({ has: page.getByRole('radio', { name: 'Menor preço' }) })
    const isTop = await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 12)
      return top === element || element.contains(top)
    })
    expect(isTop).toBe(true)
  })

  test('header desktop mantém navegação centralizada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/imoveis')
    const box = await page.getByRole('navigation', { name: 'Navegação principal' }).boundingBox()
    expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(3)
    await expectNoHorizontalOverflow(page)
  })

  test('mobile preserva bottom sheets e mapa sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/imoveis')
    await page.getByRole('button', { name: 'Buscar por filtros' }).click()
    await expect(page.getByRole('dialog', { name: 'Buscar por filtros' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.goto('/imoveis/busca')
    await expect(page.getByRole('tab', { name: 'Lista' })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Mapa' }).click()
    await expectNoHorizontalOverflow(page)
  })

  test('catálogo mantém preview e URL próprios, sem configurações de Marketplace', async ({ page }) => {
    await loginAsBroker(page)
    await page.route('**/api/brokers/me', (route) => route.fulfill({
      json: { profile: { id: 'user-cta', brokerId: 'broker-cta', agencyId: null, agencyName: '', accountType: 'BROKER_INDEPENDENT', name: 'Corretor CTA', email: 'cta@eme.test', phone: '5554999999999', photoUrl: '', creci: '12345-F', description: '', brandColor: '', logoUrl: '', showAgencyWatermark: true, pinConfigured: false } },
    }))
    await page.route('**/api/properties/me', (route) => route.fulfill({ json: { properties: [] } }))
    await page.route('**/api/brokers/catalog', (route) => route.fulfill({
      json: { settings: { slug: 'corretor-cta-real', displayName: 'Corretor CTA', photoUrl: '', description: 'Catálogo real' } },
    }))

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/corretor/catalogo')
    const link = page.getByRole('link', { name: 'Abrir link' })
    await expect(link).toHaveAttribute('href', '/catalogo/corretor-cta-real')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(page.getByRole('heading', { name: 'Preview do catálogo' })).toBeVisible()
    await expect(page.getByText(/Preview no Marketplace|Ver no Marketplace/)).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    await page.setViewportSize({ width: 1440, height: 960 })
    await page.reload()
    const configuration = await page.getByRole('heading', { name: 'Configuração' }).boundingBox()
    const preview = await page.getByRole('heading', { name: 'Preview do catálogo' }).boundingBox()
    expect(preview!.x).toBeGreaterThan(configuration!.x)
    await expectNoHorizontalOverflow(page)
  })

  test('home refina busca, rodapé e ambientes sem conteúdo repetido', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')

    await expect(page.getByPlaceholder('Procuro um apartamento para alugar perto do centro')).toBeVisible()
    await expect(page.getByText('Tecnologia imobiliária', { exact: true })).toBeAttached()

    const explorer = page.getByRole('heading', { name: 'Explore cada detalhe' }).locator('..').locator('..')
    await explorer.getByRole('button', { name: 'Cozinha' }).click()
    await expect(page.getByAltText('Ambiente ilustrativo: Cozinha')).toBeVisible()
    await explorer.getByRole('button', { name: 'Suíte' }).click()
    await expect(page.getByAltText('Ambiente ilustrativo: Suíte')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('Assistente EME abre limpo e usa a busca publicada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')
    await page.getByRole('button', { name: /Assistente EME/ }).first().click()

    const dialog = page.getByRole('dialog', { name: 'Assistente EME' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Procuro uma casa em Vacaria/)).toHaveCount(0)
    await dialog.getByLabel('Conte o que você procura').fill('apartamento para investir')
    await dialog.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(dialog.getByText('apartamento para investir', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/imóvel publicado|imóveis publicados|Não encontrei um imóvel publicado/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Fechar Assistente EME' }).click()
    await expect(dialog).toBeHidden()
  })

  test('mobile mantém hero, assistente e scroll sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/imoveis')
    const hero = await page.getByRole('heading', { name: /Seu próximo imóvel/ }).boundingBox()
    expect(hero!.y).toBeGreaterThan(95)

    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('button', { name: /Assistente EME/ }).click()
    await expect(page.getByRole('dialog', { name: 'Assistente EME' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Fechar Assistente EME' }).click()
    await expectNoHorizontalOverflow(page)
  })

  test('detalhe usa informações reais/fallback e mapa aproximado funcional', async ({ page }) => {
    await page.goto('/imoveis/busca')
    const propertyLink = page.locator('a[href^="/imoveis/imovel/"]').first()
    await expect(propertyLink).toBeVisible({ timeout: 20_000 })
    await propertyLink.click()

    await expect(page).toHaveURL(/\/imoveis\/imovel\//)
    await expect(page.getByRole('heading', { name: 'Antes de decidir' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('heading', { name: 'Antes de decidir' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('heading', { name: 'Informações confirmadas' })).toBeVisible()
    await expect(page.getByTitle(/Mapa aproximado de/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Abrir mapa' })).toHaveAttribute('href', /google\.com\/maps\/search/)
  })

  test('perfil de corretor sustenta avaliações com dados reais ou estado vazio', async ({ page }) => {
    await page.goto('/imoveis/corretores')
    const brokerLink = page.locator('a[href^="/imoveis/corretores/"]').first()
    await expect(brokerLink).toBeVisible({ timeout: 20_000 })
    await brokerLink.click()

    await expect(page.getByRole('heading', { name: 'Avaliações de clientes' })).toBeVisible()
    await expect(page.getByText(/Nenhuma avaliação publicada|Resumo disponível/)).toBeVisible()
  })
})
