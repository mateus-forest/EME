// Contratos e conteúdo editorial. Imóveis e corretores são carregados de server-data.

export type Property = {
  slug: string; title: string; city: string; state: string; price: number; bedrooms: number; area: number; parking: number; image: string; badge?: string; featured?: boolean
}
export type Lifestyle = { slug: string; title: string; icon: 'space' | 'nearby' | 'invest' | 'ready'; image: string }
export type Feature = { title: string; description: string; icon: 'search' | 'sparkles' | 'compare' | 'phone' }

export const formatPrice = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
export const lifestyles: Lifestyle[] = [
  { slug: 'mais-espaco', title: 'Mais espaço para viver', icon: 'space', image: '/marketplace/images/lifestyle-space.png' },
  { slug: 'perto-de-tudo', title: 'Perto de tudo', icon: 'nearby', image: '/marketplace/images/lifestyle-nearby.png' },
  { slug: 'para-investir', title: 'Para investir', icon: 'invest', image: '/marketplace/images/lifestyle-invest.png' },
  { slug: 'pronto-para-morar', title: 'Pronto para morar', icon: 'ready', image: '/marketplace/images/lifestyle-ready.png' },
]
export const features: Feature[] = [
  { title: 'Busca por intenção', description: 'Você descreve o que busca em linguagem natural.', icon: 'search' },
  { title: 'Compatibilidade explicada', description: 'Entenda por que cada imóvel combina com você.', icon: 'sparkles' },
  { title: 'Comparação inteligente', description: 'Compare imóveis de forma simples e visual.', icon: 'compare' },
  { title: 'Contato direto', description: 'Fale com corretores locais, sem intermediários.', icon: 'phone' },
]

// Conteúdo visual editorial da exploração; não representa dados de um imóvel publicado.
export const environments = ['Sala', 'Cozinha', 'Suíte', 'Área externa'] as const
export const environmentHighlights = [
  { title: 'Área social integrada', verified: true },
  { title: 'Boa iluminação natural', verified: true },
  { title: 'Pátio amplo', verified: true },
]
