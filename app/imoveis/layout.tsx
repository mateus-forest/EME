import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AssistantProvider } from '@/components/marketplace/assistant/assistant-provider'
import './marketplace.css'
import { getMarketplaceBrokers, getMarketplaceProperties } from '@/lib/marketplace/server-data'

export const metadata: Metadata = {
  title: 'EME Imóveis — encontre o imóvel certo',
  description: 'Descubra imóveis de forma simples, visual e inteligente.',
}

export const dynamic = 'force-dynamic'

export default async function MarketplaceLayout({ children }: { children: ReactNode }) {
  const [properties, brokers] = await Promise.all([getMarketplaceProperties(), getMarketplaceBrokers()])
  return (
    <div className="marketplace-shell">
      <AssistantProvider properties={properties.slice(0, 2)} brokers={brokers}>{children}</AssistantProvider>
    </div>
  )
}
