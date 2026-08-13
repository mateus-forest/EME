'use client'

import Image from 'next/image'
import { BadgeCheck } from 'lucide-react'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { useInterest } from '@/components/marketplace/property/interest-provider'
import type { Broker } from '@/lib/marketplace/data'

export function BrokerPanel({
  broker,
  creci,
}: {
  broker: Broker
  creci: string
}) {
  const { open } = useInterest()

  return (
    <div className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl">
          <Image
            src={broker.image || '/marketplace/placeholder-user.jpg'}
            alt={broker.name}
            fill
            sizes="56px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-pretty text-base font-semibold leading-tight text-foreground">
              {broker.name}
            </h3>
            <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{creci}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{broker.role}</p>
      {broker.respondsFast && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          Responde rápido
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => open('card-corretora')}
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.32)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          Tenho interesse
        </button>
        <button
          type="button"
          onClick={() => open('card-corretora')}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-eme-50 hover:text-eme-700"
        >
          <WhatsappGlyph className="h-4 w-4" />
          Falar pelo WhatsApp
        </button>
      </div>

      <p className="mt-4 text-pretty text-xs leading-relaxed text-muted-foreground">
        Seu contato será enviado diretamente à corretora responsável.
      </p>
    </div>
  )
}
