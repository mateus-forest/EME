"use client"

import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import { type MotionValue, useMotionValueEvent } from "motion/react"

import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"
import { orbitBrightness, orbitOpacity } from "@/lib/eme-orbit-presentation"
import heroMaterial from "./hero-material.module.css"
import mobileStyles from "./landing-mobile-refinement.module.css"
import { createMobileOrbitLayout, mobileOrbitPoint, type MobileOrbitLayout } from "@/lib/eme-mobile-orbit-layout"

const MOBILE_ORBIT = {
  radiusX: 164,
  verticalLift: 138,
  backLift: 124,
  tilt: 6,
  sideScale: 0.6,
  backScale: 0.7,
  frontScale: 0.92,
} as const

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress
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
 * desktop ellipse: a wider-sided curve reserves an exclusion area for the logo.
 * Depth is expressed through scale, opacity and stacking, without perspective
 * expanding a card's hitbox into the logo or outside the phone viewport.
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
  const stageRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<SVGEllipseElement>(null)
  const geometryRef = useRef({ radiusX: 148, heightScale: 1 })
  const compactLayoutRef = useRef<MobileOrbitLayout | null>(null)

  const placeCards = useCallback(
    (angle: number) => {
      let activeIndex = 0
      let activeDepth = -Infinity
      const { radiusX, heightScale } = geometryRef.current
      if (trailRef.current) trailRef.current.style.strokeDashoffset = String(-angle)

      emeModules.forEach((module, index) => {
        const element = cardRefs.current[index]
        if (!element) return

        const radians = ((module.angle + angle) * Math.PI) / 180
        const lateral = Math.sin(radians)
        const front = -Math.cos(radians)
        const compactPoint = compactLayoutRef.current ? mobileOrbitPoint(module.angle + angle, compactLayoutRef.current) : null
        const rawDepth = compactPoint?.depth ?? clamp((front + 1) / 2, 0, 1)
        const x = compactPoint?.x ?? lateral * radiusX
        // A shallower rear arc brings the distant cards toward the logo rather
        // than drawing a full circle. Both arcs meet continuously at the sides.
        const arcY = front < 0
          ? Math.tanh(front * 2.5) / Math.tanh(2.5) * MOBILE_ORBIT.backLift
          : front * (2 - front) * MOBILE_ORBIT.verticalLift
        const y = compactPoint?.y ?? (arcY + lateral * MOBILE_ORBIT.tilt) * heightScale
        const scale = compactPoint?.scale ?? mix(MOBILE_ORBIT.sideScale, front >= 0 ? MOBILE_ORBIT.frontScale : MOBILE_ORBIT.backScale, front ** 4) * heightScale
        const baseOpacity = orbitOpacity(rawDepth)
        const opacity = authOpen
          ? baseOpacity * 0.22
          : selectedId
            ? selectedId === module.id
              ? 0
              : baseOpacity * 0.24
            : baseOpacity

        element.style.transform = compactPoint
          ? `translate3d(calc(-50% + ${round(x)}px), calc(-50% + ${round(y)}px), 0) scale(${round(scale, 4)})`
          : `translate(-50%, -50%) translate3d(${round(x)}px, ${round(y)}px, 0) rotateY(${round(-lateral * 10)}deg) scale(${round(scale, 4)})`
        element.style.opacity = round(opacity, 4).toString()
        element.style.filter = compactPoint ? "none" : `brightness(${round(orbitBrightness(rawDepth), 4)}) saturate(${round(0.82 + rawDepth * 0.18, 4)})`
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

  const measureStage = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    if (window.matchMedia("(max-width: 640px)").matches) {
      const card = cardRefs.current[0]?.querySelector("button")
      if (!card) return
      const layout = createMobileOrbitLayout(stage.clientWidth, stage.clientHeight, card.offsetWidth, card.offsetHeight)
      compactLayoutRef.current = layout
      stage.style.setProperty("--mobile-logo-width", `${layout.logoWidth * layout.fit}px`)
      stage.style.setProperty("--mobile-scene-lift", "0px")
      stage.style.setProperty("--mobile-orbit-width", `${layout.radiusX * 2 * layout.fit}px`)
      placeCards(orbitAngle.get())
      return
    }
    compactLayoutRef.current = null
    const heightScale = clamp(stage.clientHeight / 370, 0.5, 1)
    const radiusX = Math.min(MOBILE_ORBIT.radiusX, stage.clientWidth / 2 - 46) * heightScale
    geometryRef.current = { radiusX, heightScale }
    stage.style.setProperty("--mobile-logo-width", `${Math.min(200, stage.clientWidth * 0.48) * heightScale}px`)
    stage.style.setProperty("--mobile-scene-lift", `${-8 * heightScale}px`)
    stage.style.setProperty("--mobile-orbit-width", `${radiusX * 2 + 24 * heightScale}px`)
    placeCards(orbitAngle.get())
  }, [orbitAngle, placeCards])

  useLayoutEffect(() => {
    measureStage()
  }, [measureStage])

  useEffect(() => {
    const observer = new ResizeObserver(measureStage)
    if (stageRef.current) observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [measureStage])

  const frozen = selectedId != null || authOpen

  return (
    <div
      ref={stageRef}
      data-mobile-orbit-stage
      className="relative flex h-full w-full items-center justify-center"
    >
      <div className="relative" style={{ transformStyle: "preserve-3d", transform: "translateY(var(--mobile-scene-lift, -8px))" }}>
        <svg
          aria-hidden
          focusable="false"
          viewBox="0 0 400 160"
          className={mobileStyles.orbitTrail}
        >
          <ellipse cx="200" cy="80" rx="190" ry="64" fill="none" stroke="#459d70" strokeWidth="1" opacity=".24" />
          <ellipse ref={trailRef} className={mobileStyles.trailHighlight} cx="200" cy="80" rx="190" ry="64" pathLength="360" fill="none" stroke="#64c68e" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="46 314" opacity=".6" />
        </svg>

        <div
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{
            zIndex: 60,
            transform: "translate(-50%, -50%)",
            transformStyle: "preserve-3d",
          }}
        >
          <div data-mobile-orbit-logo className={`${heroMaterial.logo} ${mobileStyles.platformLogo} relative aspect-[5/2]`} style={{ width: "var(--mobile-logo-width, 180px)" }}>
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
              willChange: frozen ? "auto" : "transform",
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
