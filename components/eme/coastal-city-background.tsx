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
          src="/images/eme-landing-hero-2026-08-13.webp"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-[50%_38%] sm:object-[50%_40%] 2xl:object-[50%_42%]"
        />
      </div>
    </div>
  )
}
