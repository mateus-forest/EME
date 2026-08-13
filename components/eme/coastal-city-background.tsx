import Image from "next/image"

export function CoastalCityBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[#edf4f7]">
      <div
        className="absolute inset-0"
        style={{
          transform: "translate3d(calc(var(--px,0) * 3px), calc(var(--py,0) * 2px), 0) scale(1.02)",
          transition: "transform 0.5s ease-out",
        }}
      >
        {/* The plate carries the podium, floor rings and foliage of the reference
            composition. Its podium sits at 51.2% of the render's width, so the
            horizontal object-position keeps the podium centred under the logo at
            every aspect ratio instead of drifting with the crop. */}
        <Image
          src="/images/eme-landing-hero-2026-07-28.png"
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-[51.2%_50%]"
        />
      </div>

      {/* Only the faintest depth cue: the plate's own grading is the reference. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_115%_at_50%_36%,transparent_62%,rgba(10,34,22,0.1)_100%)]" />
    </div>
  )
}
