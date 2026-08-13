// Configuração central do site EME Imóveis.
// Centraliza rotas de navegação e o link externo institucional.

// URL oficial do EME. Ajustar aqui quando o endereço definitivo estiver disponível.
export const EME_OFFICIAL_URL = 'https://www.meueme.com/#inicio'

export type NavItem = {
  label: string
  href: string
}

// Navegação principal do header (rotas internas).
export const mainNav: NavItem[] = [
  { label: 'Comprar', href: '/imoveis/comprar' },
  { label: 'Alugar', href: '/imoveis/alugar' },
  { label: 'Regiões', href: '/imoveis/regioes' },
  { label: 'Corretores', href: '/imoveis/corretores' },
]
