"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { type MotionValue, useMotionValueEvent } from "motion/react"

import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"
import { orbitBrightness, orbitOpacity } from "@/lib/eme-orbit-presentation"
import heroMaterial from "./hero-material.module.css"

type StageConfig = {
  radiusX: number
  radiusZ: number
  archLift: number
  baseScale: number
  onlyPriority: boolean
}

function useStageConfig(): StageConfig {
  const [config, setConfig] = useState<StageConfig>({
    radiusX: 660,
    radiusZ: 150,
    archLift: 250,
    baseScale: 1,
    onlyPriority: false,
  })

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < 1024) {
        setConfig({ radiusX: 275, radiusZ: 140, archLift: 108, baseScale: 0.68, onlyPriority: false })
      } else if (w < 1440) {
        setConfig({ radiusX: 395, radiusZ: 160, archLift: 120, baseScale: 0.74, onlyPriority: false })
      } else {
        setConfig({ radiusX: 460, radiusZ: 178, archLift: 130, baseScale: 0.82, onlyPriority: false })
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

type OrbitStageProps = {
  orbitAngle: MotionValue<number>
  activeId?: string | null
  onHover?: (id: string | null) => void
  selectedId?: string | null
  onSelect?: (id: string, el: HTMLElement) => void
  onFocusModule?: (baseAngle: number) => void
  authOpen?: boolean
}

export function OrbitStage({
  orbitAngle,
  activeId = null,
  onHover,
  selectedId = null,
  onSelect,
  onFocusModule,
  authOpen = false,
}: OrbitStageProps) {
  const cfg = useStageConfig()
  const frozen = selectedId != null || authOpen
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])

  const applyCardLayout = useCallback(
    (angle: number) => {
      for (let index = 0; index < emeModules.length; index += 1) {
        const module = emeModules[index]
        const element = cardRefs.current[index]
        if (!element) continue

        const rad = ((module.angle + angle) * Math.PI) / 180
        const sin = Math.sin(rad)
        const cos = Math.cos(rad)
        const front = -cos
        const x = sin * cfg.radiusX
        const y = front * cfg.archLift + Math.abs(sin) * 18 * cfg.baseScale
        const z = front * cfg.radiusZ
        const depth = clamp((front + 1) / 2, 0, 1)

        const scale = cfg.baseScale * map(depth, 0, 1, 0.62, 1.06)
        const opacity = orbitOpacity(depth)
        const brightness = orbitBrightness(depth)
        const rotateY = -sin * 9
        const zIndex = Math.round(front * 1000)

        const isSelected = selectedId === module.id
        const dimmedByHover = activeId != null && activeId !== module.id

        let effectiveOpacity = opacity
        let authScale = 1

        if (authOpen) {
          effectiveOpacity = opacity * 0.3
          authScale = 0.95
        } else if (selectedId != null) {
          effectiveOpacity = isSelected ? 0 : opacity * 0.3
          authScale = isSelected ? 0.92 : 0.97
        } else if (dimmedByHover) {
          effectiveOpacity = opacity
          authScale = 0.985
        }

        const tx = Number(x.toFixed(3))
        const ty = Number(y.toFixed(3))
        const tz = Number(z.toFixed(3))
        const tRotateY = Number(rotateY.toFixed(3))
        const tScale = Number((scale * authScale).toFixed(4))

        element.style.transform = `translate(-50%, -50%) translate3d(${tx}px, ${ty}px, ${tz}px) rotateY(${tRotateY}deg) scale(${tScale})`
        element.style.opacity = String(Number(effectiveOpacity.toFixed(4)))
        element.style.filter = `brightness(${brightness.toFixed(4)}) saturate(${(0.82 + depth * 0.18).toFixed(4)})`
        element.style.zIndex = String(zIndex)
        // Structural 3D planes must never win hit-testing over their button.
        element.style.pointerEvents = "none"
        const button = element.querySelector("button")
        if (button) button.style.pointerEvents = !frozen && depth >= 0.42 ? "auto" : "none"
        element.dataset.depth = String(Number(depth.toFixed(4)))
        element.style.transition = frozen
          ? "opacity 180ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "none"
        element.style.willChange = frozen ? "transform, opacity, filter" : "transform, filter"
        element.style.backfaceVisibility = "hidden"
        element.style.webkitBackfaceVisibility = "hidden"
        element.style.transformStyle = "preserve-3d"
      }
    },
    [activeId, authOpen, cfg, frozen, selectedId],
  )

  useMotionValueEvent(orbitAngle, "change", applyCardLayout)

  useLayoutEffect(() => {
    applyCardLayout(orbitAngle.get())
  }, [applyCardLayout, cfg, orbitAngle])

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{ perspective: "1600px", perspectiveOrigin: "50% 42%" }}
    >
      <div className="relative" style={{ transformStyle: "preserve-3d" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[1180px] max-w-[94vw] -translate-x-1/2 rounded-[100%] border border-eme/12"
          style={{ transform: "translate(-50%,6%) rotateX(83deg)", zIndex: 10 }}
        />

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
          <div className={`${heroMaterial.logo} relative aspect-[5/2] w-[195px] sm:w-[368px] lg:w-[445px]`}>
            <img
              src="/images/eme-logo-3d-premium.webp"
              alt="EME"
              draggable={false}
              className="pointer-events-none relative z-[2] h-full w-full max-w-none select-none"
            />
          </div>
        </div>

        {emeModules.map((module, index) => {
          return (
            <div
              key={module.id}
              data-orbit-card={module.id}
              ref={(element) => {
                cardRefs.current[index] = element
              }}
              className={cfg.onlyPriority && !module.priorityMobile ? "hidden" : "absolute left-1/2 top-1/2"}
              style={{
                transition: "none",
                opacity: 0,
                transform: "translate(-50%, -50%)",
                transformStyle: "preserve-3d",
                pointerEvents: "none",
              }}
            >
              <div style={{ transformStyle: "preserve-3d" }}>
                <div
                  className="will-change-transform"
                  style={{
                    transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
                    transformStyle: "preserve-3d",
                    transform: "scale(1)",
                  }}
                >
                  <div>
                    <button
                      type="button"
                      aria-label={`Abrir modulo ${module.name}`}
                      tabIndex={frozen ? -1 : 0}
                      onFocus={(event) => {
                        if (!frozen && event.currentTarget.matches(":focus-visible")) onFocusModule?.(module.angle)
                      }}
                      className="eme-card group block cursor-none rounded-[30px] text-left motion-reduce:cursor-pointer"
                      style={{ transformStyle: "preserve-3d", pointerEvents: frozen ? "none" : "auto" }}
                      onMouseEnter={() => !frozen && onHover?.(module.id)}
                      onMouseLeave={() => onHover?.(null)}
                      onClick={(e) => onSelect?.(module.id, e.currentTarget)}
                    >
                      <ModuleCard module={module} animated />
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
