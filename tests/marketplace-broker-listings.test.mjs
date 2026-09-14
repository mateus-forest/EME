import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(new globalThis.URL(`../${file}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  const exports = {}
  new Function('require', 'exports', outputText)((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, exports)
  return exports
}

function harness(size = 6) {
  const published = Array.from({ length: size }, (_, i) => ({
    id: `property-${i}`, brokerId: 'broker-one', marketplacePublished: true,
    marketplaceSlug: `published-${i}`, title: `Imóvel ${i}`, description: '',
    city: 'Vacaria', type: 'APARTMENT', purpose: 'SALE', price: 10000000,
    bedrooms: 2, bathrooms: 1, parkingSpots: 1, imageUrls: i === 1 ? [] : ['/image.jpg'],
    broker: { status: 'ACTIVE', catalogSlug: 'broker-one', marketplaceSpecialties: [] },
  }))
  const records = [...published,
    { ...published[0], id: 'private', marketplacePublished: false },
    { ...published[0], id: 'other-broker', brokerId: 'broker-two' },
    { ...published[0], id: 'no-public-url', marketplaceSlug: null },
    { ...published[0], id: 'inactive', broker: { ...published[0].broker, status: 'INACTIVE' } },
  ]
  const queries = []
  const service = load('lib/marketplace/server-data.ts', {
    'server-only': {}, react: { cache: (fn) => fn },
    '@/lib/prisma-enums': { CreciValidationStatus: { VERIFIED: 'VERIFIED' } },
    '@/lib/legal-entities': { parsePropertyLegalData: () => ({}) },
    '@/lib/marketplace/region-media': {}, '@/lib/marketplace/region-media-contract': {},
    '@/lib/prisma': { prisma: { property: { findMany: async (query) => {
      queries.push(query)
      const filtered = records.filter((record) =>
        (!query.where.brokerId || record.brokerId === query.where.brokerId) &&
        (!query.where.marketplacePublished || record.marketplacePublished) &&
        (!query.where.marketplaceSlug || record.marketplaceSlug !== null) &&
        (!query.where.broker?.status || record.broker.status === query.where.broker.status))
      return query.take === undefined ? filtered : filtered.slice(0, query.take)
    } } } },
  })
  return { service, queries }
}

test('returns all six published listings, including a listing without a photo', async () => {
  const { service } = harness()
  const cards = await service.getMarketplaceBrokerPropertyCards('broker-one')
  assert.deepEqual(cards.map((card) => card.slug), Array.from({ length: 6 }, (_, i) => `published-${i}`))
  assert.equal(cards[1].image, '/marketplace/placeholder.svg')
})

test('does not replace the old cap with another arbitrary cap', async () => {
  const { service } = harness(25)
  assert.equal((await service.getMarketplaceBrokerPropertyCards('broker-one')).length, 25)
})

test('explicit limits remain available for callers requesting a selection', async () => {
  const { service } = harness()
  assert.equal((await service.getMarketplaceBrokerPropertyCards('broker-one', 3)).length, 3)
  assert.equal((await service.getMarketplaceBrokerPropertyCards('broker-one', 0)).length, 0)
})

test('returns no listings for an unrelated broker', async () => {
  const { service } = harness()
  assert.deepEqual(await service.getMarketplaceBrokerPropertyCards('unknown'), [])
})

test('the actual profile renders the full portfolio without requesting three cards', async () => {
  const { service } = harness(8)
  const broker = { id: 'broker-one', slug: 'broker-one', name: 'Corretor Teste', activeListings: 8,
    specialties: [], reviewCount: 0, rating: 0, region: 'Vacaria', transaction: 'ambos', about: 'Perfil de teste' }
  const page = load('app/imoveis/corretores/[slug]/page.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'), 'next/image': { default: 'img' }, 'next/link': { default: 'a' },
    'next/navigation': { notFound: () => { throw new Error('not found') } },
    'lucide-react': { ArrowLeft: 'icon', BadgeCheck: 'icon', Building2: 'icon', MapPin: 'icon', Star: 'icon' },
    '@/lib/marketplace/server-data': { ...service, getMarketplaceBroker: async () => broker },
    '@/components/marketplace/pages/page-shell': { PageShell: 'PageShell' },
    '@/components/marketplace/property-card': { PropertyCard: 'PropertyCard' },
    '@/components/marketplace/pages/broker-contact-form': { BrokerContactForm: 'BrokerContactForm' },
    '@/components/marketplace/section-heading': { SectionHeading: 'SectionHeading' },
    '@/components/marketplace/reveal': { Reveal: 'Reveal' },
    '@/components/marketplace/broker-profile-tracker': { BrokerProfileTracker: 'BrokerProfileTracker' },
    '@/components/marketplace/pages/broker-reviews': { BrokerReviews: 'BrokerReviews' },
  })
  const tree = await page.default({ params: Promise.resolve({ slug: 'broker-one' }) })
  const cards = [], delays = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if (node.type === 'PropertyCard') cards.push(node.props.property)
    if (node.type === 'Reveal' && node.props.delay !== undefined) delays.push(node.props.delay)
    visit(node.props?.children)
  }
  visit(tree)
  assert.equal(cards.length, 8)
  assert.equal(new Set(cards.map((card) => card.slug)).size, 8)
  assert.ok(delays.every((delay) => delay <= 450), 'larger portfolios must not add unbounded entrance delays')
})
