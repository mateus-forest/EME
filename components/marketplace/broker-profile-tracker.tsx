'use client'

import { useEffect } from 'react'
import { trackMarketplaceEvent } from '@/lib/marketplace/analytics'

export function BrokerProfileTracker({ catalogSlug }: { catalogSlug: string }) {
  useEffect(() => {
    void trackMarketplaceEvent({ eventType: 'marketplace_view', catalogSlug })
  }, [catalogSlug])
  return null
}
