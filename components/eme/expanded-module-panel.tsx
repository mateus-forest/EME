"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import Image from "next/image"
import type { EmeModule } from "@/lib/eme-modules"

type Rect = { left: number; top: number; width: number; height: number }

/**
 * Intrinsic aspect ratio (width / height) of each approved modal artwork AFTER
 * it was cropped to the real card (the surrounding white frame was trimmed and
 * the corners rounded to transparency). The panel is sized to the exact ratio
 * of the module's artwork so the image fills it with no crop and no margins.
 */
const MODAL_AR: Record<string, number> = {
  cos: 1448 / 932,
  clientes: 1486 / 972,
  imoveis: 1480 / 962,
  catalogo: 1478 / 971,
  "studio-ia": 1495 / 980,
  propostas: 1469 / 965,
  contratos: 1483 / 962,
  agenda: 1452 / 941,
}
const DEFAULT_AR = 1480 / 962

/**
 * The centred resting size the card grows into, locked to the artwork's own
 * aspect ratio and fit inside the viewport on BOTH axes so it never needs an
 * internal scrollbar on any device.
 */
function computeTarget(ar: number): Rect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const isNarrow = vw < 768
  const maxW = vw * (isNarrow ? 0.94 : 0.9)
  const maxH = vh * (isNarrow ? 0.9 : 0.92)
  const width = Math.min(maxW, maxH * ar)
  const height = width / ar
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height }
}

/**
 * Phase 4 — the selected card literally becomes its own presentation panel.
 *
 * Using a FLIP technique, we measure the clicked card's exact on-screen
 * rectangle and animate a single slab from that rectangle to the centred panel.
 * The panel's only content is the approved modal artwork for the module — a
 * pre-cropped, transparent-cornered PNG of the real modal card (scene, copy,
 * benefits and the close mark are all part of the image), shown exactly as
 * delivered with a soft drop-shadow that follows its rounded shape. There is no
 * extra white frame around it. A transparent hit-area over the artwork's close
 * mark, plus outside-click and Escape, dismiss the panel.
 */
export function ExpandedModulePanel({
  module,
  originEl,
  onClose,
}: {
  module: EmeModule
  originEl: HTMLElement
  onClose: () => void
}) {
  const ar = MODAL_AR[module.id] ?? DEFAULT_AR
  const [start, setStart] = useState<Rect | null>(null)
  const [target, setTarget] = useState<Rect | null>(null)
  const [open, setOpen] = useState(false)
  const closingRef = useRef(false)

  // Measure the card and kick off the growth on the next frame.
  useLayoutEffect(() => {
    const r = originEl.getBoundingClientRect()
    setStart({ left: r.left, top: r.top, width: r.width, height: r.height })
    setTarget(computeTarget(ar))
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [originEl, ar])

  useEffect(() => {
    const onResize = () => setTarget(computeTarget(ar))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [ar])

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    // Re-measure the origin in case the orbit drifted, so the card returns to
    // its true current position.
    const r = originEl.getBoundingClientRect()
    setStart({ left: r.left, top: r.top, width: r.width, height: r.height })
    setOpen(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!start || !target) return null

  const geo = open ? target : start

  return (
    <>
      {/* Transparent click-catcher — closes on outside click. No visual scrim,
          so the dimmed orbit and logo stay fully visible behind. Sits above the
          landing header so the header never overlaps the panel. */}
      <div className="fixed inset-0 z-[80]" onClick={handleClose} aria-hidden />

      <motion.section
        role="dialog"
        aria-label={module.name}
        aria-modal={false}
        className="fixed z-[82] cursor-default"
        initial={false}
        animate={{
          left: geo.left,
          top: geo.top,
          width: geo.width,
          height: geo.height,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 30, mass: 0.9 }}
        onAnimationComplete={() => {
          if (!open && closingRef.current) onClose()
        }}
        // A soft drop-shadow that hugs the artwork's rounded, transparent shape,
        // so the modal lifts off the page without any added white frame.
        style={{ filter: "drop-shadow(0 40px 80px rgba(28,52,40,0.34))" }}
      >
        {/* The approved, pre-cropped modal artwork — shown exactly as delivered.
            The box is locked to the artwork's own ratio, so `fill` covers it
            perfectly with no crop and no empty margins. */}
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: open ? 0.4 : 0.18, delay: open ? 0.16 : 0 }}
        >
          <Image
            src={module.mockup || "/placeholder.svg"}
            alt={`Módulo ${module.name}`}
            fill
            sizes="(max-width: 768px) 94vw, 90vw"
            className="object-contain"
            priority
          />
        </motion.div>

        {/* Transparent close hit-area, placed over the artwork's own close mark
            (top-right). Generous enough to cover its slight per-artwork offset. */}
        <motion.button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute right-0 top-0 z-10 h-[14%] w-[12%] cursor-pointer"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: 0.2, delay: open ? 0.15 : 0 }}
        />
      </motion.section>
    </>
  )
}
