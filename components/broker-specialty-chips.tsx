import { cn } from "@/lib/utils"

export function BrokerSpecialtyChips({
  specialties,
  compact = false,
  emptyLabel,
  className,
}: {
  specialties: string[]
  compact?: boolean
  emptyLabel?: string
  className?: string
}) {
  const normalized = specialties.map((specialty) => specialty.trim()).filter(Boolean)
  const visible = normalized.slice(0, 2)
  const remaining = Math.max(0, normalized.length - visible.length)

  if (!visible.length) {
    return emptyLabel ? <p className="text-xs text-[#7b8491]">{emptyLabel}</p> : null
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((specialty) => (
        <span
          key={specialty}
          className={cn(
            "rounded-full border border-[#dceadf] bg-[#f5fbf6] font-medium text-[#287543]",
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          )}
        >
          {specialty}
        </span>
      ))}
      {remaining > 0 ? (
        <span
          className={cn(
            "rounded-full border border-[#e3e8e4] bg-white font-semibold text-[#66706a]",
            compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          )}
          aria-label={`Mais ${remaining} ${remaining === 1 ? "especialidade" : "especialidades"}`}
        >
          +{remaining}
        </span>
      ) : null}
    </div>
  )
}
