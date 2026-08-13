import Link from 'next/link'
import { ArrowUpRight, Mail } from 'lucide-react'
import { Logo } from '@/components/marketplace/logo'
import { EME_OFFICIAL_URL } from '@/lib/marketplace/site'

const columns = [
  {
    title: 'Navegação',
    links: [
      { label: 'Comprar', href: '/imoveis/comprar' },
      { label: 'Alugar', href: '/imoveis/alugar' },
      { label: 'Regiões', href: '/imoveis/regioes' },
      { label: 'Corretores', href: '/imoveis/corretores' },
    ],
  },
  {
    title: 'Institucional',
    links: [
      { label: 'Como funciona', href: '/imoveis#tecnologia' },
      { label: 'Privacidade', href: '/imoveis/privacidade' },
      { label: 'Termos de uso', href: '/imoveis/termos-de-uso' },
    ],
  },
]

export function Footer() {
  return (
    <footer id="rodape" className="border-t border-border bg-surface/60">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-8 gap-y-10 px-5 py-16 md:grid-cols-4 md:px-8">
        <div className="col-span-2 md:col-span-1">
          <Logo size="md" />
          <p className="mt-5 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            Tecnologia e pessoas para conectar você ao imóvel certo.
          </p>
          <a
            href={EME_OFFICIAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary outline-none transition-colors hover:text-eme-700 focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Conhecer o EME
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h3 className="text-sm font-medium text-foreground">{column.title}</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h3 className="text-sm font-medium text-foreground">Contato</h3>
          <a
            href="mailto:contato@emeimoveis.com.br"
            className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:text-primary focus-visible:underline"
          >
            <Mail className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            contato@emeimoveis.com.br
          </a>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Para os canais oficiais e informações institucionais, acesse o site do EME.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} EME Imóveis. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground">Dados demonstrativos para apresentação.</p>
        </div>
      </div>
    </footer>
  )
}
