import { cn } from '@/lib/utils'

export function BrokerSpecialtyChips({
  specialties,
  className,
  maxVisible = 2,
}: {
  specialties: string[]
  className?: string
  maxVisible?: number
}) {
  const items = specialties.length ? specialties : ['Atendimento imobiliário']
  const visible = items.slice(0, maxVisible)
  const remaining = Math.max(0, items.length - visible.length)

  return (
    <div className={cn('flex min-w-0 items-start gap-1.5', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {visible.map((specialty) => (
          <span key={specialty} title={specialty} className="max-w-full truncate whitespace-nowrap rounded-full border border-primary/15 bg-eme-50 px-2 py-0.5 text-[11px] font-medium leading-5 text-primary">
            {specialty}
          </span>
        ))}
      </div>
      {remaining ? <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium leading-5 text-muted-foreground">+{remaining}</span> : null}
    </div>
  )
}
