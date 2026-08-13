import Image from 'next/image'
import { cn } from '@/lib/utils'

const sizes = {
  sm: { mark: 'h-8 w-8', name: 'text-lg', label: 'text-sm' },
  md: { mark: 'h-9 w-9', name: 'text-xl', label: 'text-[15px]' },
  lg: { mark: 'h-11 w-11', name: 'text-2xl', label: 'text-base' },
} as const

export function Logo({
  className,
  labelClassName,
  size = 'sm',
  markOnly = false,
}: {
  className?: string
  labelClassName?: string
  size?: keyof typeof sizes
  markOnly?: boolean
}) {
  const s = sizes[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/marketplace/eme-logo-raw.svg"
        alt="EME Imóveis"
        width={48}
        height={48}
        className={cn('shrink-0', s.mark)}
        priority
      />
      {!markOnly && (
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className={cn('font-semibold tracking-tight text-foreground', s.name)}>EME</span>
          <span className={cn('font-normal text-muted-foreground', s.label, labelClassName)}>
            Imóveis
          </span>
        </span>
      )}
    </span>
  )
}
