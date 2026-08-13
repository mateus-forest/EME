import { formatPrice, type SearchResult } from '@/lib/marketplace/search-data'

export type ComparedProperty = SearchResult & { optionLabel: string }

export function withOptionLabels(results: SearchResult[]): ComparedProperty[] {
  return results.map((result, index) => ({ ...result, optionLabel: `Opção ${String.fromCharCode(65 + index)}` }))
}

function joinedLabels(items: ComparedProperty[]) {
  return items.map((item) => item.optionLabel).join(items.length > 2 ? ', ' : ' e ')
}

function extrema(items: ComparedProperty[], value: (item: ComparedProperty) => number, direction: 'min' | 'max') {
  const target = direction === 'min' ? Math.min(...items.map(value)) : Math.max(...items.map(value))
  return items.filter((item) => value(item) === target)
}

export function pricePerSquareMeter(item: SearchResult) {
  return item.area > 0 ? Math.round(item.price / item.area) : 0
}

export function comparisonInsights(results: SearchResult[], limit = 10) {
  const items = withOptionLabels(results)
  if (items.length < 2) return []
  const cheapest = extrema(items, (item) => item.price, 'min')
  const priciest = extrema(items, (item) => item.price, 'max')
  const largest = extrema(items, (item) => item.area, 'max')
  const smallest = extrema(items, (item) => item.area, 'min')
  const itemsWithArea = items.filter((item) => item.area > 0)
  const bestSquareMeter = itemsWithArea.length ? extrema(itemsWithArea, pricePerSquareMeter, 'min') : []
  const maxBedrooms = extrema(items, (item) => item.bedrooms, 'max')
  const maxParking = extrema(items, (item) => item.parking, 'max')
  const insights: string[] = []

  const priceDifference = priciest[0].price - cheapest[0].price
  if (priceDifference > 0) {
    insights.push(`${joinedLabels(cheapest)} custa ${formatPrice(priceDifference)} menos que ${joinedLabels(priciest)}.`)
  }
  const areaDifference = largest[0].area - smallest[0].area
  if (areaDifference > 0) {
    insights.push(`${joinedLabels(largest)} oferece ${areaDifference} m² a mais que ${joinedLabels(smallest)}.`)
  }

  if (items.length >= 2) {
    const byArea = [...items].sort((a, b) => b.area - a.area)
    const first = byArea[0]
    const second = byArea[1]
    const deltaPrice = Math.abs(first.price - second.price)
    const deltaArea = Math.abs(first.area - second.area)
    if (deltaPrice && deltaArea) {
      insights.push(`Entre ${first.optionLabel} e ${second.optionLabel}, a diferença é de ${formatPrice(deltaPrice)} para ${deltaArea} m² adicionais.`)
    }
  }

  const bedroomGroups = new Map<number, ComparedProperty[]>()
  items.forEach((item) => bedroomGroups.set(item.bedrooms, [...(bedroomGroups.get(item.bedrooms) || []), item]))
  if (bedroomGroups.size > 1) {
    const bedroomParts = [...bedroomGroups.entries()]
      .sort(([a], [b]) => b - a)
      .map(([count, group]) => `${joinedLabels(group)} possui ${count} ${count === 1 ? 'quarto' : 'quartos'}`)
    insights.push(`${bedroomParts.join(', enquanto ')}.`)
  }

  if (new Set(items.map((item) => item.parking)).size > 1) {
    insights.push(`${joinedLabels(maxParking)} oferece mais vagas, com ${maxParking[0].parking}.`)
  }
  if (bestSquareMeter.length) {
    insights.push(`${joinedLabels(bestSquareMeter)} apresenta o menor valor por m²: ${formatPrice(pricePerSquareMeter(bestSquareMeter[0]))}/m².`)
  }

  const maxSuites = extrema(items, (item) => item.suites, 'max')
  if (new Set(items.map((item) => item.suites)).size > 1) {
    insights.push(`${joinedLabels(maxSuites)} oferece mais suítes, com ${maxSuites[0].suites}.`)
  }
  const maxBathrooms = extrema(items, (item) => item.bathrooms, 'max')
  if (new Set(items.map((item) => item.bathrooms)).size > 1) {
    insights.push(`${joinedLabels(maxBathrooms)} oferece mais banheiros, com ${maxBathrooms[0].bathrooms}.`)
  }

  const locations = new Map<string, ComparedProperty[]>()
  items.forEach((item) => {
    const location = item.neighborhood ? `${item.neighborhood}, ${item.city}` : item.city
    locations.set(location, [...(locations.get(location) || []), item])
  })
  if (locations.size > 1) {
    const summary = [...locations.entries()]
      .map(([location, group]) => `${joinedLabels(group)} fica em ${location}`)
      .join('; ')
    insights.push(`${summary}.`)
  }

  const ready = items.filter((item) => item.intentTags.includes('pronto-para-morar'))
  if (ready.length) insights.push(`${joinedLabels(ready)} está identificado como pronto para morar.`)
  const patios = items.filter((item) => item.patio)
  if (patios.length && patios.length < items.length) insights.push(`${joinedLabels(patios)} possui pátio entre as opções comparadas.`)
  return insights.slice(0, limit)
}

export function comparisonRecommendations(results: SearchResult[]) {
  const items = withOptionLabels(results)
  if (!items.length) return []
  const choose = (score: (item: ComparedProperty) => number, direction: 'min' | 'max' = 'max') =>
    [...items].sort((a, b) => direction === 'max' ? score(b) - score(a) : score(a) - score(b))[0]
  const space = choose((item) => item.area)
  const investment = choose((item) => item.price, 'min')
  const itemsWithArea = items.filter((item) => item.area > 0)
  const value = itemsWithArea.length
    ? [...itemsWithArea].sort((a, b) => pricePerSquareMeter(a) - pricePerSquareMeter(b))[0]
    : investment
  const largestArea = Math.max(...items.map((current) => current.area), 1)
  const mostBedrooms = Math.max(...items.map((current) => current.bedrooms), 1)
  const mostParking = Math.max(...items.map((current) => current.parking), 1)
  const balance = choose((item) =>
    item.area / largestArea +
    (Math.min(...items.map((current) => current.price)) / item.price) +
    item.bedrooms / mostBedrooms +
    item.parking / mostParking,
  )
  return [
    { priority: 'Mais espaço', property: space, detail: `${space.area} m² e ${space.bedrooms} quartos` },
    { priority: 'Melhor equilíbrio', property: balance, detail: 'Combinação de área, preço, quartos e vagas' },
    { priority: 'Menor investimento', property: investment, detail: formatPrice(investment.price) },
    ...(itemsWithArea.length
      ? [{ priority: 'Melhor relação valor/m²', property: value, detail: `${formatPrice(pricePerSquareMeter(value))}/m²` }]
      : []),
  ]
}
