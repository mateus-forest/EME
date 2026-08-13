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
        'grid shrink-0 place-items-center overflow-hidden rounded-xl bg-black text-white shadow-sm',
        size === 'sm' && 'rounded-lg',
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/marketplace/cos-logo.png"
        alt=""
        width={48}
        height={48}
        priority
        className="h-full w-full object-cover"
      />
    </span>
  )
}
