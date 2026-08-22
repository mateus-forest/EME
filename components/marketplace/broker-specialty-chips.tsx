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
  const hidden = items.slice(maxVisible)
  const chipClass = 'inline-flex max-w-full items-center rounded-full border border-white/80 bg-white/58 px-2 py-0.5 text-[10px] font-medium leading-4 text-[#153d30] shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_3px_10px_rgba(37,43,37,.04)] backdrop-blur-[12px]'

  return (
    <div className={cn('relative z-20 flex min-w-0 flex-wrap items-start gap-1.5', className)}>
      {visible.map((specialty, index) => (
        <span key={specialty} title={specialty} className={cn(chipClass, index === 0 ? 'whitespace-normal break-words' : 'truncate whitespace-nowrap')}>
          {specialty}
        </span>
      ))}
      {remaining ? (
        <details className="group relative shrink-0 pointer-events-auto">
          <summary className={cn(chipClass, 'cursor-pointer list-none whitespace-nowrap [&::-webkit-details-marker]:hidden')}>+{remaining}</summary>
          <div className="absolute right-0 top-full z-30 mt-2 hidden w-56 flex-wrap gap-1.5 rounded-2xl border border-white/80 bg-[rgba(247,245,241,.96)] p-3 shadow-[0_16px_42px_rgba(35,39,34,.16)] backdrop-blur-[20px] group-hover:flex group-open:flex">
            {hidden.map((specialty) => <span key={specialty} className={cn(chipClass, 'whitespace-normal break-words')}>{specialty}</span>)}
          </div>
        </details>
      ) : null}
    </div>
  )
}
