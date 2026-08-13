'use client'

import { useEffect } from 'react'
import { trackMarketplaceEvent } from '@/lib/marketplace/analytics'

export function PropertyViewTracker({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    void trackMarketplaceEvent({ eventType: 'property_view', propertyId })
  }, [propertyId])
  return null
}
