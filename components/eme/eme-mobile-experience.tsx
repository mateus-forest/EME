"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, useMotionValue, useMotionValueEvent, useSpring } from "motion/react"

import { AuthPanel, type AuthMode } from "@/components/eme/auth-panel"
import { CoastalCityBackground } from "@/components/eme/coastal-city-background"
import { EmeLogoSculpture } from "@/components/eme/eme-logo-sculpture"
import { ExpandedModulePanel } from "@/components/eme/expanded-module-panel"
import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"

const N = emeModules.length
const START_INDEX = 2

function ringDelta(d: number) {
  let x = ((d % N) + N) % N
  if (x > N / 2) x -= N
  return x
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type MobileStageConfig = {
  cardSpacing: number
  stageTop: string
  logoTop: string
  logoScale: number
  deckTop: string
  perspective: number
  maxVisibleDelta: number
  cardLift: number
  rotation: number
  scaleDrop: number
  sideBlur: number
}

function getMobileStageConfig(width: number, height: number): MobileStageConfig {
  const shortViewport = height <= 740

  if (width <= 340) {
    return {
      cardSpacing: 128,
      stageTop: "53%",
      logoTop: shortViewport ? "28%" : "30%",
      logoScale: 0.58,
      deckTop: shortViewport ? "65%" : "66%",
      perspective: 900,
      maxVisibleDelta: 1.5,
      cardLift: 12,
      rotation: 12,
      scaleDrop: 0.12,
      sideBlur: 2.4,
    }
  }

  if (width <= 380) {
    return {
      cardSpacing: 136,
      stageTop: "53.5%",
      logoTop: shortViewport ? "28.5%" : "30.5%",
      logoScale: 0.63,
      deckTop: shortViewport ? "65.5%" : "66.5%",
      perspective: 980,
      maxVisibleDelta: 1.6,
      cardLift: 12,
      rotation: 13,
      scaleDrop: 0.125,
      sideBlur: 2.2,
    }
  }

  if (width <= 400) {
    return {
      cardSpacing: 144,
      stageTop: "54%",
      logoTop: shortViewport ? "29%" : "31%",
      logoScale: 0.67,
      deckTop: shortViewport ? "65.5%" : "66%",
      perspective: 1040,
      maxVisibleDelta: 1.65,
      cardLift: 13,
      rotation: 13,
      scaleDrop: 0.13,
      sideBlur: 2.2,
    }
  }

  return {
    cardSpacing: 154,
    stageTop: "54%",
    logoTop: shortViewport ? "29.5%" : "31.5%",
    logoScale: 0.72,
    deckTop: shortViewport ? "65.5%" : "66%",
    perspective: 1100,
    maxVisibleDelta: 1.75,
    cardLift: 14,
    rotation: 14,
    scaleDrop: 0.14,
    sideBlur: 2,
  }
}

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
  const [viewport, setViewport] = useState({ width: 390, height: 844 })
  const stage = useMemo(
    () => getMobileStageConfig(viewport.width, viewport.height),
    [viewport.height, viewport.width],
  )

  const position = useMotionValue(START_INDEX)
  const spring = useSpring(position, { stiffness: 210, damping: 28, mass: 0.9 })
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
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

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
      position.set(base + dx / stage.cardSpacing)

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
      const projected = position.get() + (velocity / stage.cardSpacing) * 120
      const target = clamp(Math.round(projected), base - 2, base + 2)
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
  }, [position, stage.cardSpacing])

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

      <MobileHeader
        authOpen={authMode != null}
        onEntrar={() => onAuthModeChange("login")}
        onComecar={() => onAuthModeChange("signup")}
      />

      <div
        ref={surfaceRef}
        className="absolute inset-0 flex items-center justify-center"
        style={{ touchAction: "none" }}
      >
        <div
          className="absolute inset-x-0"
          style={{
            top: stage.stageTop,
          }}
        >
          <div
            className="pointer-events-none absolute left-1/2"
            style={{
              top: stage.logoTop,
              transform: `translate3d(-50%, -50%, 0) scale(${stage.logoScale})`,
              transformOrigin: "center center",
            }}
          >
            <EmeLogoSculpture />
          </div>

          <div
            className="absolute left-1/2 top-1/2 h-[246px] w-0"
            style={{
              top: stage.deckTop,
              perspective: stage.perspective,
            }}
          >
            {emeModules.map((module, i) => {
              const delta = ringDelta(i - p)
              const ad = Math.abs(delta)
              const visible = ad <= stage.maxVisibleDelta
              const isCenter = Math.round(((p % N) + N) % N) % N === i && ad < 0.5
              const side = delta === 0 ? 0 : delta > 0 ? 1 : -1

              const x = delta * stage.cardSpacing
              const scale = 1 - clamp(ad, 0, 1.2) * stage.scaleDrop
              const rotateY = clamp(-delta * stage.rotation, -18, 18)
              const lift = Math.min(ad * stage.cardLift, stage.cardLift * 1.8)
              const opacity = visible ? clamp(1 - ad * 0.44, 0, 1) : 0
              const blur = ad > 0.72 ? Math.min((ad - 0.72) * stage.sideBlur, stage.sideBlur) : 0
              const zIndex = Math.round(220 - ad * 28)

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
                    transition: "opacity 0.28s ease, filter 0.28s ease, transform 0.28s ease",
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
                    className="block rounded-[28px] text-left"
                    style={{
                      transform: `translate3d(0, ${side === 0 ? 0 : 1.5}px, 0)`,
                    }}
                  >
                    <ModuleCard module={module} compact />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div
          className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2"
          style={{ marginBottom: "calc(env(safe-area-inset-bottom) + 22px)" }}
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
  onComecar,
}: {
  authOpen: boolean
  onEntrar: () => void
  onComecar: () => void
}) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-[75]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <p className="max-w-[52%] text-balance text-[11px] font-normal italic leading-snug tracking-[0.02em] text-graphite">
          Sistema Operacional do Corretor de Imoveis
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEntrar}
            tabIndex={authOpen ? -1 : 0}
            className="rounded-full border border-foreground/10 bg-white/60 px-3.5 py-1.5 text-[12px] font-medium tracking-tight text-foreground/80 backdrop-blur-sm transition-opacity duration-500"
            style={{ opacity: authOpen ? 0 : 1, pointerEvents: authOpen ? "none" : undefined }}
            aria-hidden={authOpen}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onComecar}
            tabIndex={authOpen ? -1 : 0}
            className="rounded-full bg-[#111111] px-3.5 py-1.5 text-[12px] font-medium tracking-tight text-white transition-opacity duration-500"
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
