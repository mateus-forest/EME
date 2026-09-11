import { expect, test, webkit, type Browser, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import { createServer, request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import { resolve } from "node:path"
import { ModuleKind, ScriptTarget, transpileModule } from "typescript"

test.setTimeout(120_000)

const HERO = "[data-hero-video-background]"
const VIDEOS = `${HERO} video[data-hero-video-slot]`
const ACTIVE = `${VIDEOS}[data-active="true"]`
const SOURCES = [1, 2, 3, 4, 5].map(index => `/marketplace/videos/hero-${index}.mp4`)
type Clip = { src: string; time: number; duration: number }
type Audit = {
  nodes: HTMLVideoElement[]
  ended: Clip[]
  playing: Clip[]
  prematurePauses: Clip[]
  replacedNodes: number
  activeSourceChanges: string[]
  uncoveredFrames: number
}
type AuditWindow = Window & typeof globalThis & { heroAudit: Audit; forcedPlayFailures: number; staleHeroEntries: number }
type FixtureWindow = AuditWindow & { createHeroSequence: (root: HTMLDivElement) => () => void; cleanupHeroSequence: () => void }

const controllerScript = transpileModule(readFileSync(resolve("components/marketplace/sections/hero-video-sequence.ts"), "utf8"), {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
}).outputText

async function delayedMediaProxy(baseURL: string, held: Promise<void>) {
  const upstream = new URL(baseURL)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(upstream.hostname)) throw new Error("Media delay fixture must proxy only the local test app")
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", upstream)
    if (url.pathname.startsWith("/api/")) {
      response.writeHead(200, { "Content-Type": "application/json" })
      response.end(JSON.stringify({ user: null, metrics: [], properties: [], results: [] }))
      return
    }
    if (url.pathname === "/marketplace/videos/hero-2.mp4") await held
    if (response.destroyed) return
    const forward = (upstream.protocol === "https:" ? httpsRequest : httpRequest)(url, { method: request.method, headers: { ...request.headers, host: upstream.host } }, result => {
      response.writeHead(result.statusCode ?? 502, result.headers)
      result.pipe(response)
    })
    forward.on("error", () => { if (!response.headersSent) response.writeHead(502); response.end() })
    request.pipe(forward)
  })
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Media delay fixture did not bind to a TCP port")
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      server.closeAllConnections()
      await closed
    },
  }
}

