import { BriefcaseBusiness, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrokerSpecialtyChips({
  specialties,
  className,
  compact = false,
}: {
  specialties: string[]
  className?: string
  compact?: boolean
}) {
  const items = specialties.length ? specialties : ['Atendimento imobiliário']
  const first = items[0]
  const showSecond = items.length > 1 && (compact || (first.length <= 56 && items[1].length <= 34))
  const remaining = Math.max(0, items.length - 1 - (showSecond ? 1 : 0))
  const firstTextSize = compact
    ? first.length > 72 ? 'text-[8px]' : first.length > 44 ? 'text-[9px]' : 'text-[10px]'
    : first.length > 90 ? 'text-[9px]' : first.length > 58 ? 'text-[10px]' : 'text-[11px]'

  return (
    <div className={cn('flex min-w-0 flex-col justify-start overflow-hidden', compact ? 'h-[60px] gap-1.5' : 'h-[82px] gap-2', className)}>
      <span
        title={first}
        className={cn(
          'flex w-fit max-w-full items-start bg-[#f1f5f0] font-medium leading-[1.18] text-primary',
          compact ? 'min-h-7 gap-1.5 rounded-lg px-2 py-1.5' : 'min-h-9 gap-2 rounded-xl px-3 py-2',
          firstTextSize,
        )}
      >
        <Building2 className={cn('mt-px shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden="true" />
        <span className="break-words">{first}</span>
      </span>

      {items.length > 1 ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {showSecond ? (
            <span title={items[1]} className={cn('inline-flex min-w-0 max-w-[calc(100%-2.5rem)] items-center whitespace-nowrap rounded-full bg-[#f1f5f0] font-medium text-primary', compact ? 'gap-1 px-2 py-0.5 text-[9px]' : 'gap-1.5 px-2.5 py-1 text-[10px]')}>
              <BriefcaseBusiness className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} aria-hidden="true" />
              <span className={compact ? 'truncate' : undefined}>{items[1]}</span>
            </span>
          ) : null}
          {remaining ? (
            <span
              title={items.slice(showSecond ? 2 : 1).join(', ')}
              aria-label={`Mais ${remaining} especialidades: ${items.slice(showSecond ? 2 : 1).join(', ')}`}
              className={cn('inline-flex shrink-0 items-center rounded-full bg-[#f1f5f0] font-semibold text-primary', compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]')}
            >
              +{remaining}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
