import type { EmeModule } from "@/lib/eme-modules"

type ModuleCardContent = Pick<EmeModule, "name" | "description" | "icon">

export function ModuleCard({
  module,
  compact = false,
  mobile = false,
  badge,
  animated = false,
}: {
  module: ModuleCardContent
  compact?: boolean
  mobile?: boolean
  badge?: string
  animated?: boolean
}) {
  const Icon = module.icon

  const glassFilter = animated
    ? mobile
      ? "blur(10px) saturate(108%)"
      : "blur(14px) saturate(114%)"
    : mobile
      ? "blur(12px) saturate(112%)"
      : "blur(20px) saturate(116%)"

  const frameClass = mobile
    ? "h-[160px] w-[118px] rounded-[20px]"
    : compact
      ? "h-[228px] w-[166px] rounded-[28px]"
      : "h-[252px] w-[184px] rounded-[30px]"
  const radiusClass = mobile ? "rounded-[20px]" : compact ? "rounded-[28px]" : "rounded-[30px]"

  return (
    <div
      data-module-card={mobile ? "mobile" : "desktop"}
      className={`eme-landing-glass-card relative select-none ${frameClass}`}
      style={{
        backfaceVisibility: mobile ? "hidden" : undefined,
        WebkitBackfaceVisibility: mobile ? "hidden" : undefined,
        transform: mobile ? "translateZ(0)" : undefined,
        boxShadow: mobile
          ? "0 20px 42px -24px rgba(20,45,32,0.38), 0 8px 20px -15px rgba(20,45,32,0.2), inset 0 1px 0 rgba(255,255,255,0.92)"
          : "0 34px 72px -30px rgba(20,45,32,0.34), 0 13px 30px -20px rgba(20,45,32,0.2), inset 0 1px 0 rgba(255,255,255,0.94)",
      }}
    >
      {/* True glass fill — translucent (not opaque white) so the busy skyline/pedestal behind
          each card stays faintly visible through it, blurred into a soft frosted wash. */}
      <div
        aria-hidden
        data-mobile-glass={mobile ? "static" : undefined}
        className={`eme-landing-glass-card__surface absolute inset-0 overflow-hidden ${radiusClass}`}
        style={{
          background:
            mobile
              ? "linear-gradient(150deg, rgba(255,255,255,0.76) 0%, rgba(247,251,248,0.6) 58%, rgba(225,239,231,0.48) 100%)"
              : "linear-gradient(150deg, rgba(255,255,255,0.7) 0%, rgba(247,251,248,0.52) 62%, rgba(225,239,231,0.42) 100%)",
          border: "1px solid rgba(255,255,255,0.7)",
          WebkitBackdropFilter: glassFilter,
          backdropFilter: glassFilter,
        }}
      />
      <div
        aria-hidden
        className={`absolute inset-0 ${radiusClass}`}
        style={{
          background:
            "radial-gradient(ellipse at 48% 12%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0.14) 48%, rgba(205,226,215,0.08) 100%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-x-4 top-[2px] h-[2px] rounded-full bg-white/90 opacity-70 blur-[1px]"
      />

      <div
        className={`relative flex h-full flex-col items-center text-center ${mobile ? "px-3 py-4" : compact ? "px-4 py-7" : "px-5 py-9"}`}
      >
        {badge ? (
          <span
            className={`eme-landing-glass-badge absolute left-1/2 -translate-x-1/2 rounded-full border border-eme/10 bg-eme/12 font-semibold uppercase text-eme-dark ${mobile ? "top-2.5 px-2.5 py-px text-[7px] tracking-[0.12em]" : "top-3.5 px-3 py-0.5 text-[9px] tracking-[0.14em]"}`}
          >
            {badge}
          </span>
        ) : null}
        <Icon
          className={`${mobile ? "h-5 w-5" : compact ? "h-7 w-7" : "h-8 w-8"} text-eme`}
          strokeWidth={1.5}
          aria-hidden
        />

        <h3
          className={`${mobile ? "mt-4 text-[13.5px]" : compact ? "mt-6 text-[17px]" : "mt-8 text-[18px]"} font-medium tracking-[-0.01em] text-foreground`}
        >
          {module.name}
        </h3>
        <p
          className={`${mobile ? "mt-1.5 text-[10px] leading-[1.4]" : compact ? "mt-2.5 text-[12px] leading-[1.6]" : "mt-3 text-[12.5px] leading-[1.65]"} text-pretty font-normal tracking-[0.005em] text-muted-foreground`}
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
