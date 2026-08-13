import type { EmeModule } from "@/lib/eme-modules"

type ModuleCardContent = Pick<EmeModule, "name" | "description" | "icon">

export function ModuleCard({
  module,
  compact = false,
  badge,
}: {
  module: ModuleCardContent
  compact?: boolean
  badge?: string
}) {
  const Icon = module.icon

  return (
    <div
      className={`relative select-none ${compact ? "h-[228px] w-[166px] rounded-[28px]" : "h-[252px] w-[184px] rounded-[30px]"}`}
      style={{
        boxShadow:
          "0 30px 64px -26px rgba(28,52,40,0.34), 0 12px 28px -18px rgba(28,52,40,0.2), inset 0 1px 0 rgba(255,255,255,0.95)",
      }}
    >
      {/* True glass fill — translucent (not opaque white) so the busy skyline/pedestal behind
          each card stays faintly visible through it, blurred into a soft frosted wash. */}
      <div
        aria-hidden
        className={`absolute inset-0 overflow-hidden backdrop-blur-[12px] sm:backdrop-blur-[18px] ${compact ? "rounded-[28px]" : "rounded-[30px]"}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(247,250,248,0.8) 100%)",
          border: "1px solid rgba(174,192,183,0.34)",
        }}
      />
      <div
        aria-hidden
        className={`absolute inset-0 ${compact ? "rounded-[28px]" : "rounded-[30px]"}`}
        style={{
          background:
            "radial-gradient(ellipse at 50% 24%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 54%, rgba(214,227,220,0.1) 100%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-x-4 top-[2px] h-[2px] rounded-full bg-white/90 opacity-70 blur-[1px]"
      />

      <div className={`relative flex h-full flex-col items-center text-center ${compact ? "px-4 py-7" : "px-5 py-9"}`}>
        {badge ? (
          <span className="absolute left-1/2 top-3.5 -translate-x-1/2 rounded-full border border-eme/10 bg-eme/12 px-3 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-eme-dark">
            {badge}
          </span>
        ) : null}
        <Icon className={`${compact ? "h-7 w-7" : "h-8 w-8"} text-eme`} strokeWidth={1.5} aria-hidden />

        <h3
          className={`${compact ? "mt-6 text-[17px]" : "mt-8 text-[18px]"} font-medium tracking-[-0.01em] text-foreground`}
        >
          {module.name}
        </h3>
        <p
          className={`${compact ? "mt-2.5 text-[12px] leading-[1.6]" : "mt-3 text-[12.5px] leading-[1.65]"} text-pretty font-normal tracking-[0.005em] text-muted-foreground`}
        >
          {module.description}
        </p>

        <span className={`${compact ? "text-[9px]" : "text-[10px]"} mt-auto font-medium tracking-[0.42em] text-eme/60`}>
          EME
        </span>
      </div>
    </div>
  )
}
