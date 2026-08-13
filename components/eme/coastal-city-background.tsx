import Image from "next/image"

export function CoastalCityBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[#edf4f7]">
      <div
        className="absolute inset-0"
        style={{
          transform: "translate3d(calc(var(--px,0) * 3px), calc(var(--py,0) * 2px), 0) scale(1.035)",
          transition: "transform 0.5s ease-out",
        }}
      >
        <Image
          src="/images/eme-landing-hero-2026-07-28.png"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-[58%_50%] saturate-[0.86] contrast-[1.03] sm:object-[60%_50%] 2xl:object-center"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(112deg,rgba(255,249,240,0.44)_0%,rgba(255,255,255,0.08)_42%,rgba(194,222,235,0.16)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_20%_28%,rgba(255,249,231,0.62),transparent_72%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(238,247,251,0.15)_0%,transparent_48%,rgba(16,48,31,0.13)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(115%_110%_at_50%_34%,transparent_54%,rgba(7,27,18,0.2)_100%)]" />
    </div>
  )
}
