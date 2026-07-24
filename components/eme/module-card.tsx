import type { EmeModule } from "@/lib/eme-modules"

export function ModuleCard({
  module,
  compact = false,
}: {
  module: EmeModule
  compact?: boolean
}) {
  const Icon = module.icon

  return (
    <div
      className={`relative select-none ${compact ? "h-[228px] w-[166px] rounded-[28px]" : "h-[252px] w-[184px] rounded-[30px]"}`}
      style={{
        boxShadow:
          "0 26px 44px -20px rgba(28,52,40,0.42), 0 6px 14px -8px rgba(28,52,40,0.28)",
      }}
    >
      <div
        aria-hidden
        className={`absolute inset-0 ${compact ? "rounded-[28px]" : "rounded-[30px]"}`}
        style={{
          background:
            "linear-gradient(140deg, rgba(255,255,255,0.98) 0%, rgba(214,228,220,0.55) 16%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.15) 62%, rgba(214,228,220,0.5) 86%, rgba(255,255,255,0.92) 100%)",
        }}
      />

      <div
        className={`absolute inset-[5px] overflow-hidden bg-gradient-to-b from-white via-white to-[#f3f7f4] backdrop-blur-md transition-[filter] duration-500 ease-out group-hover:brightness-[1.04] ${compact ? "rounded-[23px]" : "rounded-[25px]"}`}
      />
      <div
        aria-hidden
        className={`absolute inset-[5px] ring-1 ring-inset ring-white/70 ${compact ? "rounded-[23px]" : "rounded-[25px]"}`}
      />

      <div
        aria-hidden
        className={`absolute inset-[5px] ${compact ? "rounded-[23px]" : "rounded-[25px]"}`}
        style={{
          background:
            "linear-gradient(150deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 34%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-x-3 top-[3px] h-[3px] rounded-full bg-white opacity-0 blur-[1.5px] transition-opacity duration-500 ease-out group-hover:opacity-90"
      />

      <div className={`relative flex h-full flex-col items-center text-center ${compact ? "px-4 py-7" : "px-5 py-9"}`}>
        <Icon className={`${compact ? "h-7 w-7" : "h-8 w-8"} text-eme`} strokeWidth={1.5} aria-hidden />

        <h3 className={`${compact ? "mt-6 text-[17px]" : "mt-8 text-[18px]"} font-medium tracking-tight text-foreground`}>
          {module.name}
        </h3>
        <p
          className={`${compact ? "mt-2.5 text-[12px] leading-[1.55]" : "mt-3 text-[12.5px] leading-relaxed"} text-pretty font-normal text-muted-foreground`}
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
