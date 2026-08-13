import Image from 'next/image'
import { cn } from '@/lib/utils'

export function AssistantMark({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-xl bg-foreground text-background shadow-sm',
        size === 'sm' && 'rounded-lg',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/marketplace/eme-logo-raw.svg"
        alt=""
        width={48}
        height={48}
        className={cn(
          'brightness-0 invert',
          size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-6 w-6' : 'h-8 w-8',
        )}
      />
    </span>
  )
}
