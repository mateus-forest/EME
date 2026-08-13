import { Check, Sparkles, Circle } from 'lucide-react'
import { compatibilityLabel, type Compatibility } from '@/lib/marketplace/search-data'
import { cn } from '@/lib/utils'

const styles: Record<Compatibility, string> = {
  // Verde de marca para as recomendações mais fortes.
  muito: 'bg-primary text-primary-foreground',
  boa: 'bg-eme-50 text-eme-700 ring-1 ring-inset ring-primary/20',
  // Tom neutro quente e discreto — não introduz nova cor forte.
  considerar: 'bg-secondary text-secondary-foreground ring-1 ring-inset ring-border',
}

const icons: Record<Compatibility, typeof Check> = {
  muito: Sparkles,
  boa: Check,
  considerar: Circle,
}

export function CompatibilityBadge({
  level,
  className,
}: {
  level: Compatibility
  className?: string
}) {
  const Icon = icons[level]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        styles[level],
        className,
      )}
    >
      <Icon
        className={cn('h-3.5 w-3.5', level === 'considerar' && 'fill-current')}
        aria-hidden="true"
      />
      {compatibilityLabel[level]}
    </span>
  )
}
