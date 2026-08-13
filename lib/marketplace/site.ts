// Configuração central do site EME Imóveis.
// Centraliza rotas de navegação e o link externo institucional.

// URL oficial do EME. Ajustar aqui quando o endereço definitivo estiver disponível.
export const EME_OFFICIAL_URL = 'https://www.meueme.com/'

export type NavItem = {
  label: string
  href: string
}

// Navegação principal do header (rotas internas).
export const mainNav: NavItem[] = [
  { label: 'Comprar', href: '/imoveis?finalidade=compra#imoveis' },
  { label: 'Alugar', href: '/imoveis?finalidade=aluguel#imoveis' },
  { label: 'Regiões', href: '/imoveis#regioes' },
  { label: 'Corretores', href: '/imoveis#corretores' },
]
