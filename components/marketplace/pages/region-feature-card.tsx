import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import type { RegionDetail } from '@/lib/marketplace/pages-data'
import { cn } from '@/lib/utils'

// Cartão editorial de região: foto ampla, descrição, disponibilidade e bairros relacionados.
export function RegionFeatureCard({
  region,
  reversed = false,
}: {
  region: RegionDetail
  reversed?: boolean
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-[var(--shadow-soft)] transition-shadow duration-300 hover:shadow-[var(--shadow-float)]">
      <div className={cn('flex flex-col lg:flex-row', reversed && 'lg:flex-row-reverse')}>
        <div className="relative aspect-[16/10] lg:aspect-auto lg:w-[45%]">
          <Image
            src={region.image || '/marketplace/placeholder.svg'}
            alt={`Região de ${region.name}`}
            fill
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent lg:bg-gradient-to-r" />
          <span className="glass absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {region.properties} imóveis
          </span>
        </div>

        <div className="flex flex-1 flex-col p-6 md:p-8">
          <div className="flex flex-wrap gap-2">
            {region.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-eme-50 px-3 py-1 text-xs font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>

          <h3 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-foreground">
            {region.name}
          </h3>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            {region.description}
          </p>

          <div className="mt-6 flex gap-3">
            <Link
              href={`/imoveis/busca?regiao=${region.slug}&finalidade=compra`}
              className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-background px-4 py-3 transition-colors hover:border-primary/40"
            >
              <span className="text-lg font-semibold text-foreground">{region.forSale}</span>
              <span className="text-xs text-muted-foreground">para comprar</span>
            </Link>
            <Link
              href={`/imoveis/busca?regiao=${region.slug}&finalidade=aluguel`}
              className="flex flex-1 flex-col rounded-2xl border border-border/70 bg-background px-4 py-3 transition-colors hover:border-primary/40"
            >
              <span className="text-lg font-semibold text-foreground">{region.forRent}</span>
              <span className="text-xs text-muted-foreground">para alugar</span>
            </Link>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bairros e cidades
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {region.areas.map((area) => (
                <span
                  key={area}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          <Link
            href={`/imoveis/regioes/${region.slug}`}
            className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_4px_14px_rgba(35,120,55,0.35)] transition-all duration-200 hover:scale-[1.02] hover:bg-eme-600 active:scale-95"
          >
            Explorar região
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  )
}
