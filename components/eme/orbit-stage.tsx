"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"

import { EmeLogoSculpture } from "@/components/eme/eme-logo-sculpture"
import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"

// The background plate is a 1659x948 render whose podium, floor rings and
// foliage are already baked in. Every stage measurement below is expressed in
// that render's own pixels and then multiplied by the plate's `object-cover`
// scale, so the logo and the ring of cards land on the podium exactly where
// they sit in the reference composition, at any viewport size.
const PLATE_W = 1659
const PLATE_H = 948
/** Logo centre inside the plate. */
const ANCHOR_X = 850
const ANCHOR_Y = 488
/** Logo width in plate pixels — it has to sit on the podium, so it scales with the plate. */
const LOGO_W = 614
/**
 * The ring, in contrast, is framed against the viewport in the reference, so its
 * radius and arch are kept as fractions of the window: the outer cards keep the
 * same margins the render has instead of sliding off a cropped edge.
 */
const ORBIT_X_FRACTION = 576 / PLATE_W
const ORBIT_Z_FRACTION = 150 / PLATE_W
const ARCH_FRACTION = 255 / PLATE_H
/** The ring rides slightly above the logo anchor, as it does in the render. */
const RING_LIFT_FRACTION = -0.038
/** Card width in the reference vs. the ModuleCard's intrinsic width. */
const CARD_H_FRACTION = 132 / PLATE_H
const CARD_INTRINSIC_W = 184

type StageConfig = {
  radiusX: number
  radiusZ: number
  archLift: number
  baseScale: number
  ringLift: number
  logoWidth?: number
  offsetX: number
  offsetY: number
  onlyPriority: boolean
  isMobile: boolean
}

function useStageConfig(): StageConfig {
  const [config, setConfig] = useState<StageConfig>({
    radiusX: 660,
    radiusZ: 150,
    archLift: 250,
    baseScale: 1,
    ringLift: 0,
    offsetX: 0,
    offsetY: 0,
    onlyPriority: false,
    isMobile: false,
  })

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      const h = window.innerHeight

      if (w >= 768) {
        // `object-cover` scale of the background plate.
        const s = Math.max(w / PLATE_W, PLATE_H === 0 ? 0 : h / PLATE_H)
        setConfig({
          radiusX: ORBIT_X_FRACTION * w,
          radiusZ: ORBIT_Z_FRACTION * w,
          archLift: ARCH_FRACTION * h,
          // Cards keep the reference proportion, with a floor so the copy stays
          // legible inside small desktop windows.
          baseScale: clamp((CARD_H_FRACTION * h) / CARD_INTRINSIC_W, 0.6, 1.05),
          ringLift: RING_LIFT_FRACTION * h,
          logoWidth: LOGO_W * s,
          offsetX: (ANCHOR_X / PLATE_W - 0.5) * w,
          offsetY: ANCHOR_Y * s - (PLATE_H * s - h) / 2 - h / 2,
          onlyPriority: false,
          isMobile: false,
        })
        return
      }

      {
        // Mobile: the SAME elliptical orbit as desktop, scaled to the phone. The
        // horizontal radius is wide enough that only the front card and its two
        // neighbours read at once (the rest sweep off the sides / tuck behind the
        // logo), so nothing ever collides. Flat arch + strong depth match the
        // desktop's "ring seen in perspective" look. Threshold matches the
        // device switcher in eme-experience.tsx (max-width: 767px), since this
        // branch is what EmeMobileExperience actually renders through now.
        setConfig({
          radiusX: 222,
          radiusZ: 150,
          archLift: 184,
          baseScale: 0.66,
          ringLift: 0,
          offsetX: 0,
          offsetY: 0,
          onlyPriority: false,
          isMobile: true,
        })
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
      const y =
        -cos * cfg.archLift * (cos > 0 ? 0.46 : 0.9) +
        Math.abs(sin) * 34 * cfg.baseScale +
        cfg.ringLift
      const z = front >= 0 ? front * cfg.radiusZ * 1.1 : front * cfg.radiusZ * 1.7

      const scale = cfg.baseScale * map(front, -1, 1, 0.72, 1.06)
      // In the reference composition only the five front-facing cards read; the
      // ones sweeping behind the logo fade out entirely instead of ghosting
      // over the sculpture.
      const opacity = clamp(map(front, -0.32, -0.02, 0, 1), 0, 1)
      const blur = front < 0 ? clamp(-front * 3, 0, 3) : 0
      const rotateY = -sin * 14
      const zIndex = Math.round(front * 100)
      const parallax = clamp(map(front, -1, 1, 3, 10), 3, 10)
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
        parallax: r(parallax, 2),
      }
    })
  }, [cfg, orbitAngle])

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{ perspective: "1600px", perspectiveOrigin: "50% 42%" }}
    >
      <div
        className="relative"
        style={{
          transformStyle: "preserve-3d",
          transform: `translate3d(${cfg.offsetX.toFixed(2)}px, ${cfg.offsetY.toFixed(2)}px, 0)`,
        }}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            zIndex: 60,
            transform: "translate(-50%,-50%) rotateX(3deg)",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              transform: "translate3d(calc(var(--px,0) * 6px), calc(var(--py,0) * 6px), 0)",
              transition: "transform 0.35s ease-out",
              transformStyle: "preserve-3d",
            }}
          >
            <div
              style={{
                transform: authOpen ? "translateX(-13vw)" : "translateX(0px)",
                transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
                transformStyle: "preserve-3d",
              }}
            >
              <EmeLogoSculpture widthPx={cfg.logoWidth} />
            </div>
          </div>
        </div>

        {placed.map(({ module, x, y, z, scale, opacity, blur, rotateY, zIndex, parallax }, i) => {
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
              <div
                style={{
                  transform: `translate3d(calc(var(--px,0) * ${parallax}px), calc(var(--py,0) * ${parallax}px), 0)`,
                  transition: "transform 0.3s ease-out",
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  style={{
                    transform: `scale(${authScale})`,
                    transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <motion.div
                    animate={
                      frozen
                        ? { y: 0, rotateZ: 0 }
                        : { y: [0, -3, 0], rotateZ: [-0.5, 0.5, -0.5] }
                    }
                    transition={
                      frozen
                        ? { duration: 0.6, ease: "easeOut" }
                        : { duration: 7 + (i % 4), repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }
                    }
                  >
                    <button
                      type="button"
                      aria-label={`Abrir modulo ${module.name}`}
                      className="eme-card group block cursor-none rounded-[30px] text-left transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_44px_74px_-24px_rgba(28,52,40,0.5)]"
                      style={{
                        transform:
                          "translate3d(0, calc(var(--hv,0) * -6px), 0) rotateX(calc(var(--py,0) * var(--hv,0) * -5deg)) rotateY(calc(var(--px,0) * var(--hv,0) * 6deg))",
                        transformStyle: "preserve-3d",
                      }}
                      onMouseEnter={() => !frozen && onHover?.(module.id)}
                      onMouseLeave={() => onHover?.(null)}
                      onClick={(e) => onSelect?.(module.id, e.currentTarget)}
                    >
                      <ModuleCard module={module} />
                    </button>
                  </motion.div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
