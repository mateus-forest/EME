"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { ModuleCard } from "@/components/eme/module-card"
import { emeModules, marketplaceModule } from "@/lib/eme-modules"

type StageConfig = {
  radiusX: number
  radiusZ: number
  archLift: number
  baseScale: number
  onlyPriority: boolean
  isMobile: boolean
}

function useStageConfig(): StageConfig {
  const [config, setConfig] = useState<StageConfig>({
    radiusX: 660,
    radiusZ: 150,
    archLift: 250,
    baseScale: 1,
    onlyPriority: false,
    isMobile: false,
  })

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < 768) {
        // Mobile: the SAME elliptical orbit as desktop, scaled to the phone. The
        // horizontal radius is wide enough that only the front card and its two
        // neighbours read at once (the rest sweep off the sides / tuck behind the
        // logo), so nothing ever collides. Flat arch + strong depth match the
        // desktop's "ring seen in perspective" look. Threshold matches the
        // device switcher in eme-experience.tsx (max-width: 767px), since this
        // branch is what EmeMobileExperience actually renders through now.
        setConfig({ radiusX: 222, radiusZ: 150, archLift: 184, baseScale: 0.66, onlyPriority: false, isMobile: true })
      } else if (w < 1024) {
        setConfig({ radiusX: 320, radiusZ: 140, archLift: 118, baseScale: 0.68, onlyPriority: false, isMobile: false })
      } else if (w < 1440) {
        setConfig({ radiusX: 465, radiusZ: 160, archLift: 132, baseScale: 0.74, onlyPriority: false, isMobile: false })
      } else {
        setConfig({ radiusX: 560, radiusZ: 178, archLift: 146, baseScale: 0.82, onlyPriority: false, isMobile: false })
      }
    }
    compute()
    window.addEventListener("resize", compute)
    return () => window.removeEventListener("resize", compute)
  }, [])

  return config
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const map = (v: number, a1: number, a2: number, b1: number, b2: number) =>
  b1 + ((v - a1) * (b2 - b1)) / (a2 - a1)

const logoSilhouetteSegments = [
  { id: "left-e", clipPath: "inset(0 68.5% 0 0)" },
  { id: "middle-m", clipPath: "inset(0 29% 0 32%)" },
  { id: "right-e", clipPath: "inset(0 0 0 72%)" },
] as const

function LogoSilhouetteLayer({ layer, style }: { layer: string; style: CSSProperties }) {
  return logoSilhouetteSegments.map(({ id, clipPath }) => (
    <img
      key={`${layer}-${id}`}
      aria-hidden
      src="/images/eme-logo-3d-premium.webp"
      alt=""
      draggable={false}
      className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
      style={{ ...style, clipPath }}
    />
  ))
}

