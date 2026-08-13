// Breakpoint matches the device switcher in eme-experience.tsx (max-width: 767px):
// at sm (640px) the mobile experience is still active, so jumping to the tablet
// size there made the logo oversized for ~640-767px phones/small tablets.
const LOGO_SIZE = "h-auto w-[210px] max-w-none md:w-[456px] lg:w-[552px]"

export function EmeLogoSculpture({ widthPx }: { widthPx?: number }) {
  // When the stage supplies a width, the logo is sized from the background
  // plate's own scale so it always sits on the podium exactly as in the render.
  const sizeClass = widthPx ? "h-auto max-w-none" : LOGO_SIZE
  const sizeStyle = widthPx ? { width: `${widthPx}px` } : undefined

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ transformStyle: "preserve-3d" }}
    >
      <img
        src="/eme-logo-3d.svg"
        alt=""
        aria-hidden
        draggable={false}
        className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 ${sizeClass}`}
        style={{
          ...sizeStyle,
          transformOrigin: "50% 96%",
          transform:
            "translate(9%, 6%) scaleY(0.34) skewX(-36deg) rotate(1deg)",
          filter: "brightness(0) saturate(0) blur(9px)",
          opacity: 0.16,
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 42%, rgba(0,0,0,0.25) 78%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.7) 42%, rgba(0,0,0,0.25) 78%, rgba(0,0,0,0) 100%)",
        }}
      />

      <img
        src="/eme-logo-3d.svg"
        alt="EME"
        draggable={false}
        className={`relative ${sizeClass}`}
        style={{ ...sizeStyle, filter: "saturate(0.92)" }}
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 ${sizeClass}`}
        style={{
          ...sizeStyle,
          maskImage: "url(/eme-logo-3d.svg)",
          WebkitMaskImage: "url(/eme-logo-3d.svg)",
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          background:
            "radial-gradient(140% 120% at 62% 92%, rgba(18,42,26,0.4) 0%, rgba(18,42,26,0.16) 34%, rgba(18,42,26,0) 66%)",
          mixBlendMode: "multiply",
          opacity: 0.7,
        }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 ${sizeClass}`}
        style={{
          ...sizeStyle,
          maskImage: "url(/eme-logo-3d.svg)",
          WebkitMaskImage: "url(/eme-logo-3d.svg)",
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          background:
            "linear-gradient(133deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0) 74%)",
          mixBlendMode: "soft-light",
          opacity: 0.85,
        }}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 ${sizeClass}`}
        style={{
          ...sizeStyle,
          maskImage: "url(/eme-logo-3d.svg)",
          WebkitMaskImage: "url(/eme-logo-3d.svg)",
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          background:
            "radial-gradient(90% 90% at 26% 16%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0) 56%)",
          mixBlendMode: "soft-light",
          opacity: 0.8,
        }}
      />

      <div
        aria-hidden
        className="absolute left-1/2 top-full h-10 w-[200px] -translate-x-1/2 -translate-y-[64px] rounded-[100%] bg-foreground/8 blur-2xl sm:w-[268px] sm:-translate-y-[84px] lg:w-[324px] lg:-translate-y-[100px]"
      />
    </div>
  )
}
