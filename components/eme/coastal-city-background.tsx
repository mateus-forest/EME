import Image from "next/image"

export function CoastalCityBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          transform: "translate3d(calc(var(--px,0) * 1px), calc(var(--py,0) * 1px), 0)",
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
          className="scale-[1.06] object-cover object-[58%_50%] sm:object-[60%_50%] 2xl:object-center"
        />
      </div>

      <div className="absolute inset-0 bg-white/8" />
    </div>
  )
}
