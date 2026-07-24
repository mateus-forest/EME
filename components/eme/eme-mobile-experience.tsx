"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, useMotionValue, useMotionValueEvent, useSpring } from "motion/react"

import { AuthPanel, type AuthMode } from "@/components/eme/auth-panel"
import { CoastalCityBackground } from "@/components/eme/coastal-city-background"
import { EmeLogoSculpture } from "@/components/eme/eme-logo-sculpture"
import { ExpandedModulePanel } from "@/components/eme/expanded-module-panel"
import { ModuleCard } from "@/components/eme/module-card"
import { emeModules } from "@/lib/eme-modules"

type MobileOrbitConfig = {
  radiusX: number
  radiusY: number
  radiusZ: number
  logoScale: number
  stageHeight: string
  perspective: number
  cardScale: number
}

function getMobileOrbitConfig(width: number, height: number): MobileOrbitConfig {
  const shortViewport = height < 760

  if (width <= 320) {
    return {
      radiusX: 120,
      radiusY: shortViewport ? 74 : 82,
      radiusZ: 72,
      logoScale: 0.58,
      stageHeight: "340svh",
      perspective: 980,
      cardScale: 0.88,
    }
  }

  if (width <= 375) {
    return {
      radiusX: 132,
      radiusY: shortViewport ? 80 : 88,
      radiusZ: 78,
      logoScale: 0.64,
      stageHeight: "350svh",
      perspective: 1040,
      cardScale: 0.92,
    }
  }

  if (width <= 390) {
    return {
      radiusX: 138,
      radiusY: shortViewport ? 84 : 92,
      radiusZ: 82,
      logoScale: 0.68,
      stageHeight: "360svh",
      perspective: 1080,
      cardScale: 0.95,
    }
  }

  return {
    radiusX: 148,
    radiusY: shortViewport ? 88 : 96,
    radiusZ: 88,
    logoScale: 0.72,
    stageHeight: "370svh",
    perspective: 1140,
    cardScale: 0.98,
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function EmeMobileExperience({
  authMode,
  onAuthModeChange,
  onAuthClose,
}: {
  authMode: AuthMode | null
  onAuthModeChange: (mode: AuthMode) => void
  onAuthClose: () => void
}) {
  const scrollerRef = useRef<HTMLElement>(null)
  const orbitTarget = useMotionValue(0)
  const orbitAngle = useSpring(orbitTarget, { stiffness: 52, damping: 18, mass: 0.9 })
  const [angle, setAngle] = useState(0)
  const [viewport, setViewport] = useState({ width: 390, height: 844 })
  useMotionValueEvent(orbitAngle, "change", (value) => setAngle(value))

  const [selected, setSelected] = useState<{ id: string; el: HTMLElement } | null>(null)
  const selectedModule = selected ? emeModules.find((module) => module.id === selected.id) : undefined
  const stage = useMemo(() => getMobileOrbitConfig(viewport.width, viewport.height), [viewport.height, viewport.width])
  const authOpen = authMode != null

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
    const scroller = scrollerRef.current
    if (!scroller) return

    const handleScroll = () => {
      const maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight)
      const progress = clamp(scroller.scrollTop / maxScroll, 0, 1)
      orbitTarget.set(progress * 280)
    }

    handleScroll()
    scroller.addEventListener("scroll", handleScroll, { passive: true })
    return () => scroller.removeEventListener("scroll", handleScroll)
  }, [orbitTarget, stage.stageHeight])

  const placedModules = useMemo(() => {
    return emeModules.map((module) => {
      const rad = ((module.angle + angle) * Math.PI) / 180
      const sin = Math.sin(rad)
      const cos = Math.cos(rad)
      const front = -cos
      const x = sin * stage.radiusX
      const y = -cos * stage.radiusY * (cos > 0 ? 0.54 : 0.92) + Math.abs(sin) * 14
      const z = front >= 0 ? front * stage.radiusZ : front * stage.radiusZ * 1.34
      const scale = stage.cardScale * (0.76 + ((front + 1) / 2) * 0.26)
      const rotateY = -sin * 16
      const opacity = clamp(0.28 + ((front + 1) / 2) * 0.8, 0, 1)
      const blur = front < -0.16 ? Math.min(Math.abs(front + 0.16) * 3.5, 3.2) : 0
      const visible = x > -viewport.width * 0.46 && x < viewport.width * 0.46 && y > -170 && y < 180

      return {
        module,
        x,
        y,
        z,
        scale,
        rotateY,
        opacity,
        blur,
        front,
        visible,
        zIndex: Math.round((front + 1) * 100),
      }
    })
  }, [angle, stage.cardScale, stage.radiusX, stage.radiusY, stage.radiusZ, viewport.width])

  const activeIndex = useMemo(() => {
    const best = placedModules.reduce(
      (current, item, index) => (item.front > current.front ? { index, front: item.front } : current),
      { index: 0, front: -Infinity },
    )
    return best.index
  }, [placedModules])

  return (
    <main
      ref={scrollerRef}
      className="fixed inset-0 h-[100dvh] overflow-y-auto overscroll-y-contain bg-background"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <CoastalCityBackground />

      <MobileHeader
        authOpen={authOpen}
        onEntrar={() => onAuthModeChange("login")}
        onComecar={() => onAuthModeChange("signup")}
      />

      <div className="relative" style={{ minHeight: stage.stageHeight }}>
        <div className="sticky top-0 h-[100dvh] overflow-hidden">
          <div
            className="absolute left-1/2 top-[29%]"
            style={{
              transform: `translate3d(-50%, -50%, 0) scale(${stage.logoScale})`,
              transformOrigin: "center center",
            }}
          >
            <EmeLogoSculpture />
          </div>

          <div
            className="absolute left-1/2 top-[58%] h-[260px] w-0"
            style={{ perspective: stage.perspective }}
          >
            {placedModules.map(({ module, x, y, z, scale, rotateY, opacity, blur, visible, zIndex, front }) => (
              <div
                key={module.id}
                className="absolute left-0 top-1/2"
                style={{
                  zIndex,
                  opacity: authOpen ? opacity * 0.28 : opacity,
                  filter: blur ? `blur(${blur}px)` : undefined,
                  transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotateY}deg) scale(${scale})`,
                  transformStyle: "preserve-3d",
                  transition: "opacity 0.28s ease, filter 0.28s ease",
                  pointerEvents: authOpen || !visible || front < -0.48 ? "none" : "auto",
                  visibility: visible ? "visible" : "hidden",
                }}
              >
                <button
                  type="button"
                  aria-label={`Abrir modulo ${module.name}`}
                  onClick={(event) => setSelected({ id: module.id, el: event.currentTarget })}
                  className="block rounded-[28px] text-left"
                >
                  <ModuleCard module={module} compact />
                </button>
              </div>
            ))}
          </div>

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
          Sistema Operacional do Corretor de Imoveis
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEntrar}
            tabIndex={authOpen ? -1 : 0}
            className="rounded-full border border-foreground/10 bg-white/80 px-3.5 py-1.5 text-[12px] font-medium tracking-tight text-foreground/85 backdrop-blur-sm transition-opacity duration-500"
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
