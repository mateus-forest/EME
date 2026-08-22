import { LoaderCircle } from "lucide-react"

const upcomingFeatures = [
  ["Vídeo", "com drone"],
  ["Captação", "de imóveis"],
  ["Biblioteca", "de criativos"],
] as const

export function LandingUpcomingFeatures({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="landing-upcoming-title"
      className={`absolute bottom-[clamp(2rem,8.25vh,5rem)] left-[clamp(2rem,6.65vw,7rem)] z-20 ${className || ""}`}
    >
      <h2
        id="landing-upcoming-title"
        className="mb-3 pl-2 text-[14px] font-semibold tracking-[-0.02em] text-[#f3a000]"
      >
        3 novidades a caminho
      </h2>

      <div className="flex gap-1.5">
        {upcomingFeatures.map((lines) => (
          <article
            key={lines[0]}
            className="flex h-[110px] w-[74px] flex-col items-center rounded-[13px] border border-white/60 bg-white/55 px-1.5 pb-3.5 pt-2.5 text-center shadow-[0_14px_35px_-24px_rgba(35,43,47,0.3)] backdrop-blur-md"
          >
            <span className="rounded-full bg-[#ffe2a3] px-1.5 py-[3px] text-[6px] font-semibold uppercase leading-none tracking-[0.04em] text-[#f0a000]">
              Em breve
            </span>

            <LoaderCircle
              aria-hidden="true"
              className="mt-3 size-4 animate-spin text-[#ffb000] [animation-duration:1.8s]"
              strokeWidth={1.7}
            />

            <p className="mt-auto text-[9px] font-medium leading-[1.15] tracking-[-0.02em] text-[#242b2f]">
              {lines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
