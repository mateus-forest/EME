import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

test("deduplica leituras de sessão e dados públicos dentro do mesmo ciclo", () => {
  const authClient = source("lib/auth-client.ts")
  const marketplaceData = source("lib/marketplace/server-data.ts")

  assert.match(authClient, /let currentUserRequest: Promise<AuthenticatedUser \| null> \| null = null/)
  assert.match(authClient, /if \(currentUserRequest\) return currentUserRequest/)
  assert.match(authClient, /if \(currentUserRequest === request\) currentUserRequest = null/)

  assert.match(marketplaceData, /import \{ cache \} from ['"]react['"]/)
  assert.match(marketplaceData, /export const getMarketplaceProperties = cache/)
  assert.match(marketplaceData, /export const getMarketplaceBrokers = cache/)
  assert.match(marketplaceData, /export const getMarketplaceRegions = cache/)
})

test("fixa a raiz do Turbopack para impedir cache e rotas de outro workspace", () => {
  const nextConfig = source("next.config.mjs")

  assert.match(nextConfig, /const projectRoot = path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/)
  assert.match(nextConfig, /turbopack:\s*\{\s*root: projectRoot/)
})

test("loader cinematográfico tem saída garantida e não antecipa o download dos vídeos", () => {
  const cinematic = source("components/marketplace/search/cinematic-search-loading.tsx")

  assert.match(cinematic, /SCENE_FAILSAFE_MS = 15_000/)
  assert.match(cinematic, /RESULTS_READY_GRACE_MS = 3_200/)
  assert.match(cinematic, /onError=\{handleVideoError\}/)
  assert.doesNotMatch(cinematic, /<link[^>]+as=["']video["']/)
})

test("buscas críticas cancelam respostas obsoletas e contratos usam debounce", () => {
  const contractsPage = source("components/broker-contracts-page.tsx")
  const agendaPage = source("components/broker-agenda-page.tsx")
  const financialPage = source("components/broker-financial-page.tsx")

  assert.match(contractsPage, /useDebouncedValue\(query, 280\)/)
  assert.match(contractsPage, /useDebouncedValue\(draft, 160\)/)
  assert.match(contractsPage, /new AbortController\(\)/)
  assert.match(agendaPage, /new AbortController\(\)/)
  assert.match(financialPage, /new AbortController\(\)/)
  assert.match(financialPage, /signal: request\.controller\.signal/)
})

test("Marketplace e COS evitam recargas e mutações concorrentes desnecessárias", () => {
  const marketplacePage = source("components/broker-marketplace-page.tsx")
  const cosPanel = source("components/cos-launch-panel.tsx")
  const cosHistory = source("components/broker-sidebar-conversations.tsx")

  assert.match(marketplacePage, /await reloadConversations\(\)/)
  assert.match(marketplacePage, /Tentar novamente/)
  assert.match(cosPanel, /if \(requestInFlightRef\.current\) return false/)
  assert.match(cosHistory, /if \(expanded\) void loadConversations\(\)/)
})

test("vídeo do hero pausa fora da viewport e reduz preload", () => {
  const heroVideo = source("components/marketplace/sections/hero-video-background.tsx")

  assert.match(heroVideo, /new IntersectionObserver/)
  assert.match(heroVideo, /autoPlay=\{isActive && isInViewport\}/)
  assert.match(heroVideo, /preload=\{isInViewport \? "auto" : "metadata"\}/)
})
