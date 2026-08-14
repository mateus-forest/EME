import type { EmeModule } from "@/lib/eme-modules"

type ModuleCardContent = Pick<EmeModule, "name" | "description" | "icon">

export function ModuleCard({
  module,
  compact = false,
  mobile = false,
  badge,
}: {
  module: ModuleCardContent
  compact?: boolean
  mobile?: boolean
  badge?: string
}) {
  const Icon = module.icon

  const frameClass = mobile
    ? "h-[172px] w-[126px] rounded-[22px]"
    : compact
      ? "h-[228px] w-[166px] rounded-[28px]"
      : "h-[252px] w-[184px] rounded-[30px]"
  const radiusClass = mobile ? "rounded-[22px]" : compact ? "rounded-[28px]" : "rounded-[30px]"

  return (
    <div
      data-module-card={mobile ? "mobile" : "desktop"}
      className={`relative select-none ${frameClass}`}
      style={{
        backfaceVisibility: mobile ? "hidden" : undefined,
        WebkitBackfaceVisibility: mobile ? "hidden" : undefined,
        transform: mobile ? "translateZ(0)" : undefined,
        boxShadow: mobile
          ? "0 18px 38px -22px rgba(28,52,40,0.38), 0 8px 18px -14px rgba(28,52,40,0.2), inset 0 1px 0 rgba(255,255,255,0.94)"
          : "0 30px 64px -26px rgba(28,52,40,0.34), 0 12px 28px -18px rgba(28,52,40,0.2), inset 0 1px 0 rgba(255,255,255,0.95)",
      }}
    >
      {/* True glass fill — translucent (not opaque white) so the busy skyline/pedestal behind
          each card stays faintly visible through it, blurred into a soft frosted wash. */}
      <div
        aria-hidden
        data-mobile-glass={mobile ? "static" : undefined}
        className={`absolute inset-0 overflow-hidden ${mobile ? "" : "backdrop-blur-[12px] sm:backdrop-blur-[18px]"} ${radiusClass}`}
        style={{
          background:
            mobile
              ? "linear-gradient(155deg, rgba(255,255,255,0.94) 0%, rgba(247,250,248,0.86) 58%, rgba(235,244,239,0.8) 100%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(247,250,248,0.8) 100%)",
          border: "1px solid rgba(174,192,183,0.34)",
        }}
      />
      <div
        aria-hidden
        className={`absolute inset-0 ${radiusClass}`}
        style={{
          background:
            "radial-gradient(ellipse at 50% 24%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 54%, rgba(214,227,220,0.1) 100%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-x-4 top-[2px] h-[2px] rounded-full bg-white/90 opacity-70 blur-[1px]"
      />

      <div
        className={`relative flex h-full flex-col items-center text-center ${mobile ? "px-3 py-[18px]" : compact ? "px-4 py-7" : "px-5 py-9"}`}
      >
        {badge ? (
          <span
            className={`absolute left-1/2 -translate-x-1/2 rounded-full border border-eme/10 bg-eme/12 font-semibold uppercase text-eme-dark ${mobile ? "top-2.5 px-2.5 py-px text-[7px] tracking-[0.12em]" : "top-3.5 px-3 py-0.5 text-[9px] tracking-[0.14em]"}`}
          >
            {badge}
          </span>
        ) : null}
        <Icon
          className={`${mobile ? "h-[22px] w-[22px]" : compact ? "h-7 w-7" : "h-8 w-8"} text-eme`}
          strokeWidth={1.5}
          aria-hidden
        />

        <h3
          className={`${mobile ? "mt-[18px] text-[14px]" : compact ? "mt-6 text-[17px]" : "mt-8 text-[18px]"} font-medium tracking-[-0.01em] text-foreground`}
        >
          {module.name}
        </h3>
        <p
          className={`${mobile ? "mt-2 text-[10.5px] leading-[1.45]" : compact ? "mt-2.5 text-[12px] leading-[1.6]" : "mt-3 text-[12.5px] leading-[1.65]"} text-pretty font-normal tracking-[0.005em] text-muted-foreground`}
        >
          {module.description}
        </p>

        <span
          className={`${mobile ? "text-[7.5px] tracking-[0.32em]" : compact ? "text-[9px] tracking-[0.42em]" : "text-[10px] tracking-[0.42em]"} mt-auto font-medium text-eme/60`}
        >
          EME
        </span>
      </div>
    </div>
  )
}
