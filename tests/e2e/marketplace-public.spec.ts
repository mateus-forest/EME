import { expect, test, type Page } from '@playwright/test'

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
})
