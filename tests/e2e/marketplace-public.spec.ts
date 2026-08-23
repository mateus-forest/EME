import { expect, test, type Page } from '@playwright/test'

import { loginAsBroker } from './helpers/auth'

async function expectNoHorizontalOverflow(page: Page) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(size.scroll).toBeLessThanOrEqual(size.client + 1)
}

async function completeCinematicSearch(page: Page, expectedSource: string) {
  const scene = page.locator('[role="status"][aria-busy="true"]')
  await expect(scene).toBeVisible()
  await expect(scene).toHaveAttribute('aria-busy', 'true')

  const video = scene.locator('video')
  await expect(video).toHaveAttribute('src', expectedSource)
  const mediaState = await video.evaluate((element) => {
    const media = element as HTMLVideoElement
    return {
      autoPlay: media.autoplay,
      muted: media.muted,
      playsInline: media.playsInline,
      controls: media.controls,
      preload: media.preload,
      poster: media.poster,
    }
  })
  expect(mediaState).toMatchObject({ autoPlay: true, muted: true, playsInline: true, controls: false, preload: 'auto' })
  expect(mediaState.poster).toContain(expectedSource.replace('.mp4', '-poster.svg'))

  await video.dispatchEvent('ended')
  await expect(scene).toHaveClass(/opacity-0/, { timeout: 20_000 })
  await scene.dispatchEvent('transitionend', { propertyName: 'opacity' })
  await expect(scene).toHaveCount(0)
}

