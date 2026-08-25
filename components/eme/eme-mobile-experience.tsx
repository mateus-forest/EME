"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react"

import { AuthPanel, type AuthMode } from "@/components/eme/auth-panel"
import { CoastalCityBackground } from "@/components/eme/coastal-city-background"
import { ExpandedModulePanel } from "@/components/eme/expanded-module-panel"
import {
  AcceleratorHero,
  LandingAcceleratorTeaser,
} from "@/components/eme/landing-accelerator"
import { LandingActivity } from "@/components/eme/landing-activity"
import { MobileOrbitStage } from "@/components/eme/mobile-orbit-stage"
import { emeModules, marketplaceModule } from "@/lib/eme-modules"

/**
 * Mobile / PWA experience. The phone composition has its own geometry,
 * physical card sizing, depth and gesture tuning; it intentionally does not
 * scale the approved desktop ring down.
 */
export function EmeMobileExperience({
  authMode,
  onAuthModeChange,
  onAuthClose,
}: {
  authMode: AuthMode | null
  onAuthModeChange: (mode: AuthMode) => void
  onAuthClose: () => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const movedRef = useRef(0)
  const selectedRef = useRef<string | null>(null)
  const authOpenRef = useRef(false)
  const interactingRef = useRef(false)
  const resumeAutoAtRef = useRef(0)
  const acceleratorOpenRef = useRef(false)
  const orbitTarget = useMotionValue(0)
  const orbitAngle = useSpring(orbitTarget, { stiffness: 82, damping: 24, mass: 0.82 })
  const [activeIndex, setActiveIndex] = useState(0)
  const [acceleratorOpen, setAcceleratorOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [selected, setSelected] = useState<{ id: string; el: HTMLElement } | null>(null)
  const selectedModule = selected
    ? selected.id === marketplaceModule.id
      ? marketplaceModule
      : emeModules.find((module) => module.id === selected.id)
    : undefined
  const authOpen = authMode != null
  selectedRef.current = selected?.id ?? null
  authOpenRef.current = authOpen
  acceleratorOpenRef.current = acceleratorOpen
  const sceneBlocking = authOpen || selected != null || acceleratorOpen

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelect = (id: string, element: HTMLElement) => {
    if (movedRef.current > 8) return
    setSelected({ id, el: element })
  }

  const openAuth = (mode: AuthMode) => {
    setSelected(null)
    onAuthModeChange(mode)
  }

  useEffect(() => {
    const stageElement = stageRef.current
    if (!stageElement) return

    const sensitivity = 0.2
    const inertiaProjection = 120
    let dragging = false
    let pointerId: number | null = null
    let startX = 0
    let baseAngle = 0
    let lastX = 0
    let lastTime = 0
    let velocityX = 0

    const handleStart = (event: PointerEvent) => {
      if (selectedRef.current || authOpenRef.current || acceleratorOpenRef.current || !event.isPrimary) return
      dragging = true
      interactingRef.current = true
      pointerId = event.pointerId
      startX = lastX = event.clientX
      lastTime = performance.now()
      baseAngle = orbitTarget.get()
      velocityX = 0
      movedRef.current = 0
    }

    const handleMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return
      event.preventDefault()

      const dragged = startX - event.clientX
      movedRef.current = Math.max(movedRef.current, Math.abs(dragged))
      if (Math.abs(dragged) > 4 && !stageElement.hasPointerCapture(event.pointerId)) {
        stageElement.setPointerCapture(event.pointerId)
      }
      orbitTarget.set(baseAngle + dragged * sensitivity)

      const now = performance.now()
      const elapsed = now - lastTime
      if (elapsed > 0) velocityX = (event.clientX - lastX) / elapsed
      lastX = event.clientX
      lastTime = now
    }

    const handleEnd = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return
      dragging = false

      const projectedDegrees = Math.max(
        -18,
        Math.min(18, -velocityX * sensitivity * inertiaProjection),
      )
      orbitTarget.set(orbitTarget.get() + projectedDegrees)
      interactingRef.current = false
      resumeAutoAtRef.current = performance.now() + 650

      if (stageElement.hasPointerCapture(event.pointerId)) {
        stageElement.releasePointerCapture(event.pointerId)
      }
      pointerId = null
    }

    stageElement.addEventListener("pointerdown", handleStart)
    stageElement.addEventListener("pointermove", handleMove)
    stageElement.addEventListener("pointerup", handleEnd)
    stageElement.addEventListener("pointercancel", handleEnd)

    return () => {
      stageElement.removeEventListener("pointerdown", handleStart)
      stageElement.removeEventListener("pointermove", handleMove)
      stageElement.removeEventListener("pointerup", handleEnd)
      stageElement.removeEventListener("pointercancel", handleEnd)
    }
  }, [orbitTarget])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let animationFrame = 0
    let previous = performance.now()

    const advanceOrbit = (now: number) => {
      const elapsed = Math.min(now - previous, 34)
      previous = now

      if (
        !document.hidden &&
        !selectedRef.current &&
        !authOpenRef.current &&
        !acceleratorOpenRef.current &&
        !interactingRef.current &&
        now >= resumeAutoAtRef.current
      ) {
        orbitTarget.set(orbitTarget.get() + elapsed * 0.0028)
      }
      animationFrame = requestAnimationFrame(advanceOrbit)
    }

    animationFrame = requestAnimationFrame(advanceOrbit)
    return () => cancelAnimationFrame(animationFrame)
  }, [orbitTarget])

  return (
    <main
      className={`fixed inset-0 h-[100dvh] w-full overflow-hidden overscroll-none bg-background${sceneBlocking ? " eme-landing-scene is-paused" : ""}`}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{
          x: acceleratorOpen ? "13vw" : "0vw",
          rotateY: acceleratorOpen ? -3 : 0,
          rotateZ: acceleratorOpen ? -0.4 : 0,
          scale: acceleratorOpen ? 1.14 : 1,
        }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        style={{ perspective: 1200, transformOrigin: "32% 50%", willChange: "transform" }}
      >
        <CoastalCityBackground />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          x: acceleratorOpen ? "-24vw" : "0vw",
          rotateY: acceleratorOpen ? -4 : 0,
          scale: acceleratorOpen ? 0.985 : 1,
          opacity: acceleratorOpen ? 0 : 1,
        }}
        transition={{
          duration: acceleratorOpen ? 0.76 : 0.72,
          delay: acceleratorOpen ? 0 : 0.12,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ pointerEvents: acceleratorOpen ? "none" : "auto", willChange: "transform, opacity" }}
        aria-hidden={acceleratorOpen}
      >
        <MobileHeader
          authOpen={authOpen}
          onEntrar={() => openAuth("login")}
          onComecar={() => openAuth("signup")}
        />
        <LandingActivity
          authOpen={authOpen}
          compact
          className="fixed left-4 top-[calc(env(safe-area-inset-top)+4rem)] z-[60]"
        />

        <div
          ref={stageRef}
          className="absolute inset-0 flex touch-none translate-y-[10px] items-center justify-center transition-opacity duration-700 ease-out"
          style={{ opacity: mounted ? 1 : 0 }}
        >
          {mounted ? (
            <MobileOrbitStage
              orbitAngle={orbitAngle}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              onActiveIndexChange={setActiveIndex}
              authOpen={authOpen}
            />
          ) : null}
        </div>

        {!selected && !authOpen ? (
          <LandingAcceleratorTeaser compact onOpen={() => setAcceleratorOpen(true)} />
        ) : null}

        <div aria-hidden className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
          <div
            className="eme-ambient-light absolute left-1/2 top-[40%] h-[76vh] w-[86vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 64%)",
              mixBlendMode: "soft-light",
            }}
          />
        </div>

        {!selected && !authOpen ? (
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2"
            style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
          >
            {emeModules.map((module, index) => {
              const active = index === activeIndex
              return (
                <span
                  key={module.id}
                  className="block rounded-full transition-[width,background-color] duration-500 ease-out"
                  style={{
                    width: active ? 22 : 6,
                    height: 6,
                    backgroundColor: active
                      ? "var(--eme)"
                      : "color-mix(in oklab, var(--graphite) 40%, transparent)",
                  }}
                />
              )
            })}
          </div>
        ) : null}

        {!selected && !authOpen ? (
          <div
            className="pointer-events-none absolute bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4rem))] left-1/2 z-10 -translate-x-1/2"
            aria-hidden
          >
            <div className="flex h-[22px] w-9 items-center justify-center rounded-full border border-graphite/30 bg-white/45">
              <span className="eme-swipe-hint h-1.5 w-1.5 rounded-full bg-graphite/55" />
            </div>
          </div>
        ) : null}
      </motion.div>

      <AnimatePresence initial={false}>
        {acceleratorOpen ? (
          <motion.div
            key="accelerator-mobile"
            className="absolute inset-0 z-[70]"
            initial={{ x: "8vw", scale: 0.985, opacity: 0 }}
            animate={{ x: "0vw", scale: 1, opacity: 1 }}
            exit={{
              x: "8vw",
              scale: 0.985,
              opacity: 0,
              transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] },
            }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <AcceleratorHero
              compact
              onBack={() => setAcceleratorOpen(false)}
              onEntrar={() => openAuth("login")}
              onComecar={() => openAuth("signup")}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selected && selectedModule ? (
          <ExpandedModulePanel
            key={selected.id}
            module={selectedModule}
            originEl={selected.el}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {authMode ? (
          <AuthPanel mode={authMode} onModeChange={onAuthModeChange} onClose={onAuthClose} />
        ) : null}
      </AnimatePresence>
    </main>
  )
}

