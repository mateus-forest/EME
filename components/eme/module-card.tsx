import type { EmeModule } from "@/lib/eme-modules"
import heroMaterial from "./hero-material.module.css"

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
  animated?: boolean
}) {
  const Icon = module.icon

  const frameClass = mobile
    ? "h-[160px] w-[118px] rounded-[20px]"
    : compact
      ? "h-[228px] w-[166px] rounded-[28px]"
      : "h-[252px] w-[184px] rounded-[30px]"
  const radiusClass = mobile ? "rounded-[20px]" : compact ? "rounded-[28px]" : "rounded-[30px]"

  return (
    <div
      data-module-card={mobile ? "mobile" : "desktop"}
      className={`${heroMaterial.card} relative select-none ${frameClass}${mobile ? " scale-[0.9]" : ""}`}
      style={{
        backfaceVisibility: mobile ? "hidden" : undefined,
        WebkitBackfaceVisibility: mobile ? "hidden" : undefined,
        transform: mobile ? "translateZ(0)" : undefined,
      }}
    >
      <div
        aria-hidden
        data-mobile-glass={mobile ? "static" : undefined}
        className={`${heroMaterial.surface} absolute inset-0 ${radiusClass}`}
      />

      <div
        className={`relative flex h-full flex-col items-center text-center ${mobile ? "px-3 py-4" : compact ? "px-4 py-7" : "px-5 py-9"}`}
      >
        {badge ? (
          <span
            className={`${heroMaterial.badge} absolute left-1/2 -translate-x-1/2 rounded-full border font-semibold uppercase text-eme-dark ${mobile ? "top-2.5 px-2.5 py-px text-[7px] tracking-[0.12em]" : "top-3.5 px-3 py-0.5 text-[9px] tracking-[0.14em]"}`}
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
