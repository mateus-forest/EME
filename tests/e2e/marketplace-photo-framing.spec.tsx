/** @jsxImportSource react */
import { expect, test } from '@playwright/test'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { PropertyCard } from '@/components/marketplace/property-card'

// Render the production component with the application's real styles, using only
// local image fixtures. This exercises every card variant without database writes.
for (const viewportWidth of [1440, 390]) {
  test(`cards preservam fotos quadradas, verticais e horizontais em ${viewportWidth}px`, async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: viewportWidth, height: 900 })
    await page.goto('/imoveis', { waitUntil: 'networkidle' })
    const cards: string[] = []
    for (const [width, height] of [[1050, 1050], [600, 900], [900, 600]]) {
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#c9ded1"/><circle cx="${width / 2}" cy="${height / 2}" r="150" fill="#008633"/><path d="M0 0L${width} ${height}M${width} 0L0 ${height}" stroke="#fff" stroke-width="12"/></svg>`
      const original = await sharp(Buffer.from(svg)).png().toBuffer()
      const image = `data:image/png;base64,${original.toString('base64')}`
      for (const variant of [{}, { compact: true }, { home: true }, { featured: true }, { featured: true, home: true }]) {
        cards.push(renderToStaticMarkup(<PropertyCard {...variant} property={{
          slug: `photo-${width}-${height}`, title: `Imóvel ${width} × ${height}`, city: 'São Paulo', state: 'SP',
          price: 500000, bedrooms: 2, area: 80, parking: 1, image, compatibility: 'boa', reasons: ['Boa localização'],
        }} />))
      }
    }
    await page.evaluate((html) => {
      document.body.innerHTML = `<main class="marketplace-shell" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:24px;padding:16px">${html}</main>`
    }, cards.join(''))
    const images = page.locator('[data-marketplace-property-card] img')
    await expect(images).toHaveCount(15)
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded()
      await expect(img).toHaveCSS('object-fit', 'cover')
      await expect(img).toHaveCSS('object-position', '50% 50%')
      const layout = await img.evaluate((element) => {
        const image = element as HTMLImageElement
        const container = image.parentElement!.parentElement!
        const bounds = container.getBoundingClientRect()
        const imageBounds = image.getBoundingClientRect()
        return {
          loaded: image.complete && image.naturalWidth > 0,
          original: image.currentSrc === image.getAttribute('src'),
          overflow: getComputedStyle(container).overflow,
          aspectRatio: getComputedStyle(container).aspectRatio,
          width: bounds.width, height: bounds.height,
          imageWidth: imageBounds.width, imageHeight: imageBounds.height,
        }
      })
      expect(layout.loaded).toBe(true)
      expect(layout.original).toBe(true)
      expect(layout.overflow).toBe('hidden')
      expect(layout.aspectRatio).not.toBe('auto')
      expect(layout.imageWidth).toBeCloseTo(layout.width, 0)
      expect(layout.imageHeight).toBeCloseTo(layout.height, 0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`photo-framing-viewport-${viewportWidth}.png`), animations: 'disabled' })
    await page.screenshot({ path: testInfo.outputPath(`photo-framing-${viewportWidth}.png`), fullPage: true, animations: 'disabled' })
  })
}
