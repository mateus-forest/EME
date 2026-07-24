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
          src="/balneario-camboriu.svg"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="scale-105 object-cover object-center opacity-90 blur-[2px]"
        />
      </div>

      <div className="absolute inset-0 bg-background/35" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_38%,transparent_0%,transparent_40%,var(--background)_92%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />
    </div>
  )
}
