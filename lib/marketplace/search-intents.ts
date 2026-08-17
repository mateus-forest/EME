import type { SearchProperty } from '@/lib/marketplace/search-data'

export type SearchIntent = { slug: string; label: string; keywords: string[] }
export type IntentMatch = { score: number; reasons: string[] }

export const searchIntents: SearchIntent[] = [
  { slug: 'mais-espaco', label: 'Mais espaço', keywords: ['mais espaço', 'amplo', 'espaçoso'] },
  { slug: 'espaco-familia', label: 'Mais espaço para a família', keywords: ['espaço para a família', 'família'] },
  { slug: 'perto-de-tudo', label: 'Perto de tudo', keywords: ['perto de tudo', 'conveniência'] },
  { slug: 'perto-do-centro', label: 'Perto do centro', keywords: ['perto do centro', 'no centro', 'central'] },
  { slug: 'perto-do-trabalho', label: 'Perto do trabalho', keywords: ['perto do trabalho', 'trabalho'] },
  { slug: 'primeiro-imovel', label: 'Primeiro imóvel', keywords: ['primeiro imóvel', 'minha primeira casa'] },
  { slug: 'para-investir', label: 'Para investir', keywords: ['investir', 'investimento', 'renda', 'liquidez'] },
  { slug: 'pronto-para-morar', label: 'Pronto para morar', keywords: ['pronto para morar'] },
  { slug: 'pronto-para-entrar', label: 'Pronto para entrar', keywords: ['pronto para entrar'] },
  { slug: 'morar-sozinho', label: 'Para morar sozinho', keywords: ['morar sozinho', 'moro sozinho'] },
  { slug: 'vida-no-campo', label: 'Vida no campo', keywords: ['vida no campo', 'no campo'] },
  { slug: 'natureza-e-lazer', label: 'Natureza e lazer', keywords: ['natureza', 'lazer', 'área verde'] },
  { slug: 'amplo-terreno', label: 'Amplo terreno', keywords: ['amplo terreno', 'terreno grande'] },
  { slug: 'para-o-negocio', label: 'Para o seu negócio', keywords: ['negócio', 'comercial'] },
]

const intentBySlug = new Map(searchIntents.map((intent) => [intent.slug, intent]))
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export function normalizeIntentSlugs(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => intentBySlug.has(value)))]
}

export function getIntentLabel(slug: string) {
  return intentBySlug.get(slug)?.label || slug.replaceAll('-', ' ')
}

export function intentionsFromQuery(query?: string) {
  if (!query) return []
  const normalized = normalize(query)
  return searchIntents
    .filter((intent) => intent.keywords.some((keyword) => normalized.includes(normalize(keyword))))
    .map((intent) => intent.slug)
}

function contains(result: SearchProperty, pattern: RegExp) {
  return pattern.test(result.searchableText)
}

function add(match: IntentMatch, condition: boolean, score: number, reason?: string) {
  if (!condition) return
  match.score += score
  if (reason && !match.reasons.includes(reason)) match.reasons.push(reason)
}

/** Traduz intenção editorial em sinais objetivos já publicados no anúncio. */
export function matchSearchIntent(result: SearchProperty, intent: string): IntentMatch {
  const match: IntentMatch = { score: 0, reasons: [] }
  const central = contains(result, /\b(centro|central|regiao central)\b/)
  const ready = result.furnished || result.isNew || contains(result, /\b(pronto|reformad|acabamento|chaves|estruturad)\w*/)
  const amenities = contains(result, /\b(condominio|portaria|seguranca|academia|lavanderia|elevador|salao de festas|infraestrutura)\b/)

  switch (intent) {
    case 'mais-espaco':
    case 'espaco-familia':
      add(match, result.area >= 120, 4, result.area ? `${result.area} m² de área cadastrada` : undefined)
      add(match, result.bedrooms >= 3, 3, `${result.bedrooms} quartos para uma rotina mais ampla`)
      add(match, result.propertyType === 'casa' || result.propertyType === 'sobrado', 1, 'Tipologia com perfil familiar')
      add(match, result.patio, 2, 'Pátio ou área externa informada')
      break
    case 'perto-do-centro':
    case 'perto-de-tudo':
    case 'perto-do-trabalho':
      add(match, central, 8, 'Localização cadastrada em região central')
      add(match, result.propertyType === 'comercial' && intent === 'perto-do-trabalho', 2, 'Perfil urbano e comercial')
      break
    case 'primeiro-imovel':
      add(match, result.price > 0 && result.price <= 600_000, 4, 'Faixa de valor com perfil de primeira compra')
      add(match, result.bedrooms >= 1 && result.bedrooms <= 3, 2, 'Configuração equilibrada para o primeiro imóvel')
      add(match, result.isNew, 1, 'Imóvel anunciado como novo')
      break
    case 'para-investir':
      add(match, result.bedrooms >= 1 && result.bedrooms <= 2, 3, 'Planta compacta de 1 ou 2 quartos')
      add(match, amenities, 2, 'Estrutura ou comodidades informadas no anúncio')
      add(match, result.area > 0 && result.area <= 90, 2, 'Metragem compacta')
      add(match, result.propertyType === 'apartamento' || result.propertyType === 'comercial', 2, 'Tipologia com perfil de investimento')
      add(match, central, 2, 'Localização cadastrada em região central')
      break
    case 'pronto-para-morar':
    case 'pronto-para-entrar':
      add(match, ready, 6, result.furnished ? 'Imóvel anunciado como mobiliado' : 'Anúncio indica imóvel pronto ou bem estruturado')
      add(match, ready && amenities, 1, 'Estrutura complementar informada')
      break
    case 'morar-sozinho':
      add(match, result.bedrooms === 1, 5, 'Planta de 1 quarto')
      add(match, result.bedrooms === 2, 2, 'Planta compacta de 2 quartos')
      add(match, result.area > 0 && result.area <= 75, 3, 'Metragem compacta para uma rotina individual')
      add(match, result.propertyType === 'apartamento', 2, 'Apartamento com perfil prático')
      break
    case 'para-o-negocio':
      add(match, result.propertyType === 'comercial', 10, 'Imóvel cadastrado para uso comercial')
      break
    case 'vida-no-campo':
      add(match, contains(result, /\b(rural|campo|sitio|chacara|fazenda)\b/), 8, 'Perfil rural informado no anúncio')
      add(match, result.propertyType === 'terreno', 2, 'Tipologia de terreno')
      break
    case 'natureza-e-lazer':
      add(match, result.patio, 3, 'Área externa informada')
      add(match, contains(result, /\b(natureza|verde|lazer|jardim|bosque|parque)\b/), 6, 'Natureza ou lazer descritos no anúncio')
      break
    case 'amplo-terreno':
      add(match, result.propertyType === 'terreno', 5, 'Imóvel cadastrado como terreno')
      add(match, result.area >= 500, 5, `${result.area} m² de área cadastrada`)
      break
    default:
      add(match, result.intentTags.includes(intent), 3, `${getIntentLabel(intent)} combina com esta opção`)
  }
  return match
}

export function intentScore(result: SearchProperty, intentions: string[]) {
  return intentions.reduce((score, intent) => score + matchSearchIntent(result, intent).score, 0)
}

export function intentReasons(result: SearchProperty, intentions: string[]) {
  return intentions.flatMap((intent) => matchSearchIntent(result, intent).reasons).slice(0, 3)
}
