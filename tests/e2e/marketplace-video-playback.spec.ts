import { test, expect } from '@playwright/test'

for (const width of [1440, 390, 393, 430]) {
  test(`video lifecycle and complete search movie at ${width}px`, async ({ browser, baseURL }) => {
    test.setTimeout(120_000)
    const context = await browser.newContext({ baseURL, viewport: { width, height: width === 1440 ? 900 : 844 }, isMobile: width < 768, hasTouch: width < 768 })
    const page = await context.newPage()
    const requested: string[] = []
    page.on('request', req => { if (req.url().includes('.mp4')) requested.push(req.url()) })
    try {
      await page.goto('/imoveis', { waitUntil: 'domcontentloaded' })
      const hero = page.locator('[data-marketplace-hero] video').first()
      await expect.poll(() => hero.evaluate(v => (v as HTMLVideoElement).currentTime)).toBeGreaterThan(.2)
      expect(await hero.evaluate(v => { const video = v as HTMLVideoElement; return { muted: video.muted, inline: video.playsInline, controls: video.controls } })).toEqual({ muted: true, inline: true, controls: false })
      await page.evaluate(() => { document.querySelectorAll('video').forEach(v => v.pause()); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })) })
      await expect.poll(() => hero.evaluate(v => (v as HTMLVideoElement).paused)).toBe(false)
      await page.getByRole('button', { name: 'Usar busca rápida' }).click()
      const scene = page.locator('[data-search-video-scene]')
      await expect(scene).toBeVisible()
      const video = scene.locator('video')
      const expectedSource = width < 768 ? 'search-loading-mobile.mp4' : 'search-loading-desktop.mp4'
      await expect(video).toHaveAttribute('src', `/marketplace/videos/${expectedSource}`)
      // Results may be ready at the first frame; the full film must still play.
      await video.evaluate(v => { v.addEventListener('ended', () => { document.documentElement.dataset.searchMovieEnded = 'true' }, { once: true }) })
      await expect(scene).toHaveAttribute('data-search-finished', 'true', { timeout: 30_000 })
      await expect(scene).toHaveCount(0, { timeout: 25_000 })
      expect(await page.evaluate(() => document.documentElement.dataset.searchMovieEnded)).toBe('true')
      expect(requested.filter(url => url.includes('search-loading-')).every(url => url.includes(expectedSource))).toBe(true)
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
      // A second real search starts from a fresh video element at time zero.
      await page.getByRole('button', { name: 'Mais filtros', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Ver imóveis' }).click()
      await expect(scene).toBeVisible()
      expect(await scene.locator('video').evaluate(v => (v as HTMLVideoElement).currentTime)).toBeLessThan(1)
      await expect(scene).toHaveCount(0, { timeout: 25_000 })
    } finally { await context.close() }
  })
}

test('final movie frame waits for slow results and media errors retain a working failsafe', async ({ page }) => {
  test.setTimeout(120_000)
  await page.route('**/imoveis/busca?*', async route => { await new Promise(resolve => setTimeout(resolve, 12_000)); await route.continue() })
  await page.goto('/imoveis')
  await page.getByRole('button', { name: 'Usar busca rápida' }).click()
  const scene = page.locator('[data-search-video-scene]')
  await expect(scene).toHaveAttribute('data-video-finished', 'true', { timeout: 20_000 })
  await expect(scene).toHaveAttribute('data-search-finished', 'false')
  await expect(scene).toHaveAttribute('data-phase', 'holding')
  const final = await scene.locator('video').evaluate(v => { const video = v as HTMLVideoElement; return { time: video.currentTime, duration: video.duration, opacity: getComputedStyle(video).opacity } })
  expect(final.time).toBeCloseTo(final.duration, 1)
  expect(final.opacity).toBe('1')
  await expect(scene).toHaveCount(0, { timeout: 25_000 })
  await page.unroute('**/imoveis/busca?*')
  await page.getByRole('button', { name: 'Mais filtros', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Ver imóveis' }).click()
  await expect(scene).toBeVisible()
  await scene.locator('video').dispatchEvent('error')
  await expect(scene).toHaveCount(0, { timeout: 5000 })
})

test('hero recovers rejected play and stale intersection entries, pauses only offscreen, and survives refresh', async ({ page }) => {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play
    let rejected = 0
    HTMLMediaElement.prototype.play = function () {
      if (this.closest('[data-marketplace-hero]') && rejected++ < 2) {
        this.pause()
        return Promise.reject(new DOMException('Simulated transient startup failure', 'AbortError'))
      }
      return originalPlay.call(this)
    }
    const OriginalObserver = window.IntersectionObserver
    window.IntersectionObserver = class extends OriginalObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => callback(entries.map(entry => new Proxy(entry, {
          get(target, key) { return key === 'isIntersecting' ? false : Reflect.get(target, key, target) },
        })), observer), options)
      }
    }
  })
  await page.goto('/imoveis')
  const videos = page.locator('[data-marketplace-hero] video')
  await expect.poll(() => videos.evaluateAll(nodes => nodes.some(v => !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > .2))).toBe(true)
  await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-marketplace-hero]')!.getBoundingClientRect().bottom + window.scrollY + 100))
  await expect.poll(() => videos.evaluateAll(nodes => nodes.every(v => (v as HTMLVideoElement).paused))).toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => videos.evaluateAll(nodes => nodes.some(v => !(v as HTMLVideoElement).paused))).toBe(true)
  await page.reload()
  await expect.poll(() => videos.evaluateAll(nodes => nodes.some(v => !(v as HTMLVideoElement).paused && (v as HTMLVideoElement).currentTime > .2))).toBe(true)
})
