import { cn } from "@/lib/utils"

export function BrokerSpecialtyChips({
  specialties,
  compact = false,
  singleLine = false,
  emptyLabel,
  className,
}: {
  specialties: string[]
  compact?: boolean
  singleLine?: boolean
  emptyLabel?: string
  className?: string
}) {
  const normalized = specialties.map((specialty) => specialty.trim()).filter(Boolean)
  const visible = normalized.slice(0, 2)
  const hidden = normalized.slice(2)
  const remaining = Math.max(0, normalized.length - visible.length)

  if (!visible.length) {
    return emptyLabel ? <p className="text-xs text-[#7b8491]">{emptyLabel}</p> : null
  }

  return (
    <div className={cn("flex items-center gap-1.5", singleLine ? "min-w-0 flex-nowrap" : "flex-wrap", className)}>
      {visible.map((specialty) => (
        <span
          key={specialty}
          className={cn(
            "rounded-full border border-[#dceadf] bg-[#f5fbf6] font-medium text-[#287543]",
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            singleLine && "min-w-0 max-w-[9rem] truncate sm:max-w-[12rem]",
          )}
        >
          {specialty}
        </span>
      ))}
      {remaining > 0 ? (
        <details className="group relative shrink-0">
          <summary className={cn("cursor-pointer list-none whitespace-nowrap rounded-full px-1.5 text-[#7a837e] marker:hidden hover:text-[#287543]", compact ? "text-[10px] italic" : "text-xs italic")}>
            +{remaining} {remaining === 1 ? "especialidade" : "especialidades"}
          </summary>
          <div className="invisible absolute left-0 top-[calc(100%+.4rem)] z-30 grid min-w-48 gap-1.5 rounded-xl border border-[#dfe7e1] bg-white p-2 opacity-0 shadow-[0_14px_34px_rgba(35,55,43,.16)] transition group-hover:visible group-hover:opacity-100 group-open:visible group-open:opacity-100">
            {hidden.map((specialty) => <span key={specialty} className="rounded-lg bg-[#f5fbf6] px-2.5 py-1.5 text-xs font-medium text-[#287543]">{specialty}</span>)}
          </div>
        </details>
      ) : null}
    </div>
  )
}
