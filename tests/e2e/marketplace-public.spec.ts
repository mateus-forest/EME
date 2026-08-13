import { expect, test } from '@playwright/test'

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

test.describe('Marketplace público', () => {
  test.setTimeout(90_000)

  test('hero, filtros e critérios permanecem navegáveis no desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sou corretor' })).toHaveAttribute('href', /meueme\.com\/.*#inicio/)
    await expect(page.locator('img[src="/marketplace/cos-logo.png"]').first()).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'Buscar por filtros' }).click()
    const filters = page.getByRole('dialog', { name: 'Buscar por filtros' })
    await expect(filters).toBeVisible()
    await filters.getByRole('button', { name: 'Comprar' }).click()
    await filters.getByLabel('Tipo de imóvel').selectOption('casa')
    await filters.getByLabel('Cidade ou região').selectOption('Vacaria')
    await filters.getByLabel('Máximo').fill('700000')
    await filters.getByLabel('Quartos').fill('3')
    await filters.getByRole('button', { name: 'Pátio' }).click()
    await filters.getByRole('button', { name: 'Ver imóveis' }).click()

    await expect(page).toHaveURL(/\/imoveis\/busca\?.*finalidade=compra/)
    await expect(page.getByText('3+ quartos').first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Ajustar busca' }).click()
    const adjusted = page.getByRole('dialog', { name: 'Ajustar busca' })
    await expect(adjusted.getByLabel('Máximo')).toHaveValue('700000')
    await expect(adjusted.getByLabel('Quartos')).toHaveValue('3')
  })

  test('comparação e perfis têm destinos próprios', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/imoveis')
    await page.getByRole('link', { name: 'Ver comparação completa' }).click()
    await expect(page).toHaveURL('/imoveis/comparar')
    await expect(page.getByRole('heading', { name: /Compare o que realmente muda/ })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Mais espaço entre as opções')).toBeVisible()
    await expect(page.getByText('Menor preço da comparação')).toBeVisible()

    await page.goto('/imoveis/corretores')
    const brokerLink = page.getByRole('link', { name: 'Ver perfil de Carla Goulart' })
    await expect(brokerLink).toBeVisible({ timeout: 20_000 })
    await Promise.all([
      page.waitForURL(/\/imoveis\/corretores\/carla-goulart/, { timeout: 20_000 }),
      brokerLink.click(),
    ])
    await expect(page.getByText('32').first()).toBeVisible()
  })

  test('ordenação fica acima do mapa e o mapa é complementar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis/busca')
    await page.getByRole('button', { name: /Mais compatíveis/ }).click()
    const menu = page.getByRole('dialog').filter({ has: page.getByRole('radio', { name: 'Menor preço' }) })
    await expect(menu).toBeVisible()
    const topElementRole = await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 12)
      return top === element || element.contains(top)
    })
    expect(topElementRole).toBe(true)

    const map = page.getByLabel(/Casa térrea com pátio amplo/).last().locator('..')
    const box = await map.boundingBox()
    expect(box?.height).toBeLessThanOrEqual(520)
  })

  test('mobile usa bottom sheet sem overflow e preserva lista/mapa', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/imoveis')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Buscar por filtros' }).click()
    await expect(page.getByRole('dialog', { name: 'Buscar por filtros' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()

    await page.goto('/imoveis/busca')
    await expect(page.getByRole('tab', { name: 'Lista' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('tab', { name: 'Mapa' })).toBeVisible()
    await page.getByRole('tab', { name: 'Mapa' }).click()
    const mapRegion = page.getByText('Vacaria · RS').last().locator('..')
    const box = await mapRegion.boundingBox()
    expect(box?.height).toBeLessThanOrEqual(460)
    await expectNoHorizontalOverflow(page)
  })
})