export function OrbitStage({
  orbitAngle = 0,
  activeId = null,
  onHover,
  selectedId = null,
  onSelect,
  authOpen = false,
}: {
  orbitAngle?: number
  activeId?: string | null
  onHover?: (id: string | null) => void
  selectedId?: string | null
  onSelect?: (id: string, el: HTMLElement) => void
  authOpen?: boolean
}) {
  const cfg = useStageConfig()
  const frozen = selectedId != null || authOpen

  const placed = useMemo(() => {
    return emeModules.map((m) => {
      const rad = ((m.angle + orbitAngle) * Math.PI) / 180
      const sin = Math.sin(rad)
      const cos = Math.cos(rad)
      const front = -cos
      const x = sin * cfg.radiusX
      // Front-facing half (cos < 0) is pushed further down than before (0.9 -> 1.55) so the
      // card whose angle lands nearest the viewer never sits high enough to cover the logo —
      // it now settles in front of the pedestal instead of across the "EME" lettering.
      const y = front * cfg.archLift + Math.abs(sin) * 18 * cfg.baseScale
      const z = front * cfg.radiusZ
      const depth = clamp((front + 1) / 2, 0, 1)

      const scale = cfg.baseScale * map(depth, 0, 1, 0.62, 1.06)
      const opacity = map(depth, 0, 1, 0.34, 1)
      const blur = map(depth, 0, 1, 5.2, 0)
      const rotateY = -sin * 9
      const zIndex = Math.round(front * 100)
      const r = (n: number, d = 2) => Number(n.toFixed(d))

      return {
        module: m,
        x: r(x),
        y: r(y),
        z: r(z),
        scale: r(scale, 4),
        opacity: r(opacity, 4),
        blur: r(blur, 3),
        rotateY: r(rotateY, 3),
        zIndex,
      }
    })
  }, [cfg, orbitAngle])

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{ perspective: "1600px", perspectiveOrigin: "50% 42%" }}
    >
      <div className="relative" style={{ transformStyle: "preserve-3d" }}>
        {/* Ambient stage light pooling at the pedestal's base — a soft green glow consistent
            with the brand accent, simulating stage lighting under the logo/pedestal group. Kept
            in the flat 2D plane (no rotateX) — a radial-gradient under this file's extreme 83deg
            pedestal tilt foreshortens unevenly and rendered as a stray bright band across the
            scene, so this glow is drawn as a plain top-down ellipse instead. */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 z-[5] h-[210px] w-[980px] max-w-[88vw] -translate-x-1/2 rounded-[100%]"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 50%, rgba(115,223,48,0.22) 0%, rgba(115,223,48,0.1) 38%, rgba(115,223,48,0) 72%)",
            transform: "translateY(16%)",
          }}
        />

        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[260px] w-[1180px] max-w-[94vw] -translate-x-1/2 rounded-[100%] border border-eme/12"
          style={{ transform: "translate(-50%,6%) rotateX(83deg)", zIndex: 10 }}
        />

        {/* Marketplace is fixed behind the sculpture and never joins the rotating ring. */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            zIndex: 36,
            transformStyle: "preserve-3d",
            pointerEvents: frozen ? "none" : undefined,
          }}
        >
          <div className="-translate-y-[50px] sm:-translate-y-[82px]">
            <div className="scale-[0.72] sm:scale-[0.78] lg:scale-[0.82]">
              <button
                type="button"
                aria-label="Abrir modulo Marketplace"
                className="eme-card group block cursor-none rounded-[30px] text-left"
                style={{ transformStyle: "preserve-3d" }}
                onMouseEnter={() => !frozen && onHover?.(marketplaceModule.id)}
                onMouseLeave={() => onHover?.(null)}
                onClick={(event) => onSelect?.(marketplaceModule.id, event.currentTarget)}
              >
                <ModuleCard module={marketplaceModule} badge="Novo" />
              </button>
            </div>
          </div>
        </div>

        {/* Isolated "EME" logo, sitting on the pedestal at the same position/scale as the
            original EmeLogoSculpture. Placed at its own zIndex (60) between the pedestal ring
            (10) and the card stack (roughly -100..100 via front-facing angle) so cards in the
            back half of the orbit render behind it and cards in the front half render in front. */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            zIndex: 60,
            pointerEvents: "none",
            transform: "translate(-50%,-50%) translateY(54px)",
            transformStyle: "preserve-3d",
          }}
        >
          <div className="relative aspect-[5/2] w-[195px] sm:w-[368px] lg:w-[445px]">
                {/* The three grounding layers reuse the logo alpha itself, so each letter casts
                    its own footprint instead of creating a uniform dark strip beneath the word. */}
                <LogoSilhouetteLayer
                  layer="cast-shadow"
                  style={{
                    zIndex: 0,
                    opacity: 0.085,
                    filter: "brightness(0) blur(5px)",
                    mixBlendMode: "multiply",
                    transform: "translateY(7%) scaleY(-0.16)",
                    transformOrigin: "50% 100%",
                    maskImage: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 48%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 48%, transparent 100%)",
                  }}
                />
                <LogoSilhouetteLayer
                  layer="contact-shadow"
                  style={{
                    zIndex: 1,
                    opacity: 0.16,
                    filter: "brightness(0) blur(1.2px)",
                    mixBlendMode: "multiply",
                    transform: "translateY(0.4%) scaleY(0.016)",
                    transformOrigin: "50% 100%",
                  }}
                />
                <LogoSilhouetteLayer
                  layer="ambient-occlusion"
                  style={{
                    zIndex: 1,
                    opacity: 0.14,
                    filter: "brightness(0) blur(0.5px)",
                    mixBlendMode: "multiply",
                    transform: "translateY(0.15%) scaleY(0.008)",
                    transformOrigin: "50% 100%",
                  }}
                />

                {/* A short, diffuse vertical reflection stays attached to the same per-letter
                    silhouette and fades into the glossy pedestal instead of mirroring as a band. */}
                <LogoSilhouetteLayer
                  layer="reflection"
                  style={{
                    zIndex: 1,
                    opacity: 0.13,
                    filter: "blur(2.4px) saturate(1.05) brightness(1.08)",
                    transform: "translateY(2%) scaleY(-0.28)",
                    transformOrigin: "50% 100%",
                    maskImage:
                      "linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.24) 32%, transparent 82%)",
                    WebkitMaskImage:
                      "linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.24) 32%, transparent 82%)",
                  }}
                />

                <img
                  src="/images/eme-logo-3d-premium.webp"
                  alt="EME"
                  draggable={false}
                  className="pointer-events-none relative z-[2] h-full w-full max-w-none select-none"
                />
          </div>
        </div>

        {placed.map(({ module, x, y, z, scale, opacity, blur, rotateY, zIndex }) => {
          const isSelected = selectedId === module.id
          const dimmedByHover = activeId != null && activeId !== module.id
          let effectiveOpacity = opacity
          let effectiveBlur = blur
          let authScale = 1

          if (authOpen) {
            effectiveOpacity = opacity * 0.3
            effectiveBlur = Math.max(blur, 2.5)
            authScale = 0.95
          } else if (selectedId != null) {
            effectiveOpacity = isSelected ? 0 : opacity * 0.3
            authScale = isSelected ? 0.92 : 0.97
          } else if (dimmedByHover) {
            effectiveOpacity = opacity * 0.87
            authScale = 0.985
          }

          return (
            <div
              key={module.id}
              className={cfg.onlyPriority && !module.priorityMobile ? "hidden" : "absolute left-1/2 top-1/2"}
              style={{
                zIndex,
                opacity: effectiveOpacity,
                filter: effectiveBlur ? `blur(${effectiveBlur}px)` : undefined,
                transform: `translate(-50%,-50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotateY}deg) scale(${scale})`,
                transformStyle: "preserve-3d",
                transition: "opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), filter 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                pointerEvents: frozen ? "none" : undefined,
              }}
            >
              <div style={{ transformStyle: "preserve-3d" }}>
                <div
                  style={{
                    transform: `scale(${authScale})`,
                    transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div>
                    <button
                      type="button"
                      aria-label={`Abrir modulo ${module.name}`}
                      className="eme-card group block cursor-none rounded-[30px] text-left"
                      style={{ transformStyle: "preserve-3d" }}
                      onMouseEnter={() => !frozen && onHover?.(module.id)}
                      onMouseLeave={() => onHover?.(null)}
                      onClick={(e) => onSelect?.(module.id, e.currentTarget)}
                    >
                      <ModuleCard module={module} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
