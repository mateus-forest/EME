import type { SearchResult } from '@/lib/marketplace/search-data'

export type SearchIntent = {
  slug: string
  label: string
  keywords: string[]
}

export const searchIntents: SearchIntent[] = [
  { slug: 'mais-espaco', label: 'Mais espaço', keywords: ['mais espaço', 'amplo', 'espaçoso'] },
  { slug: 'espaco-familia', label: 'Mais espaço para a família', keywords: ['espaço para a família', 'família'] },
  { slug: 'perto-de-tudo', label: 'Perto de tudo', keywords: ['perto de tudo', 'conveniência'] },
  { slug: 'perto-do-centro', label: 'Perto do centro', keywords: ['perto do centro', 'no centro', 'central'] },
  { slug: 'perto-do-trabalho', label: 'Perto do trabalho', keywords: ['perto do trabalho', 'trabalho'] },
  { slug: 'primeiro-imovel', label: 'Primeiro imóvel', keywords: ['primeiro imóvel', 'minha primeira casa'] },
  { slug: 'para-investir', label: 'Para investir', keywords: ['investir', 'investimento', 'renda'] },
  { slug: 'pronto-para-morar', label: 'Pronto para morar', keywords: ['pronto para morar'] },
  { slug: 'pronto-para-entrar', label: 'Pronto para entrar', keywords: ['pronto para entrar'] },
  { slug: 'morar-sozinho', label: 'Para morar sozinho', keywords: ['morar sozinho', 'moro sozinho'] },
  { slug: 'vida-no-campo', label: 'Vida no campo', keywords: ['vida no campo', 'no campo'] },
  { slug: 'natureza-e-lazer', label: 'Natureza e lazer', keywords: ['natureza', 'lazer', 'área verde'] },
  { slug: 'amplo-terreno', label: 'Amplo terreno', keywords: ['amplo terreno', 'terreno grande'] },
  { slug: 'para-o-negocio', label: 'Para o seu negócio', keywords: ['negócio', 'comercial'] },
]

const intentBySlug = new Map(searchIntents.map((intent) => [intent.slug, intent]))

export function normalizeIntentSlugs(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter((value) => intentBySlug.has(value)))]
}

export function getIntentLabel(slug: string) {
  return intentBySlug.get(slug)?.label || slug.replaceAll('-', ' ')
}

export function intentionsFromQuery(query?: string) {
  if (!query) return []
  const normalized = query.toLocaleLowerCase('pt-BR')
  return searchIntents
    .filter((intent) => intent.keywords.some((keyword) => normalized.includes(keyword)))
    .map((intent) => intent.slug)
}

export function intentScore(result: SearchResult, intentions: string[]) {
  return intentions.reduce((score, intent) => score + (result.intentTags.includes(intent) ? 3 : 0), 0)
}

export function intentReasons(result: SearchResult, intentions: string[]) {
  return intentions
    .filter((intent) => result.intentTags.includes(intent))
    .slice(0, 2)
    .map((intent) => `${getIntentLabel(intent)} combina com esta opção`)
}
