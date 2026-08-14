'use client'

import { MarketplaceChatLauncher } from '@/components/marketplace/chat/marketplace-chat-launcher'
import { WhatsappGlyph } from '@/components/marketplace/property/whatsapp-glyph'
import { createWhatsAppUrl } from '@/lib/whatsapp'
import { trackMarketplaceEvent } from '@/lib/marketplace/analytics'

export function BrokerContactForm({ brokerName, brokerSlug, brokerPhone }: { brokerName: string; brokerSlug: string; brokerPhone: string }) {
  return <div className="rounded-[1.5rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-soft)]">
    <h3 className="text-lg font-semibold text-foreground">Falar com {brokerName.split(' ')[0]}</h3>
    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Inicie um atendimento no EME. O histórico fica salvo e pode continuar a qualquer momento.</p>
    <MarketplaceChatLauncher brokerSlug={brokerSlug} brokerName={brokerName} brokerPhone={brokerPhone} className="mt-5 w-full" />
    {brokerPhone ? <a onClick={() => void trackMarketplaceEvent({ eventType: 'whatsapp_click', catalogSlug: brokerSlug })} href={createWhatsAppUrl(brokerPhone, `Olá, encontrei seu perfil no Marketplace EME e gostaria de conhecer seus imóveis.`)} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-eme-50"><WhatsappGlyph className="h-4 w-4" />Continuar pelo WhatsApp</a> : null}
  </div>
}
