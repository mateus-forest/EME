"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, useMotionValue, useMotionValueEvent, useSpring } from "motion/react"

import { AuthPanel, type AuthMode } from "@/components/eme/auth-panel"
import { CoastalCityBackground } from "@/components/eme/coastal-city-background"
import { ExpandedModulePanel } from "@/components/eme/expanded-module-panel"
import { OrbitStage } from "@/components/eme/orbit-stage"
import { emeModules } from "@/lib/eme-modules"

/**
 * Mobile / PWA experience — a faithful port of the desktop scene, not a
 * separate concept: it renders the very same OrbitStage (and, through it,
 * the same EmeLogoSculpture and ModuleCard), just driven by a horizontal
 * touch-drag (with inertia) instead of the mouse wheel, using the same
 * spring so the motion feels identical. This used to be a second,
 * hand-rolled orbit-placement implementation that inevitably drifted from
 * desktop's; sharing OrbitStage removes that drift at the source.
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
  const orbitTarget = useMotionValue(0)
  const orbitAngle = useSpring(orbitTarget, { stiffness: 55, damping: 18, mass: 1.1 })
  const [angle, setAngle] = useState(0)
  const [mounted, setMounted] = useState(false)
  useMotionValueEvent(orbitAngle, "change", (value) => setAngle(value))

  const [selected, setSelected] = useState<{ id: string; el: HTMLElement } | null>(null)
  const selectedModule = selected ? emeModules.find((module) => module.id === selected.id) : undefined
  const authOpen = authMode != null
  selectedRef.current = selected?.id ?? null
  authOpenRef.current = authOpen

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSelect = (id: string, el: HTMLElement) => {
    if (movedRef.current > 8) return // that was a swipe, not a tap
    setSelected({ id, el })
  }

  useEffect(() => {
    const stageEl = stageRef.current
    if (!stageEl) return

    const sensitivity = 0.3
    const inertiaProjection = 160

    let dragging = false
    let startX = 0
    let baseAngle = 0
    let lastX = 0
    let lastTime = 0
    let velocityX = 0

    const handleStart = (event: TouchEvent) => {
      if (selectedRef.current || authOpenRef.current) return
      dragging = true
      startX = lastX = event.touches[0].clientX
      lastTime = performance.now()
      baseAngle = orbitTarget.get()
      velocityX = 0
      movedRef.current = 0
    }

    const handleMove = (event: TouchEvent) => {
      if (!dragging) return
      event.preventDefault()

      const pointerX = event.touches[0].clientX
      const dragged = startX - pointerX
      movedRef.current = Math.max(movedRef.current, Math.abs(dragged))
      orbitTarget.set(baseAngle + dragged * sensitivity)

      const now = performance.now()
      const deltaTime = now - lastTime
      if (deltaTime > 0) {
        velocityX = (pointerX - lastX) / deltaTime
      }

      lastX = pointerX
      lastTime = now
    }

    const handleEnd = () => {
      if (!dragging) return
      dragging = false
      orbitTarget.set(orbitTarget.get() + -velocityX * sensitivity * inertiaProjection)
    }

    stageEl.addEventListener("touchstart", handleStart, { passive: true })
    stageEl.addEventListener("touchmove", handleMove, { passive: false })
    stageEl.addEventListener("touchend", handleEnd)
    stageEl.addEventListener("touchcancel", handleEnd)

    return () => {
      stageEl.removeEventListener("touchstart", handleStart)
      stageEl.removeEventListener("touchmove", handleMove)
      stageEl.removeEventListener("touchend", handleEnd)
      stageEl.removeEventListener("touchcancel", handleEnd)
    }
  }, [orbitTarget])

  // Which module currently reads as "front-facing", for the progress dots below —
  // OrbitStage computes this internally for its own placement, but doesn't expose
  // it, so it's re-derived here from the same angle this component already tracks.
  const activeIndex = useMemo(() => {
    let bestIndex = 0
    let bestFront = -Infinity
    emeModules.forEach((module, index) => {
      const rad = ((module.angle + angle) * Math.PI) / 180
      const front = -Math.cos(rad)
      if (front > bestFront) {
        bestFront = front
        bestIndex = index
      }
    })
    return bestIndex
  }, [angle])

  return (
    <main className="fixed inset-0 h-[100dvh] w-full overflow-hidden overscroll-none bg-background">
      <CoastalCityBackground />

      <MobileHeader
        authOpen={authOpen}
        onEntrar={() => onAuthModeChange("login")}
        onComecar={() => onAuthModeChange("signup")}
      />

      <div
        ref={stageRef}
        className="absolute inset-0 flex touch-none items-center justify-center -translate-y-[28px] transition-opacity duration-700 ease-out"
        style={{ opacity: mounted ? 1 : 0 }}
      >
        {mounted && (
          <OrbitStage
            orbitAngle={angle}
            activeId={null}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            authOpen={authOpen}
          />
        )}
      </div>

      {/* Ambient light — same soft-light drift as desktop. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
        <div
          className="eme-ambient-light absolute left-1/2 top-[40%] h-[80vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 62%)",
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
                className="block rounded-full transition-all duration-300"
                style={{
                  width: active ? 22 : 6,
                  height: 6,
                  backgroundColor: active ? "var(--eme)" : "color-mix(in oklab, var(--graphite) 40%, transparent)",
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
          <div className="flex h-[22px] w-9 items-center justify-center rounded-full border border-graphite/30 bg-white/20 backdrop-blur-sm">
            <span className="eme-swipe-hint h-1.5 w-1.5 rounded-full bg-graphite/55" />
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {selected && selectedModule && (
          <ExpandedModulePanel
            key={selected.id}
            module={selectedModule}
            originEl={selected.el}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {authMode && <AuthPanel mode={authMode} onModeChange={onAuthModeChange} onClose={onAuthClose} />}
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
      <div className="pointer-events-auto flex items-start justify-between gap-3 px-4 py-3.5">
        <p className="max-w-[52%] text-balance text-[11px] font-normal italic leading-snug tracking-[0.02em] text-graphite">
          Sistema Operacional do Corretor de Imóveis
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEntrar}
            tabIndex={authOpen ? -1 : 0}
            className="rounded-full border border-eme/25 bg-white/80 px-3.5 py-1.5 text-[12px] font-medium tracking-tight text-eme-dark backdrop-blur-sm transition-[opacity,background-color,color] duration-500 hover:bg-eme/10"
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