test.describe('Marketplace público', () => {
  test.setTimeout(90_000)

  test('filtros claros usam máscara BRL e persistem valores numéricos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')
    await page.getByRole('button', { name: 'Explorar por filtros' }).click()
    const dialog = page.getByRole('dialog', { name: 'Explorar por filtros' })
    const minimum = dialog.getByLabel('Mínimo')
    const maximum = dialog.getByLabel('Máximo')
    await minimum.fill('7500')
    await maximum.fill('1200000')
    await expect(minimum).toHaveValue(/R\$\s*7\.500/)
    await expect(maximum).toHaveValue(/R\$\s*1\.200\.000/)
    await dialog.getByRole('button', { name: 'Ver imóveis' }).click()
    await expect(page).toHaveURL(/precoMin=7500/)
    await expect(page).toHaveURL(/precoMax=1200000/)
    await completeCinematicSearch(page, '/marketplace/videos/search-loading-desktop.mp4')
    await expect(page.getByTestId('results-area')).toBeVisible()
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
    const header = page.locator('header').first()
    const navigation = page.getByRole('navigation', { name: 'Navegação principal' })
    const box = await navigation.boundingBox()
    expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThan(3)
    await expect(header).toHaveClass(/bg-transparent/)
    await expect(header).toHaveClass(/border-0/)
    await expect(navigation).not.toHaveClass(/glass-strong/)

    await page.locator('[data-marketplace-hero]').evaluate((hero) => {
      window.scrollTo(0, hero.getBoundingClientRect().height)
    })
    await expect(header).not.toHaveClass(/bg-transparent/)
    await expectNoHorizontalOverflow(page)
  })

  test('mobile preserva bottom sheets e mapa sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/imoveis')
    await page.getByRole('button', { name: 'Explorar por filtros' }).click()
    const dialog = page.getByRole('dialog', { name: 'Explorar por filtros' })
    await expect(dialog).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await dialog.getByLabel('Quartos').fill('2')
    await dialog.getByRole('button', { name: 'Ver imóveis' }).click()
    await expect(page).toHaveURL(/\/imoveis\/busca/)
    await expect(page).toHaveURL(/quartos=2/)
    await completeCinematicSearch(page, '/marketplace/videos/search-loading-mobile.mp4')
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
    const configuration = await page.getByRole('heading', { name: 'Identidade' }).boundingBox()
    const preview = await page.getByRole('heading', { name: 'Preview do catálogo' }).boundingBox()
    expect(preview!.x).toBeGreaterThan(configuration!.x)
    await expectNoHorizontalOverflow(page)
  })

  test('home refina busca, rodapé e ambientes sem conteúdo repetido', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')

    await expect(page.getByPlaceholder('Descreva onde e como você gostaria de viver...')).toBeVisible()
    const heroVideos = page.locator('video[src^="/marketplace/videos/hero-"]')
    await expect(heroVideos).toHaveCount(2)
    await expect(heroVideos.nth(0)).toHaveAttribute('src', '/marketplace/videos/hero-1.mp4')
    await expect(heroVideos.nth(1)).toHaveAttribute('src', '/marketplace/videos/hero-2.mp4')
    expect(
      await heroVideos.evaluateAll((videos) =>
        videos.map((video) => {
          const element = video as HTMLVideoElement
          return {
            autoPlay: element.autoplay,
            muted: element.muted,
            playsInline: element.playsInline,
            preload: element.preload,
          }
        }),
      ),
    ).toEqual([
      { autoPlay: true, muted: true, playsInline: true, preload: 'auto' },
      { autoPlay: false, muted: true, playsInline: true, preload: 'auto' },
    ])
    const quickSearchAction = page.getByRole('button', { name: 'Usar busca rápida' })
    await expect(quickSearchAction).toHaveAttribute('style', /border-width:\s*0\.5px/)
    await expect(page.getByRole('button', { name: 'Explorar por filtros' })).toHaveAttribute('style', /border-width:\s*0\.5px/)
    const videoLayer = page.locator('[data-marketplace-hero] > div[aria-hidden="true"]').first()
    const videoLayerMask = await videoLayer.evaluate((element) => getComputedStyle(element).maskImage)
    expect(videoLayerMask).toContain('linear-gradient')
    await expect(videoLayer).toHaveAttribute('style', /black 92%/)
    const bottomShade = videoLayer.locator('[data-hero-bottom-shade]')
    await expect(bottomShade).toHaveClass(/h-\[24%\]/)
    await expect(bottomShade).toHaveClass(/from-transparent/)
    await expect(bottomShade).toHaveClass(/to-black\/72/)
    const hero = await page.locator('[data-marketplace-hero]').boundingBox()
    const nextSectionHeading = await page.getByRole('heading', { name: 'Descubra do seu jeito' }).boundingBox()
    expect(nextSectionHeading!.y - (hero!.y + hero!.height)).toBeLessThan(100)

    const insightCard = page.getByRole('complementary', { name: 'Insights de compatibilidade' })
    await expect(insightCard).toBeVisible()
    await expect(insightCard).toHaveAttribute('style', /border-width:\s*0\.5px/)
    expect((await insightCard.boundingBox())!.height).toBeLessThan(140)
    await expect(insightCard.getByText('Muito compatível')).toBeVisible()
    await expect(insightCard.locator('[data-active="true"]')).toHaveAttribute('data-insight-index', '0')
    await expect(page.getByText('Tecnologia imobiliária', { exact: true })).toBeAttached()

    const explorer = page.getByRole('heading', { name: 'Explore cada detalhe' }).locator('..').locator('..')
    await explorer.getByRole('button', { name: 'Cozinha' }).click()
    await expect(page.getByAltText('Ambiente ilustrativo: Cozinha')).toBeVisible()
    await explorer.getByRole('button', { name: 'Suíte' }).click()
    await expect(page.getByAltText('Ambiente ilustrativo: Suíte')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('busca rápida reutiliza o loading cinematográfico e abre os resultados', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/imoveis')

    await page.getByRole('button', { name: 'Usar busca rápida' }).click()
    await expect(page).toHaveURL(/\/imoveis\/busca/)
    await completeCinematicSearch(page, '/marketplace/videos/search-loading-desktop.mp4')
    await expect(page.getByTestId('results-area')).toBeVisible()
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
    await expect(page.locator('header').first()).toHaveClass(/bg-transparent/)

    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.locator('header').first()).not.toHaveClass(/bg-transparent/)
    await page.getByRole('button', { name: /Assistente EME/ }).click()
    await expect(page.getByRole('dialog', { name: 'Assistente EME' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Fechar Assistente EME' }).click()
    await expectNoHorizontalOverflow(page)
  })

  test('hero respeita preferência por movimento reduzido', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/imoveis')

    await expect(page.getByRole('heading', { name: /Seu próximo imóvel/ })).toBeVisible()
    await expect(page.locator('video[src="/marketplace/videos/hero-1.mp4"]')).toHaveCount(1)
    await expect(page.locator('video[src^="/marketplace/videos/hero-"]')).toHaveCount(1)
  })

  test('card de compatibilidade alterna insights sem mudar de tamanho', async ({ page }) => {
    await page.goto('/imoveis')
    const card = page.getByRole('complementary', { name: 'Insights de compatibilidade' })
    const initialBox = await card.boundingBox()

    await expect(card.getByText('Muito compatível')).toBeVisible()
    await expect(card.locator('[data-active="true"]')).toHaveAttribute('data-insight-index', '0')
    await expect(card.getByText('Boa localização')).toBeVisible({ timeout: 5_500 })
    await expect(card.locator('[data-active="true"]')).toHaveAttribute('data-insight-index', '1')

    const rotatedBox = await card.boundingBox()
    expect(rotatedBox!.width).toBe(initialBox!.width)
    expect(rotatedBox!.height).toBe(initialBox!.height)
  })

  test('hero faz crossfade com dois buffers e prepara somente o próximo vídeo', async ({ page }) => {
    const requestedHeroVideos = new Set<string>()
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname
      if (/\/marketplace\/videos\/hero-\d+\.mp4$/.test(pathname)) requestedHeroVideos.add(pathname)
    })

    await page.goto('/imoveis')
    const videos = page.locator('video[src^="/marketplace/videos/hero-"]')
    const current = videos.nth(0)
    const next = videos.nth(1)

    await expect(videos).toHaveCount(2)
    await expect(current).toHaveClass(/opacity-100/)
    await expect(next).toHaveClass(/opacity-0/)
    await expect.poll(() => current.evaluate((video) => (video as HTMLVideoElement).duration)).toBeGreaterThan(2.4)
    await expect.poll(() => requestedHeroVideos.size).toBe(2)
    expect([...requestedHeroVideos].sort()).toEqual([
      '/marketplace/videos/hero-1.mp4',
      '/marketplace/videos/hero-2.mp4',
    ])

    await current.evaluate((video) => {
      const element = video as HTMLVideoElement
      element.currentTime = element.duration - 2
      element.dispatchEvent(new Event('timeupdate'))
    })

    await expect(current).toHaveClass(/opacity-0/)
    await expect(next).toHaveClass(/opacity-100/)
    await expect.poll(() => next.evaluate((video) => (video as HTMLVideoElement).paused)).toBe(false)

    await current.evaluate((video) => {
      video.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
    })

    await expect(current).toHaveAttribute('src', '/marketplace/videos/hero-3.mp4')
    await expect(next).toHaveAttribute('src', '/marketplace/videos/hero-2.mp4')
    await expect(videos).toHaveCount(2)
    await expect.poll(() => requestedHeroVideos.has('/marketplace/videos/hero-3.mp4')).toBe(true)
    expect(requestedHeroVideos.size).toBe(3)
    expect(await current.evaluate((video) => (video as HTMLVideoElement).paused)).toBe(true)
    expect(await next.evaluate((video) => (video as HTMLVideoElement).paused)).toBe(false)
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
    const profileText = await page.locator('body').innerText()
    expect(profileText).toMatch(/Nenhuma avaliação publicada|Resumo disponível|\d+(?:[.,]\d+)?\s+avaliaç(?:ão|ões)/i)
  })
})
