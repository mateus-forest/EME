import Image from 'next/image'
import { cn } from '@/lib/utils'

const loaderSizes = {
  sm: { frame: 'h-12 w-12', logo: 'h-10 w-10', inset: 'inset-1' },
  md: { frame: 'h-[78px] w-[78px]', logo: 'h-[66px] w-[66px]', inset: 'inset-[5px]' },
  lg: { frame: 'h-24 w-24', logo: 'h-20 w-20', inset: 'inset-1.5' },
} as const

export function EmeLoader({
  size = 'md',
  className,
  label = 'Carregando',
}: {
  size?: keyof typeof loaderSizes
  className?: string
  label?: string
}) {
  const styles = loaderSizes[size]

  return (
    <div
      className={cn('marketplace-loader relative grid place-items-center', styles.frame, className)}
      aria-label={label}
      role="status"
    >
      <span className="marketplace-loader-halo absolute inset-[16%] rounded-full" aria-hidden="true" />
      <Image
        src="/marketplace/eme-logo-raw.svg"
        alt="EME"
        width={80}
        height={80}
        className={cn('marketplace-loader-logo relative block object-contain', styles.logo)}
        priority
      />
      <span
        className={cn(
          'marketplace-loader-glint pointer-events-none absolute overflow-hidden rounded-[18px]',
          styles.inset,
        )}
        aria-hidden="true"
      />
    </div>
  )
}
