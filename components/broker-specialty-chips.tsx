"use client"

import { cn } from "@/lib/utils"

export function BrokerSpecialtyChips({
  specialties,
  compact = false,
  singleLine = false,
  hero = false,
  liquidGlass = false,
  emptyLabel,
  className,
}: {
  specialties: string[]
  compact?: boolean
  singleLine?: boolean
  hero?: boolean
  liquidGlass?: boolean
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
            hero
              ? "max-w-full px-2 py-0.5 text-center text-[10px] leading-4 sm:px-2.5 sm:text-[11px]"
              : compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            singleLine && !hero && "min-w-0 max-w-[9rem] truncate sm:max-w-[12rem]",
            liquidGlass && "relative overflow-hidden border-white/65 bg-white/88 text-[#1d6638] shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_1px_0_0_rgba(255,255,255,.42),0_6px_14px_rgba(25,56,38,.09)] backdrop-blur-[20px] backdrop-saturate-[1.5] before:pointer-events-none before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-white/85 supports-[backdrop-filter]:bg-white/0 supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.52),rgba(255,255,255,.25))] lg:supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.60),rgba(255,255,255,.34))]",
          )}
        >
          {specialty}
        </span>
      ))}
      {remaining > 0 ? (
        <details
          className="group relative shrink-0 self-center"
          onToggle={(event) => {
            if (!event.currentTarget.open) return
            const summary = event.currentTarget.querySelector("summary")
            if (!summary) return
            event.currentTarget.style.setProperty("--specialty-popover-top", `${summary.getBoundingClientRect().bottom + 6}px`)
          }}
        >
          <summary className={cn(
            "cursor-pointer list-none whitespace-nowrap rounded-full marker:hidden",
            hero
              ? "inline-flex items-center border border-[#dceadf] bg-[#f5fbf6] px-2 py-0.5 text-[10px] font-medium leading-4 text-[#287543] hover:border-[#c8dfcd] hover:bg-[#edf8ef] sm:px-2.5 sm:text-[11px]"
              : compact ? "px-1.5 text-[10px] italic text-[#7a837e] hover:text-[#287543]" : "px-1.5 text-xs italic text-[#7a837e] hover:text-[#287543]",
            liquidGlass && "relative overflow-hidden border border-white/65 bg-white/88 text-[#1d6638] shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_1px_0_0_rgba(255,255,255,.42),0_6px_14px_rgba(25,56,38,.09)] backdrop-blur-[20px] backdrop-saturate-[1.5] before:pointer-events-none before:absolute before:inset-x-2 before:top-0 before:h-px before:bg-white/85 supports-[backdrop-filter]:bg-white/0 supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.52),rgba(255,255,255,.25))] hover:border-white hover:bg-white/58 lg:supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.60),rgba(255,255,255,.34))]",
          )}>
            {hero ? `+${remaining}` : `+${remaining} ${remaining === 1 ? "especialidade" : "especialidades"}`}
          </summary>
          <div className={cn(
            "invisible fixed inset-x-2 top-[var(--specialty-popover-top)] z-[80] mx-auto grid w-auto min-w-0 max-w-[min(18rem,calc(100vw-1rem))] gap-1.5 rounded-xl border border-[#dfe7e1] bg-white p-2 opacity-0 shadow-[0_14px_34px_rgba(35,55,43,.16)] transition group-hover:visible group-hover:opacity-100 group-open:visible group-open:opacity-100 sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+.4rem)] sm:mx-0 sm:w-max sm:min-w-48",
            liquidGlass && "border-white/65 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.92),inset_1px_0_0_rgba(255,255,255,.38),0_8px_20px_rgba(25,54,38,.11)] backdrop-blur-[22px] backdrop-saturate-[1.5] supports-[backdrop-filter]:bg-white/0 supports-[backdrop-filter]:bg-[linear-gradient(145deg,rgba(255,255,255,.66),rgba(255,255,255,.36))]",
          )}>
            {hidden.map((specialty) => <span key={specialty} className={cn("max-w-full break-words rounded-lg bg-[#f5fbf6] px-2.5 py-1.5 text-xs font-medium text-[#287543]", liquidGlass && "border border-white/75 bg-white/72")}>{specialty}</span>)}
          </div>
        </details>
      ) : null}
    </div>
  )
}
