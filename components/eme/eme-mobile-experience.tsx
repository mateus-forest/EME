"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, useMotionValue, useMotionValueEvent, useSpring } from "motion/react"

import { AuthPanel, type AuthMode } from "@/components/eme/auth-panel"
import { CoastalCityBackground } from "@/components/eme/coastal-city-background"
import { EmeLogoSculpture } from "@/components/eme/eme-logo-sculpture"
import { ExpandedModulePanel } from "@/components/eme/expanded-module-panel"
import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"

const N = emeModules.length
const SPACING = 168
const START_INDEX = 2

function ringDelta(d: number) {
  let x = ((d % N) + N) % N
  if (x > N / 2) x -= N
  return x
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function EmeMobileExperience({
  authMode,
  onAuthModeChange,
  onAuthClose,
}: {
  authMode: AuthMode | null
  onAuthModeChange: (mode: AuthMode) => void
  onAuthClose: () => void
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const position = useMotionValue(START_INDEX)
  const spring = useSpring(position, { stiffness: 240, damping: 30, mass: 0.9 })
  const [p, setP] = useState(START_INDEX)
  const [activeIndex, setActiveIndex] = useState(START_INDEX)
  useMotionValueEvent(spring, "change", (v) => {
    setP(v)
    setActiveIndex(((Math.round(v) % N) + N) % N)
  })

  const [selected, setSelected] = useState<{ id: string; el: HTMLElement } | null>(null)
  const selectedModule = selected ? emeModules.find((m) => m.id === selected.id) : undefined
  const frozenRef = useRef(false)
  frozenRef.current = selected != null || authMode != null

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return

    let dragging = false
    let startX = 0
    let base = 0
    let lastX = 0
    let lastT = 0
    let velocity = 0
    let moved = 0

    const onStart = (e: TouchEvent) => {
      if (frozenRef.current) return
      dragging = true
      startX = lastX = e.touches[0].clientX
      lastT = performance.now()
      base = position.get()
      velocity = 0
      moved = 0
    }

    const onMove = (e: TouchEvent) => {
      if (!dragging) return
      e.preventDefault()
      const x = e.touches[0].clientX
      const dx = startX - x
      moved = Math.max(moved, Math.abs(dx))
      position.set(base + dx / SPACING)

      const now = performance.now()
      const dt = now - lastT
      if (dt > 0) velocity = (lastX - x) / dt
      lastX = x
      lastT = now
    }

    const onEnd = () => {
      if (!dragging) return
      dragging = false
      movedRef.current = moved
      const projected = position.get() + (velocity / SPACING) * 150
      const target = clamp(Math.round(projected), base - 3, base + 3)
      position.set(target)
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd)
    el.addEventListener("touchcancel", onEnd)
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
  }, [position])

  const movedRef = useRef(0)

  const goToIndex = (i: number) => {
    const cur = position.get()
    position.set(cur + ringDelta(i - cur))
  }

  const openModule = (id: string, el: HTMLElement) => {
    if (movedRef.current > 8) return
    setSelected({ id, el })
  }

  return (
    <main
      className="fixed inset-0 h-[100dvh] w-full overflow-hidden overscroll-none bg-background"
      style={{ touchAction: "pan-y" }}
    >
      <CoastalCityBackground />

      <MobileHeader authOpen={authMode != null} onEntrar={() => onAuthModeChange("login")} />

      <div
        ref={surfaceRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ touchAction: "none" }}
      >
        <div className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2">
          <EmeLogoSculpture />
        </div>

        <div
          className="absolute left-1/2 top-[63%] h-[260px] w-0"
          style={{ perspective: 1100 }}
        >
          {emeModules.map((module, i) => {
            const delta = ringDelta(i - p)
            const ad = Math.abs(delta)
            const visible = ad <= 2.2
            const isCenter = Math.round(((p % N) + N) % N) % N === i && ad < 0.5

            const x = delta * SPACING
            const scale = 1 - clamp(ad, 0, 1) * 0.2
            const rotateY = clamp(-delta * 16, -26, 26)
            const lift = clamp(ad, 0, 2) * 10
            const opacity = visible ? clamp(1 - ad * 0.5, 0, 1) : 0
            const blur = ad > 0.5 ? Math.min((ad - 0.5) * 3, 3.2) : 0
            const zIndex = Math.round(200 - ad * 20)

            return (
              <div
                key={module.id}
                className="absolute left-0 top-1/2"
                style={{
                  zIndex,
                  opacity,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  transform: `translate(-50%, -50%) translate3d(${x}px, ${lift}px, 0) rotateY(${rotateY}deg) scale(${scale})`,
                  transformStyle: "preserve-3d",
                  transition: "opacity 0.35s ease, filter 0.35s ease",
                  pointerEvents: isCenter ? "auto" : "none",
                  visibility: visible ? "visible" : "hidden",
                }}
              >
                <button
                  type="button"
                  data-role={isCenter ? "center" : undefined}
                  aria-label={`Abrir modulo ${module.name}`}
                  tabIndex={isCenter ? 0 : -1}
                  onClick={(e) => openModule(module.id, e.currentTarget)}
                  className="block rounded-[30px] text-left"
                >
                  <ModuleCard module={module} />
                </button>
              </div>
            )
          })}
        </div>

        <div
          className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2"
          style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 26px)" }}
        >
          {emeModules.map((m, i) => {
            const on = i === activeIndex
            return (
              <button
                key={m.id}
                type="button"
                aria-label={`Ir para ${m.name}`}
                onClick={() => goToIndex(i)}
                className="flex h-6 items-center"
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: on ? 22 : 6,
                    height: 6,
                    backgroundColor: on ? "var(--eme)" : "color-mix(in oklab, var(--graphite) 40%, transparent)",
                  }}
                />
              </button>
            )
          })}
        </div>
      </div>

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
        {authMode && (
          <AuthPanel mode={authMode} onModeChange={onAuthModeChange} onClose={onAuthClose} />
        )}
      </AnimatePresence>
    </main>
  )
}

function MobileHeader({
  authOpen,
  onEntrar,
}: {
  authOpen: boolean
  onEntrar: () => void
}) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-[75]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <p className="max-w-[58%] text-balance text-[11.5px] font-normal italic leading-snug tracking-[0.02em] text-graphite">
          Sistema Operacional do Corretor de Imoveis
        </p>
        <button
          type="button"
          onClick={onEntrar}
          tabIndex={authOpen ? -1 : 0}
          className="flex-shrink-0 rounded-full border border-foreground/10 bg-white/60 px-4 py-1.5 text-[13px] font-medium tracking-tight text-foreground/80 backdrop-blur-sm transition-opacity duration-500"
          style={{ opacity: authOpen ? 0 : 1, pointerEvents: authOpen ? "none" : undefined }}
          aria-hidden={authOpen}
        >
          Entrar
        </button>
      </div>
    </header>
  )
}
