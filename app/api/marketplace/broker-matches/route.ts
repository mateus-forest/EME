import { NextRequest, NextResponse } from 'next/server'
import { filterSearchResults, inferMarketplaceFilters } from '@/lib/marketplace/search-filters'
import { getMarketplaceBrokers, getMarketplaceProperties } from '@/lib/marketplace/server-data'

function normalized(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() }

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const location = typeof body?.location === 'string' ? body.location.trim().slice(0, 120) : ''
  const summary = typeof body?.summary === 'string' ? body.summary.trim().slice(0, 1200) : ''
  if (!location || summary.length < 3) return NextResponse.json({ error: 'Informe a localização e um resumo da busca.' }, { status: 400 })
  const [properties, brokers] = await Promise.all([getMarketplaceProperties(), getMarketplaceBrokers()])
  const query = `${summary} ${location}`
  const filters = inferMarketplaceFilters(query, properties)
  const compatible = filterSearchResults(properties, filters, query)
  const locationKey = normalized(location)
  const purpose = filters.purpose
  const matches = brokers.map((broker) => {
    const portfolio = properties.filter((property) => property.brokerSlug === broker.slug)
    const compatiblePortfolio = compatible.filter((property) => property.brokerSlug === broker.slug)
    const regionFit = normalized(broker.region).includes(locationKey) || portfolio.some((property) => normalized(`${property.city} ${property.neighborhood} ${property.region}`).includes(locationKey))
    const purposeFit = !purpose || broker.transaction === 'ambos' || broker.transaction === purpose
    const performance = broker.reviewCount ? (broker.rating / 5) * Math.min(10, broker.reviewCount) : 0
    const score = compatiblePortfolio.length * 25 + (regionFit ? 22 : 0) + (purposeFit ? 8 : 0) + Math.min(portfolio.length, 8) * 2 + performance
    const reasons = [regionFit ? `Atua em ${location}` : '', compatiblePortfolio.length ? `${compatiblePortfolio.length} ${compatiblePortfolio.length === 1 ? 'imóvel ativo compatível' : 'imóveis ativos compatíveis'}` : '', broker.reviewCount ? `${broker.rating.toFixed(1)} em ${broker.reviewCount} avaliações aprovadas` : '', purposeFit && purpose ? `Atende ${purpose === 'compra' ? 'compra' : 'locação'}` : ''].filter(Boolean)
    return { broker, score, reasons, compatibleListings: compatiblePortfolio.length }
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score || b.compatibleListings - a.compatibleListings).slice(0, 5)
  return NextResponse.json({ matches, interpreted: filters, availableLocations: [...new Set(properties.flatMap((property) => [property.city, property.neighborhood]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')) })
}
