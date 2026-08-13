'use client'

import { useInterest } from '@/components/marketplace/property/interest-provider'
import { formatPrice } from '@/lib/marketplace/search-data'

export function MobileInterestBar({ price }: { price: number }) {
  const { open } = useInterest()

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] leading-none text-muted-foreground">Valor</p>
          <p className="mt-1 text-lg font-semibold leading-none text-foreground">
            {formatPrice(price)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => open('cta-mobile')}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-[0_6px_20px_rgba(35,120,55,0.32)] transition-transform active:scale-95"
        >
          Tenho interesse
        </button>
      </div>
    </div>
  )
}
