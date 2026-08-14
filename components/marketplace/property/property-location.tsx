'use client'

import { useState } from 'react'
import { ExternalLink, GraduationCap, Landmark, MapPin, MapPinned, ShoppingCart } from 'lucide-react'
import type { PropertyDetail } from '@/lib/marketplace/property-detail'

const routineIcons = {
  center: Landmark,
  market: ShoppingCart,
  school: GraduationCap,
} as const

export function PropertyLocation({
  city,
  state,
  neighborhood,
  routine,
}: {
  city: string
  state: string
  neighborhood: string
  routine: PropertyDetail['routine']
}) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const approximateLocation = [neighborhood, city, state].filter(Boolean).join(', ')
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(approximateLocation)}&z=13&output=embed`
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(approximateLocation)}`

  return (
    <div>
      <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
        Localização e rotina
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
        <div className="relative min-h-[260px] overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted shadow-[var(--shadow-soft)]">
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_28%_24%,rgba(78,182,105,.15),transparent_34%),linear-gradient(145deg,var(--color-eme-50),var(--color-muted))] p-8 text-center">
            <div>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-background text-primary shadow-sm">
                <MapPinned className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-foreground">Mapa interativo da região</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Carregando a referência aproximada de {approximateLocation}.
              </p>
            </div>
          </div>
          <iframe
            title={`Mapa aproximado de ${approximateLocation}`}
            src={mapUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            onLoad={() => setMapLoaded(true)}
            className={`absolute inset-0 h-full w-full border-0 grayscale-[.15] transition-opacity duration-300 ${mapLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className="glass-strong absolute left-3 top-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-foreground shadow-[var(--shadow-soft)]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">Localização aproximada · {approximateLocation}</span>
          </div>
          <a
            href={externalMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-strong absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] transition-colors hover:text-primary"
          >
            Abrir mapa
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        {routine.length ? (
          <ul className="flex flex-col gap-3">
            {routine.map((item) => {
              const Icon = routineIcons[item.icon]
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-[var(--shadow-soft)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-eme-50 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex min-h-32 items-center rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-soft)]">
            <p className="text-sm leading-relaxed text-muted-foreground">
              As referências de rotina ainda não foram informadas. O corretor pode orientar sobre serviços e deslocamentos da região.
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        O mapa usa apenas bairro e cidade para preservar o endereço exato. A localização completa é compartilhada pelo profissional responsável.
      </p>
    </div>
  )
}