async function mountControllerFixture(page: Page, url = "/__hero-lifecycle-fixture") {
  await page.route("**/__hero-lifecycle-fixture", route => route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body { margin: 0; }
    [data-hero-video-background] { position: relative; width: 100vw; height: 100vh; overflow: hidden; isolation: isolate; background: #0d1512; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  </style></head><body><div data-hero-video-background>${[0, 1].map(slot => `<video data-hero-video-slot="${slot}" data-source-index="${slot}" data-active="${slot === 0}" src="${SOURCES[slot]}" poster="/marketplace/videos/hero-first-frame.png" ${slot === 0 ? "autoplay" : ""} muted playsinline preload="auto" disablepictureinpicture style="z-index:${slot === 0 ? 2 : 1}"></video>`).join("")}</div></body></html>` }))
  await page.goto(url, { waitUntil: "domcontentloaded" })
  await page.addScriptTag({ content: `(() => { const exports = {}; ${controllerScript}\nwindow.createHeroSequence = exports.createHeroVideoSequence; window.cleanupHeroSequence = window.createHeroSequence(document.querySelector('[data-hero-video-background]')); })();` })
}

async function instrument(page: Page) {
  // Every API request is fulfilled locally: these playback tests never write telemetry or data.
  await page.route("**/api/**", route => route.fulfill({ json: { user: null, metrics: [], properties: [], results: [] } }))
  await page.addInitScript(() => {
    const audit: Audit = { nodes: [], ended: [], playing: [], prematurePauses: [], replacedNodes: 0, activeSourceChanges: [], uncoveredFrames: 0 }
    ;(window as AuditWindow).heroAudit = audit
    const selector = "[data-hero-video-background] video[data-hero-video-slot]"
    const record = (video: HTMLVideoElement): Clip => ({ src: video.getAttribute("src") ?? "", time: video.currentTime, duration: video.duration })
    document.addEventListener("playing", event => {
      const video = event.target
      if (!(video instanceof HTMLVideoElement) || !video.matches(selector)) return
      if (!audit.nodes.length) audit.nodes = Array.from(document.querySelectorAll<HTMLVideoElement>(selector))
      audit.playing.push(record(video))
    }, true)
    document.addEventListener("ended", event => {
      const video = event.target
      if (video instanceof HTMLVideoElement && video.matches(selector)) audit.ended.push(record(video))
    }, true)
    document.addEventListener("pause", event => {
      const video = event.target
      if (!(video instanceof HTMLVideoElement) || !video.matches(selector) || video.dataset.active !== "true") return
      const rect = video.getBoundingClientRect()
      if (!document.hidden && rect.bottom > 0 && rect.top < innerHeight && video.currentTime > .3 && video.currentTime < video.duration - .1) audit.prematurePauses.push(record(video))
    }, true)
    new MutationObserver(records => {
      if (!audit.nodes.length) return
      for (const mutation of records) {
        if (mutation.type === "attributes" && mutation.attributeName === "src") {
          const video = mutation.target
          if (video instanceof HTMLVideoElement && video.matches(selector) && video.dataset.active === "true") audit.activeSourceChanges.push(video.getAttribute("src") ?? "")
        }
      }
      if (audit.nodes.some(node => !node.isConnected)) audit.replacedNodes++
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] })
    window.setInterval(() => {
      if (!audit.nodes.length || document.hidden || audit.nodes.some(node => !node.isConnected)) return
      const decodedCoverage = audit.nodes.reduce((opacity, node) => opacity + (node.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? Number(getComputedStyle(node).opacity) : 0), 0)
      if (decodedCoverage < .9) audit.uncoveredFrames++
    }, 50)
  })
}

async function mobile(browser: Browser, baseURL: string | undefined, engine: "chromium" | "webkit") {
  const runtime = engine === "webkit" ? await webkit.launch() : browser
  const context = await runtime.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  await instrument(page)
  return { page, close: async () => { await context.close(); if (engine === "webkit") await runtime.close() } }
}

async function expectPlaying(page: Page) {
  // SSR autoplay can start before React attaches the controller and its listeners.
  await expect(page.locator(HERO)).toHaveAttribute("data-player-ready", "true", { timeout: 30_000 })
  await expect(page.locator(VIDEOS)).toHaveCount(2)
  await expect(page.locator(ACTIVE)).toHaveCount(1)
  await expect.poll(() => page.locator(ACTIVE).evaluate(node => {
    const video = node as HTMLVideoElement
    return !video.paused && !video.ended && video.currentTime > .2
  })).toBe(true)
}

async function expectSamePlayers(page: Page) {
  expect(await page.locator(VIDEOS).evaluateAll(nodes => nodes.every((node, index) => node === (window as AuditWindow).heroAudit.nodes[index]))).toBe(true)
}

for (const engine of ["chromium", "webkit"] as const) {
  test(`hero autoplays all five complete clips with two persistent players (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    try {
      await page.goto("/imoveis")
      await expectPlaying(page)
      const height = (await page.locator("[data-marketplace-hero]").boundingBox())!.height
      const attributes = await page.locator(VIDEOS).evaluateAll(nodes => nodes.map(node => {
        const video = node as HTMLVideoElement
        return { active: video.dataset.active === "true", autoplay: video.autoplay, muted: video.muted, defaultMuted: video.defaultMuted, inline: video.playsInline, controls: video.controls, preload: video.preload, pipDisabled: video.hasAttribute("disablepictureinpicture"), poster: video.getAttribute("poster") }
      }))
      for (const { active, ...actual } of attributes) expect(actual).toEqual({ autoplay: active, muted: true, defaultMuted: true, inline: true, controls: false, preload: "auto", pipDisabled: true, poster: "/marketplace/videos/hero-first-frame.png" })
      expect(await page.locator(`${VIDEOS}[data-active="false"]`).evaluate(node => (node as HTMLVideoElement).paused && (node as HTMLVideoElement).currentTime === 0)).toBe(true)
      await expect(page.locator(`${HERO} img[src*="hero-residence"], ${HERO} video[src*="search-loading"], [data-search-video-scene]`)).toHaveCount(0)
      await expect(page.locator('[data-marketplace-hero] button[aria-label*="play" i]')).toHaveCount(0)

      // Real decoding at playbackRate=1: no seeking and no synthetic ended/timeupdate events.
      await expect.poll(() => page.evaluate(() => (window as AuditWindow).heroAudit.ended.length), { timeout: 70_000 }).toBeGreaterThanOrEqual(5)
      const audit = await page.evaluate(() => {
        const { ended, prematurePauses, replacedNodes, activeSourceChanges, uncoveredFrames } = (window as AuditWindow).heroAudit
        return { ended: ended.slice(0, 5), prematurePauses, replacedNodes, activeSourceChanges, uncoveredFrames }
      })
      expect(audit.ended.map(item => item.src)).toEqual(SOURCES)
      for (const clip of audit.ended) expect(clip.time).toBeCloseTo(clip.duration, 1)
      expect(audit.prematurePauses).toEqual([])
      expect(audit.activeSourceChanges).toEqual([])
      expect(audit.replacedNodes).toBe(0)
      expect(audit.uncoveredFrames).toBe(0)
      await expectSamePlayers(page)
      expect((await page.locator("[data-marketplace-hero]").boundingBox())!.height).toBe(height)
      expect(await page.locator(VIDEOS).evaluateAll(nodes => nodes.every(node => (node as HTMLVideoElement).playbackRate === 1))).toBe(true)
      await page.screenshot({ path: `.qa-audit-tmp/marketplace-hero-lifecycle-${engine}.png` })
    } finally { await close() }
  })

  test(`hero retains outgoing frame while next source is delayed (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const proxy = await delayedMediaProxy(baseURL!, held)
    try {
      // WebKit's native media loader can bypass Playwright routing. Delay the actual
      // HTTP response instead, preserving native canplay/ended and the real player.
      // Isolate the production controller from development-shell hydration; the
      // suite's app-level cases cover the React component, SSR and navigation.
      await mountControllerFixture(page, `${proxy.url}/__hero-lifecycle-fixture`)
      await expectPlaying(page)
      await expect.poll(() => page.evaluate(() => (window as AuditWindow).heroAudit.ended.length), { timeout: 20_000 }).toBe(1)
      const outgoing = page.locator(`${VIDEOS}[data-hero-video-slot="0"]`)
      await expect(outgoing).toHaveAttribute("data-active", "true")
      await expect(outgoing).toHaveAttribute("src", SOURCES[0])
      // Hold beyond ended: the outgoing decoder must retain its final frame without replay.
      await page.waitForTimeout(900)
      expect(await outgoing.evaluate(node => { const video = node as HTMLVideoElement; return video.ended && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - video.duration) < .1 })).toBe(true)
      expect(await outgoing.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1)
      expect(await page.evaluate(() => (window as AuditWindow).heroAudit.ended.length)).toBe(1)
      await expectSamePlayers(page)
      release()
      await expect(page.locator(ACTIVE)).toHaveAttribute("src", SOURCES[1])
      await expectPlaying(page)
      await expectSamePlayers(page)
    } finally { release(); await close(); await proxy.close() }
  })

  for (const failure of ["rejected", "pending"] as const) test(`hero recovers ${failure} play without touch (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    try {
      await page.addInitScript(({ failure }) => {
        const play = HTMLMediaElement.prototype.play
        const autoplay = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "autoplay")!
        const limit = failure === "pending" ? 1 : 2
        ;(window as AuditWindow).forcedPlayFailures = 0
        // Native autoplay would otherwise bypass the injected play() rejection.
        // Keep only the incoming layer's native autoplay off until the failures expire.
        Object.defineProperty(HTMLMediaElement.prototype, "autoplay", {
          configurable: autoplay.configurable,
          enumerable: autoplay.enumerable,
          get: autoplay.get,
          set(this: HTMLMediaElement, value: boolean) {
            const blocked = this.getAttribute("data-hero-video-slot") === "1" && (window as AuditWindow).forcedPlayFailures < limit
            autoplay.set!.call(this, blocked ? false : value)
          },
        })
        HTMLMediaElement.prototype.play = function () {
          if (this.getAttribute("data-hero-video-slot") === "1" && (window as AuditWindow).forcedPlayFailures < limit) {
            ;(window as AuditWindow).forcedPlayFailures++
            this.pause()
            return failure === "pending" ? new Promise<void>(() => {}) : Promise.reject(new DOMException("Transient autoplay failure", "NotAllowedError"))
          }
          return play.call(this)
        }
      }, { failure })
      await page.goto("/imoveis")
      await expectPlaying(page)
      await expect(page.locator(ACTIVE)).toHaveAttribute("src", SOURCES[1], { timeout: 20_000 })
      await expectPlaying(page)
      expect(await page.evaluate(() => (window as AuditWindow).forcedPlayFailures)).toBe(failure === "pending" ? 1 : 2)
      await expectSamePlayers(page)
    } finally { await close() }
  })

  test(`controller reconnects during a real crossfade without resetting persistent media (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    try {
      await mountControllerFixture(page)
      await expectPlaying(page)
      await expect(page.locator(HERO)).toHaveAttribute("data-phase", "crossfading", { timeout: 20_000 })
      const result = await page.evaluate(() => {
        const runtime = window as FixtureWindow
        const root = document.querySelector<HTMLDivElement>("[data-hero-video-background]")!
        const active = root.querySelector<HTMLVideoElement>('video[data-active="true"]')!
        const before = { phase: root.dataset.phase, src: active.getAttribute("src"), time: active.currentTime, active: active.dataset.heroVideoSlot, outgoing: root.dataset.outgoing }
        // React Activity/Strict Mode can disconnect effects while retaining these DOM nodes.
        runtime.cleanupHeroSequence()
        runtime.cleanupHeroSequence = runtime.createHeroSequence(root)
        return { before, after: { phase: root.dataset.phase, src: active.getAttribute("src"), time: active.currentTime, active: active.dataset.heroVideoSlot, outgoing: root.dataset.outgoing } }
      })
      expect(result.before.phase).toBe("crossfading")
      expect(result.before.src).toBe(SOURCES[1])
      expect(result.after.src).toBe(result.before.src)
      expect(result.after.time).toBeGreaterThanOrEqual(result.before.time)
      expect(result.after.active).toBe(result.before.active)
      expect(result.after.outgoing).toBe(result.before.outgoing)
      await expectPlaying(page)
      await expectSamePlayers(page)
      await expect(page.locator(ACTIVE)).toHaveAttribute("src", SOURCES[2], { timeout: 20_000 })
      await expectPlaying(page)
      await expectSamePlayers(page)
      const audit = await page.evaluate(() => {
        const { ended, activeSourceChanges, uncoveredFrames, replacedNodes } = (window as AuditWindow).heroAudit
        return { ended, activeSourceChanges, uncoveredFrames, replacedNodes }
      })
      expect(audit.ended.map(clip => clip.src)).toEqual(SOURCES.slice(0, 2))
      for (const clip of audit.ended) expect(clip.time).toBeCloseTo(clip.duration, 1)
      expect(audit.activeSourceChanges).toEqual([])
      expect(audit.uncoveredFrames).toBe(0)
      expect(audit.replacedNodes).toBe(0)
    } finally { await close() }
  })

  test(`hero survives page lifecycle, navigation and viewport changes (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    try {
      await page.goto("/imoveis")
      await expectPlaying(page)
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })))
      await expect.poll(() => page.locator(VIDEOS).evaluateAll(nodes => nodes.every(node => (node as HTMLVideoElement).paused))).toBe(true)
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })))
      await expectPlaying(page)
      // Document visibility is browser-owned. Override only the test signal, never media events.
      await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")) })
      await expect.poll(() => page.locator(VIDEOS).evaluateAll(nodes => nodes.every(node => (node as HTMLVideoElement).paused))).toBe(true)
      await page.evaluate(() => { delete (document as unknown as Record<string, unknown>).hidden; delete (document as unknown as Record<string, unknown>).visibilityState; document.dispatchEvent(new Event("visibilitychange")) })
      await expectPlaying(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await expectPlaying(page)
      await expectSamePlayers(page)
      await page.setViewportSize({ width: 390, height: 844 })
      await expectPlaying(page)
      await expectSamePlayers(page)
      await page.evaluate(() => window.scrollTo(0, document.querySelector("[data-marketplace-hero]")!.getBoundingClientRect().bottom + 100))
      await expect.poll(() => page.locator(VIDEOS).evaluateAll(nodes => nodes.every(node => (node as HTMLVideoElement).paused))).toBe(true)
      await page.evaluate(() => window.scrollTo(0, 0))
      await expectPlaying(page)
      await expectSamePlayers(page)
      await page.reload()
      await expectPlaying(page)
      await page.goto("/")
      await page.goBack()
      await expectPlaying(page)
      await page.goto("/")
      // Keep the existing CTA's native anchor navigation inside the local app.
      // Its React click handler hardcodes production, so the fixture stops that
      // handler before following the local href; no production navigation occurs.
      const localMarketplace = new URL("/imoveis", page.url()).href
      const marketplaceLink = page.getByRole("link", { name: "Abrir Marketplace EME", exact: true })
      await marketplaceLink.evaluate((link, href) => {
        link.setAttribute("href", href)
        link.addEventListener("click", event => event.stopPropagation(), { capture: true, once: true })
      }, localMarketplace)
      await marketplaceLink.click()
      await expect(page).toHaveURL(/\/imoveis$/)
      await expectPlaying(page)
    } finally { await close() }
  })

  test(`stale initial IntersectionObserver entry cannot pause visible hero (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    try {
      await page.addInitScript(() => {
        const NativeObserver = IntersectionObserver
        ;(window as AuditWindow).staleHeroEntries = 0
        window.IntersectionObserver = class extends NativeObserver {
          private callback: IntersectionObserverCallback
          constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { super(callback, options); this.callback = callback }
          observe(target: Element) {
            super.observe(target)
            if (!target.matches("[data-hero-video-background], [data-marketplace-hero]")) return
            queueMicrotask(() => {
              ;(window as AuditWindow).staleHeroEntries++
              this.callback([{ target, isIntersecting: false, intersectionRatio: 0, boundingClientRect: new DOMRect(), intersectionRect: new DOMRect(), rootBounds: null, time: performance.now() }], this)
            })
          }
        }
      })
      await page.goto("/imoveis")
      await expectPlaying(page)
      expect(await page.evaluate(() => (window as AuditWindow).staleHeroEntries)).toBeGreaterThan(0)
    } finally { await close() }
  })

  test(`cinematic search video mounts only after search starts (${engine})`, async ({ browser, baseURL }) => {
    const { page, close } = await mobile(browser, baseURL, engine)
    const requestedSearchVideos: string[] = []
    page.on("request", request => { if (/\/search-loading-.*\.mp4/.test(request.url())) requestedSearchVideos.push(request.url()) })
    try {
      await page.goto("/imoveis")
      await expectPlaying(page)
      await expect(page.locator("[data-search-video-scene]")).toHaveCount(0)
      expect(requestedSearchVideos).toEqual([])
      await page.getByRole("button", { name: "Usar busca rápida", exact: true }).click()
      await expect(page.locator("[data-search-video-scene] video")).toHaveAttribute("src", "/marketplace/videos/search-loading-mobile.mp4")
      if (engine === "webkit") {
        // WebKit's native video requests bypass Playwright's request event too.
        await expect.poll(() => page.locator("[data-search-video-scene] video").evaluate(node => (node as HTMLVideoElement).currentTime)).toBeGreaterThan(.2)
      } else await expect.poll(() => requestedSearchVideos.length).toBeGreaterThan(0)
    } finally { await close() }
  })
}
