import type { EmeModule } from "@/lib/eme-modules"

export function ModuleCard({ module }: { module: EmeModule }) {
  const Icon = module.icon

  return (
    <div
      className="relative h-[252px] w-[184px] select-none rounded-[30px]"
      style={{
        boxShadow:
          "0 26px 44px -20px rgba(28,52,40,0.42), 0 6px 14px -8px rgba(28,52,40,0.28)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 rounded-[30px]"
        style={{
          background:
            "linear-gradient(140deg, rgba(255,255,255,0.98) 0%, rgba(214,228,220,0.55) 16%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.15) 62%, rgba(214,228,220,0.5) 86%, rgba(255,255,255,0.92) 100%)",
        }}
      />

      <div className="absolute inset-[5px] overflow-hidden rounded-[25px] bg-gradient-to-b from-white via-white to-[#f3f7f4] backdrop-blur-md transition-[filter] duration-500 ease-out group-hover:brightness-[1.04]" />
      <div aria-hidden className="absolute inset-[5px] rounded-[25px] ring-1 ring-inset ring-white/70" />

      <div
        aria-hidden
        className="absolute inset-[5px] rounded-[25px]"
        style={{
          background:
            "linear-gradient(150deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 34%)",
        }}
      />

      <div
        aria-hidden
        className="absolute inset-x-3 top-[3px] h-[3px] rounded-full bg-white opacity-0 blur-[1.5px] transition-opacity duration-500 ease-out group-hover:opacity-90"
      />

      <div className="relative flex h-full flex-col items-center px-5 py-9 text-center">
        <Icon className="h-8 w-8 text-eme" strokeWidth={1.5} aria-hidden />

        <h3 className="mt-8 text-[18px] font-medium tracking-tight text-foreground">
          {module.name}
        </h3>
        <p className="mt-3 text-pretty text-[12.5px] font-normal leading-relaxed text-muted-foreground">
          {module.description}
        </p>

        <span className="mt-auto text-[10px] font-medium tracking-[0.42em] text-eme/60">
          EME
        </span>
      </div>
    </div>
  )
}
