import { BriefcaseBusiness, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrokerSpecialtyChips({
  specialties,
  className,
}: {
  specialties: string[]
  className?: string
}) {
  const items = specialties.length ? specialties : ['Atendimento imobiliário']
  const first = items[0]
  const showSecond = items.length > 1 && first.length <= 56 && items[1].length <= 34
  const remaining = Math.max(0, items.length - 1 - (showSecond ? 1 : 0))
  const firstTextSize = first.length > 90 ? 'text-[9px]' : first.length > 58 ? 'text-[10px]' : 'text-[11px]'

  return (
    <div className={cn('flex h-[82px] min-w-0 flex-col justify-start gap-2 overflow-hidden', className)}>
      <span
        title={first}
        className={cn(
          'flex min-h-9 w-fit max-w-full items-start gap-2 rounded-xl bg-[#f1f5f0] px-3 py-2 font-medium leading-[1.18] text-primary',
          firstTextSize,
        )}
      >
        <Building2 className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="break-words">{first}</span>
      </span>

      {items.length > 1 ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {showSecond ? (
            <span title={items[1]} className="inline-flex min-w-0 max-w-[calc(100%-2.5rem)] items-center gap-1.5 whitespace-nowrap rounded-full bg-[#f1f5f0] px-2.5 py-1 text-[10px] font-medium text-primary">
              <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {items[1]}
            </span>
          ) : null}
          {remaining ? (
            <span
              title={items.slice(showSecond ? 2 : 1).join(', ')}
              aria-label={`Mais ${remaining} especialidades: ${items.slice(showSecond ? 2 : 1).join(', ')}`}
              className="inline-flex shrink-0 items-center rounded-full bg-[#f1f5f0] px-2.5 py-1 text-[10px] font-semibold text-primary"
            >
              +{remaining}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
