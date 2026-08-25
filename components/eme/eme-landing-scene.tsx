"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react"

import { CoastalCityBackground } from "@/components/eme/coastal-city-background"
import { AuthPanel, type AuthMode } from "@/components/eme/auth-panel"
import { ExpandedModulePanel } from "@/components/eme/expanded-module-panel"
import {
  AcceleratorHero,
  LandingAcceleratorTeaser,
} from "@/components/eme/landing-accelerator"
import { LandingActivity } from "@/components/eme/landing-activity"
import { LandingHeader } from "@/components/eme/landing-header"
import { OrbitStage } from "@/components/eme/orbit-stage"
import { emeModules, marketplaceModule } from "@/lib/eme-modules"

export function EmeLandingScene({
  authMode,
  onAuthModeChange,
  onAuthClose,
}: {
  authMode: AuthMode | null
  onAuthModeChange: (mode: AuthMode) => void
  onAuthClose: () => void
}) {
  const mainRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [acceleratorOpen, setAcceleratorOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [selected, setSelected] = useState<{ id: string; el: HTMLElement } | null>(null)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selected?.id ?? null
  const selectedModule = selected
    ? selected.id === marketplaceModule.id
      ? marketplaceModule
      : emeModules.find((m) => m.id === selected.id)
    : undefined

  const handleSelect = (id: string, el: HTMLElement) => {
    setActiveId(null)
    setSelected({ id, el })
  }

  const authOpenRef = useRef(false)
  authOpenRef.current = authMode != null
  const acceleratorOpenRef = useRef(false)
  acceleratorOpenRef.current = acceleratorOpen

  const openAuth = (mode: AuthMode) => {
    setSelected(null)
    setActiveId(null)
    onAuthModeChange(mode)
  }

  const orbitTarget = useMotionValue(0)
  const orbitAngle = useSpring(orbitTarget, { stiffness: 55, damping: 18, mass: 1.1 })
  const sceneBlocking = authMode != null || selected != null || acceleratorOpen

  useEffect(() => {
    const THRESHOLD = 1.5
    const SENSITIVITY = 0.13

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (selectedRef.current || authOpenRef.current || acceleratorOpenRef.current) return
      if (Math.abs(e.deltaY) < THRESHOLD) return
      orbitTarget.set(orbitTarget.get() + e.deltaY * SENSITIVITY)
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    return () => window.removeEventListener("wheel", onWheel)
  }, [orbitTarget])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    let previous = performance.now()

    const advanceOrbit = (now: number) => {
      const elapsed = Math.min(now - previous, 64)
      previous = now
      if (!selectedRef.current && !authOpenRef.current && !acceleratorOpenRef.current) {
        orbitTarget.set(orbitTarget.get() + elapsed * 0.002)
      }
      raf = requestAnimationFrame(advanceOrbit)
    }

    raf = requestAnimationFrame(advanceOrbit)
    return () => cancelAnimationFrame(raf)
  }, [orbitTarget])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    if (window.matchMedia("(pointer: coarse)").matches) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    let raf = 0
    const target = { x: 0, y: 0 }
    const cur = { x: 0, y: 0 }
    const cursorTarget = { x: 0, y: 0 }
    const cursorCur = { x: 0, y: 0 }
    let seeded = false

    const onMove = (e: PointerEvent) => {
      if (selectedRef.current || authOpenRef.current || acceleratorOpenRef.current) return
      target.x = (e.clientX / window.innerWidth - 0.5) * 2
      target.y = (e.clientY / window.innerHeight - 0.5) * 2
      cursorTarget.x = e.clientX
      cursorTarget.y = e.clientY
      if (!seeded) {
        cursorCur.x = e.clientX
        cursorCur.y = e.clientY
        seeded = true
      }
    }

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.06
      cur.y += (target.y - cur.y) * 0.06
      main.style.setProperty("--px", cur.x.toFixed(4))
      main.style.setProperty("--py", cur.y.toFixed(4))

      cursorCur.x += (cursorTarget.x - cursorCur.x) * 0.18
      cursorCur.y += (cursorTarget.y - cursorCur.y) * 0.18
      const c = cursorRef.current
      if (c) {
        c.style.transform = `translate3d(${cursorCur.x - 20}px, ${cursorCur.y - 20}px, 0)`
      }
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener("pointermove", onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("pointermove", onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <main
      ref={mainRef}
      className={`eme-landing-scene relative h-[100svh] w-full overflow-hidden bg-background${sceneBlocking ? " is-paused" : ""}`}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{
          x: acceleratorOpen ? "9vw" : "0vw",
          rotateY: acceleratorOpen ? -3.2 : 0,
          rotateZ: acceleratorOpen ? -0.35 : 0,
          scale: acceleratorOpen ? 1.13 : 1,
        }}
        transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        style={{ perspective: 1600, transformOrigin: "34% 50%", willChange: "transform" }}
      >
        <CoastalCityBackground />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          x: acceleratorOpen ? "-18vw" : "0vw",
          rotateY: acceleratorOpen ? -5 : 0,
          scale: acceleratorOpen ? 0.985 : 1,
          opacity: acceleratorOpen ? 0 : 1,
        }}
        transition={{
          duration: acceleratorOpen ? 0.82 : 0.76,
          delay: acceleratorOpen ? 0 : 0.14,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ pointerEvents: acceleratorOpen ? "none" : "auto", willChange: "transform, opacity" }}
        aria-hidden={acceleratorOpen}
      >
        <LandingHeader
          onEntrar={() => openAuth("login")}
          onComecar={() => openAuth("signup")}
          authOpen={authMode != null}
        />
        <LandingActivity
          authOpen={authMode != null}
          className="absolute left-6 top-9 z-[60] hidden sm:block sm:left-12"
        />

        <LandingAcceleratorTeaser
          onOpen={() => {
            setActiveId(null)
            setAcceleratorOpen(true)
          }}
        />

        <div
          className="absolute inset-0 flex items-center justify-center -translate-y-[72px] pt-4 transition-opacity duration-700 ease-out sm:pt-2"
          style={{ opacity: mounted ? 1 : 0 }}
        >
          {mounted && (
            <OrbitStage
              orbitAngle={orbitAngle}
              activeId={activeId}
              onHover={setActiveId}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              authOpen={authMode != null}
            />
          )}
        </div>

        <div aria-hidden className="pointer-events-none absolute inset-0 z-[45] overflow-hidden">
          <div
            className="eme-ambient-light absolute left-1/2 top-[40%] h-[80vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 62%)",
              mixBlendMode: "soft-light",
            }}
          />
        </div>

        <div className="pointer-events-none absolute bottom-8 left-6 z-40 hidden sm:block sm:left-12">
          <div className="flex h-9 w-[22px] justify-center rounded-full border border-graphite/30 pt-1.5">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-graphite/50" />
          </div>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {acceleratorOpen ? (
          <motion.div
            key="accelerator"
            className="absolute inset-0 z-[70]"
            initial={{ x: "5vw", scale: 0.985, opacity: 0 }}
            animate={{ x: "0vw", scale: 1, opacity: 1 }}
            exit={{
              x: "5vw",
              scale: 0.985,
              opacity: 0,
              transition: { duration: 0.48, ease: [0.4, 0, 0.2, 1] },
            }}
            transition={{ duration: 0.78, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <AcceleratorHero
              onBack={() => setAcceleratorOpen(false)}
              onEntrar={() => openAuth("login")}
              onComecar={() => openAuth("signup")}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[80] hidden sm:block"
      >
        <div
          className="h-10 w-10 rounded-full border border-eme/60 bg-white/25 backdrop-blur-[3px] transition-[opacity,transform] duration-300 ease-out"
          style={{
            opacity: activeId ? 1 : 0,
            transform: activeId ? "scale(1)" : "scale(0.95)",
          }}
        />
      </div>

    </main>
  )
}
