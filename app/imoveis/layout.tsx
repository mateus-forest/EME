import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AssistantProvider } from '@/components/marketplace/assistant/assistant-provider'
import './marketplace.css'

export const metadata: Metadata = {
  title: 'EME Imóveis — encontre o imóvel certo',
  description: 'Descubra imóveis de forma simples, visual e inteligente.',
}

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="marketplace-shell">
      <AssistantProvider>{children}</AssistantProvider>
    </div>
  )
}
