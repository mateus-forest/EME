'use client'

import Image from 'next/image'
import { BadgeCheck } from 'lucide-react'
import { MarketplaceChatLauncher } from '@/components/marketplace/chat/marketplace-chat-launcher'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { createWhatsAppUrl } from '@/lib/whatsapp'
import type { BrokerProfile } from '@/lib/marketplace/pages-data'

export function BrokerPanel({ broker, creci, propertyId, propertyTitle }: { broker: BrokerProfile; creci: string; propertyId: string; propertyTitle: string }) {
  return <div className="rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
    <div className="flex items-center gap-4"><div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl"><Image src={broker.image || '/marketplace/placeholder-user.jpg'} alt={broker.name} fill sizes="56px" className="object-cover" /></div><div className="min-w-0"><div className="flex items-center gap-1.5"><h3 className="text-pretty text-base font-semibold leading-tight text-foreground">{broker.name}</h3><BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Perfil verificado" /></div><p className="mt-0.5 text-xs text-muted-foreground">{creci}</p></div></div>
    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{broker.specialty}</p>
    <div className="mt-5 flex flex-col gap-2.5"><MarketplaceChatLauncher brokerSlug={broker.slug} brokerName={broker.name} brokerPhone={broker.phone} propertyId={propertyId} propertyTitle={propertyTitle} className="w-full" />{broker.phone ? <a href={createWhatsAppUrl(broker.phone, `Olá, gostaria de saber mais sobre ${propertyTitle}.`)} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-eme-50"><WhatsappGlyph className="h-4 w-4" />WhatsApp</a> : null}</div>
    <p className="mt-4 text-pretty text-xs leading-relaxed text-muted-foreground">A conversa fica salva no EME e o corretor é notificado imediatamente.</p>
  </div>
}