function MobileHeader({
  authOpen,
  onEntrar,
  onComecar,
}: {
  authOpen: boolean
  onEntrar: () => void
  onComecar: () => void
}) {
  return (
    <header
      className="pointer-events-none fixed inset-x-0 top-0 z-[75]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="pointer-events-auto flex items-start justify-end gap-3 px-4 py-3.5">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEntrar}
            tabIndex={authOpen ? -1 : 0}
            className="rounded-full border border-eme/25 bg-white/80 px-3.5 py-1.5 text-[12px] font-medium tracking-tight text-eme-dark transition-[opacity,background-color,color] duration-500 hover:bg-eme/10"
            style={{ opacity: authOpen ? 0 : 1, pointerEvents: authOpen ? "none" : undefined }}
            aria-hidden={authOpen}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onComecar}
            tabIndex={authOpen ? -1 : 0}
            className="eme-gradient rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-tight text-primary-foreground shadow-[0_10px_20px_-10px_rgba(28,120,60,0.6)] transition-[opacity,transform,filter] duration-500 hover:-translate-y-0.5"
            style={{ opacity: authOpen ? 0 : 1, pointerEvents: authOpen ? "none" : undefined }}
            aria-hidden={authOpen}
          >
            Criar conta
          </button>
        </div>
      </div>
    </header>
  )
}
