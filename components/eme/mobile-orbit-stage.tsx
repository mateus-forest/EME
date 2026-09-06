"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { type MotionValue, useMotionValueEvent } from "motion/react"

import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"
import { orbitBrightness, orbitOpacity } from "@/lib/eme-orbit-presentation"
import heroMaterial from "./hero-material.module.css"

const MOBILE_ORBIT = {
  radiusX: 195,
  verticalLift: 126,
  sideLift: 18,
  offsetY: 22,
  radiusZ: 92,
  backScale: 0.76,
  frontScale: 1,
} as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress
const smoothstep = (value: number) => value * value * (3 - 2 * value)
const round = (value: number, digits = 2) => Number(value.toFixed(digits))

type MobileOrbitStageProps = {
  orbitAngle: MotionValue<number>
  selectedId?: string | null
  onSelect?: (id: string, element: HTMLElement) => void
  onFocusModule?: (baseAngle: number) => void
  onActiveIndexChange?: (index: number) => void
  authOpen?: boolean
}

/**
 * A purpose-built phone composition. It deliberately does not reuse the
 * desktop ellipse: the shallower vertical curve, smaller physical cards and
 * tighter depth range keep adjacent cards separated without large sweeps.
 * MotionValue updates are written straight to compositor-friendly styles so
 * the orbit does not trigger a React render on every animation frame.
 */
export function MobileOrbitStage({
  orbitAngle,
  selectedId = null,
  onSelect,
  onFocusModule,
  onActiveIndexChange,
  authOpen = false,
}: MobileOrbitStageProps) {
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const lastActiveIndexRef = useRef(-1)

  const placeCards = useCallback(
    (angle: number) => {
      let activeIndex = 0
      let activeDepth = -Infinity
      // Short landscape / zoom-reflow viewports need room below the orbital plane.
      // Normal phone composition and all gesture/spring parameters are unchanged.
      const shortViewport = clamp((window.innerHeight - 260) / 440, 0.5, 1)
      const heightScale = mix(0.7, 1, (shortViewport - 0.5) * 2)

      emeModules.forEach((module, index) => {
        const element = cardRefs.current[index]
        if (!element) return

        const radians = ((module.angle + angle) * Math.PI) / 180
        const lateral = Math.sin(radians)
        const front = -Math.cos(radians)
        const rawDepth = clamp((front + 1) / 2, 0, 1)
        const depth = smoothstep(rawDepth)
        const x = lateral * Math.min(MOBILE_ORBIT.radiusX, (window.innerWidth - 152) / 2)
        const y = (front * MOBILE_ORBIT.verticalLift + (1 - Math.abs(front)) * MOBILE_ORBIT.sideLift + MOBILE_ORBIT.offsetY) * shortViewport
        const z = front * MOBILE_ORBIT.radiusZ
        const scale = mix(MOBILE_ORBIT.backScale, MOBILE_ORBIT.frontScale, depth) * heightScale
        const baseOpacity = orbitOpacity(rawDepth)
        const opacity = authOpen
          ? baseOpacity * 0.22
          : selectedId
            ? selectedId === module.id
              ? 0
              : baseOpacity * 0.24
            : baseOpacity

        element.style.transform = `translate(-50%, -50%) translate3d(${round(x)}px, ${round(y)}px, ${round(z)}px) rotateY(${round(-lateral * 7)}deg) scale(${round(scale, 4)})`
        element.style.opacity = round(opacity, 4).toString()
        element.style.filter = `brightness(${round(orbitBrightness(rawDepth), 4)}) saturate(${round(0.82 + rawDepth * 0.18, 4)})`
        element.style.zIndex = Math.round(front * 1000).toString()
        element.dataset.depth = String(round(rawDepth, 4))
        const button = element.querySelector("button")
        if (button) button.style.pointerEvents = !selectedId && !authOpen && rawDepth >= 0.42 ? "auto" : "none"
        if (front > activeDepth) {
          activeDepth = front
          activeIndex = index
        }
      })

      if (activeIndex !== lastActiveIndexRef.current) {
        lastActiveIndexRef.current = activeIndex
        onActiveIndexChange?.(activeIndex)
      }
    },
    [authOpen, onActiveIndexChange, selectedId],
  )

  useMotionValueEvent(orbitAngle, "change", placeCards)

  useLayoutEffect(() => {
    placeCards(orbitAngle.get())
  }, [orbitAngle, placeCards])

  useEffect(() => {
    const onResize = () => placeCards(orbitAngle.get())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [orbitAngle, placeCards])

  const frozen = selectedId != null || authOpen

  return (
    <div
      data-mobile-orbit-stage
      className="relative flex h-full w-full items-center justify-center"
      style={{ perspective: "1080px", perspectiveOrigin: "50% 45%" }}
    >
      <div className="relative" style={{ transformStyle: "preserve-3d" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[128px] w-[356px] max-w-[94vw] -translate-x-1/2 rounded-[100%] border border-eme/10"
          style={{ transform: "translate(-50%, 22%) rotateX(80deg)", zIndex: 10 }}
        />

        <div
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{
            zIndex: 60,
            transform: "translate(-50%, -50%) translateY(40px)",
            transformStyle: "preserve-3d",
          }}
        >
          <div className={`${heroMaterial.logo} relative aspect-[5/2] w-[254px]`}>
            <img
              src="/images/eme-logo-3d-premium.webp"
              alt="EME"
              draggable={false}
              className="relative h-full w-full max-w-none select-none"
            />
          </div>
        </div>

        {emeModules.map((module, index) => (
          <div
            key={module.id}
            ref={(element) => {
              cardRefs.current[index] = element
            }}
            data-mobile-orbit-card={module.id}
            className="absolute left-1/2 top-1/2 [contain:layout_style]"
            style={{
              opacity: 0,
              pointerEvents: "none",
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transition: frozen ? "opacity 240ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
              willChange: "transform, opacity",
            }}
          >
            <button
              type="button"
              aria-label={`Abrir modulo ${module.name}`}
              tabIndex={frozen ? -1 : 0}
              style={{ pointerEvents: "none" }}
              onFocus={(event) => {
                if (!frozen && event.currentTarget.matches(":focus-visible")) onFocusModule?.(module.angle)
              }}
              className="block rounded-[22px] text-left"
              onClick={(event) => onSelect?.(module.id, event.currentTarget)}
            >
              <ModuleCard module={module} mobile animated />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
