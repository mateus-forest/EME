import { LoaderCircle } from "lucide-react"

const upcomingFeatures = [
  ["Vídeo", "com drone"],
  ["Captação", "de imóveis"],
  ["Biblioteca", "de criativos"],
] as const

export function LandingUpcomingFeatures({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <section
      aria-labelledby="landing-upcoming-title"
      className={`absolute bottom-[clamp(2rem,8.25vh,5rem)] left-[clamp(2rem,6.65vw,7rem)] z-20 ${className || ""}`}
    >
      <h2
        id="landing-upcoming-title"
        className={
          compact
            ? "mb-1 pl-0.5 text-[8px] font-semibold tracking-[-0.02em] text-[#f3a000]"
            : "mb-3 pl-2 text-[14px] font-semibold tracking-[-0.02em] text-[#f3a000]"
        }
      >
        3 novidades a caminho
      </h2>

      <div className={compact ? "flex gap-0.5" : "flex gap-1.5"}>
        {upcomingFeatures.map((lines) => (
          <article
            key={lines[0]}
            className={
              compact
                ? "flex h-[51px] w-[45px] flex-col items-center rounded-[9px] border border-white/45 bg-white/40 px-0.5 pb-1 pt-1 text-center shadow-[0_8px_20px_-16px_rgba(35,43,47,0.24)] backdrop-blur-md"
                : "flex h-[110px] w-[74px] flex-col items-center rounded-[13px] border border-white/60 bg-white/55 px-1.5 pb-3.5 pt-2.5 text-center shadow-[0_14px_35px_-24px_rgba(35,43,47,0.3)] backdrop-blur-md"
            }
          >
            {!compact ? (
              <span className="rounded-full bg-[#ffe2a3] px-1.5 py-[3px] text-[6px] font-semibold uppercase leading-none tracking-[0.04em] text-[#f0a000]">
                Em breve
              </span>
            ) : null}

            <LoaderCircle
              aria-hidden="true"
              className={`${compact ? "mt-0.5 size-2.5" : "mt-3 size-4"} animate-spin text-[#ffb000] [animation-duration:1.8s]`}
              strokeWidth={1.7}
            />

            <p
              className={
                compact
                  ? "mt-auto text-[6px] font-semibold leading-[1.05] tracking-[-0.025em] text-[#171d20]"
                  : "mt-auto text-[9px] font-medium leading-[1.15] tracking-[-0.02em] text-[#242b2f]"
              }
            >
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
