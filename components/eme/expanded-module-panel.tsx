"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Check, X } from "lucide-react"
import Image from "next/image"

import type { EmeModule } from "@/lib/eme-modules"

type Rect = { left: number; top: number; width: number; height: number }

function computeTarget(): Rect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const isMobile = vw < 768
  const width = isMobile ? Math.min(430, vw - 16) : Math.min(950, vw * 0.92)
  const height = isMobile ? Math.min(vh - 16, 720) : Math.min(560, vh * 0.86)
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height }
}

export function ExpandedModulePanel({
  module,
  originEl,
  onClose,
}: {
  module: EmeModule
  originEl: HTMLElement
  onClose: () => void
}) {
  const [start, setStart] = useState<Rect | null>(null)
  const [target, setTarget] = useState<Rect | null>(null)
  const [open, setOpen] = useState(false)
  const closingRef = useRef(false)

  useLayoutEffect(() => {
    const r = originEl.getBoundingClientRect()
    setStart({ left: r.left, top: r.top, width: r.width, height: r.height })
    setTarget(computeTarget())
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [originEl])

  useEffect(() => {
    const onResize = () => setTarget(computeTarget())
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    const r = originEl.getBoundingClientRect()
    setStart({ left: r.left, top: r.top, width: r.width, height: r.height })
    setOpen(false)
  }, [originEl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleClose])

  if (!start || !target) return null

  const geo = open ? target : start
  const Icon = module.icon

  return (
    <>
      <div className="fixed inset-0 z-[65] bg-[rgba(14,18,22,0.78)] backdrop-blur-[4px]" onClick={handleClose} aria-hidden />

      <motion.section
        role="dialog"
        aria-label={module.name}
        aria-modal={false}
        className="fixed z-[70] cursor-default overflow-hidden"
        initial={false}
        animate={{
          left: geo.left,
          top: geo.top,
          width: geo.width,
          height: geo.height,
          borderRadius: open ? 34 : 30,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 30, mass: 0.9 }}
        onAnimationComplete={() => {
          if (!open && closingRef.current) onClose()
        }}
        style={{
          boxShadow:
            "0 60px 120px -40px rgba(28,52,40,0.55), 0 18px 40px -20px rgba(28,52,40,0.35)",
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            borderRadius: "inherit",
            background:
              "linear-gradient(140deg, rgba(255,255,255,0.98) 0%, rgba(214,228,220,0.55) 14%, rgba(255,255,255,0.15) 40%, rgba(255,255,255,0.15) 62%, rgba(214,228,220,0.5) 88%, rgba(255,255,255,0.92) 100%)",
          }}
        />
        <div
          className="absolute inset-[6px] overflow-hidden bg-gradient-to-b from-white via-white to-[#f3f7f4] backdrop-blur-md"
          style={{ borderRadius: "inherit" }}
        />
        <div
          aria-hidden
          className="absolute inset-[6px] ring-1 ring-inset ring-white/70"
          style={{ borderRadius: "inherit" }}
        />
        <div
          aria-hidden
          className="absolute inset-[6px]"
          style={{
            borderRadius: "inherit",
            background:
              "linear-gradient(150deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 26%)",
          }}
        />

        <motion.button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute right-3.5 top-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-graphite/15 bg-white/80 text-graphite backdrop-blur-sm transition-colors hover:bg-white md:right-5 md:top-5"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: 0.2, delay: open ? 0.15 : 0 }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </motion.button>

        <motion.div
          className="relative flex h-full w-full flex-col md:flex-row"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: open ? 0.4 : 0.18, delay: open ? 0.18 : 0 }}
        >
          <div className="relative flex min-h-[33svh] flex-[0_0_42%] items-center justify-center overflow-hidden px-4 pb-2 pt-10 sm:min-h-[36svh] md:min-h-0 md:flex-1 md:p-8">
            <motion.div
              className="relative h-full w-full"
              animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.94 }}
              transition={{ duration: 0.5, delay: open ? 0.2 : 0, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src={module.mockup || "/placeholder.svg"}
                alt={`Mockup do modulo ${module.name}`}
                fill
                sizes="(max-width: 430px) 92vw, (max-width: 768px) 88vw, 45vw"
                className="object-contain"
                priority
              />
            </motion.div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-5 pt-1 md:justify-center md:gap-5 md:px-8 md:pb-10 md:pt-2 md:py-10 md:pr-14">
            <div className="flex items-center gap-2.5">
              <Icon className="h-6 w-6 text-eme" strokeWidth={1.5} aria-hidden />
              <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-eme/70 md:text-[11px] md:tracking-[0.32em]">
                {module.name}
              </span>
            </div>

            <h2 className="text-balance text-[22px] font-medium leading-[1.12] tracking-tight text-foreground sm:text-[24px] md:text-[32px]">
              {module.tagline}
            </h2>

            <div className="min-h-0 overflow-y-auto pr-1 md:overflow-visible md:pr-0">
              <p className="max-w-md text-pretty text-[13px] leading-[1.65] text-muted-foreground sm:text-[13.5px] md:text-[14.5px] md:leading-relaxed">
                {module.longDescription}
              </p>

              <ul className="mt-4 flex flex-col gap-2.5 md:mt-5">
                {module.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[13px] text-foreground/90 md:text-[14px]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-eme-soft">
                      <Check className="h-3 w-3 text-eme" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="leading-[1.45] md:leading-snug">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-4 md:pt-5">
                <button
                  type="button"
                  className="rounded-full bg-eme px-5 py-2.5 text-[13px] font-medium tracking-tight text-primary-foreground shadow-[0_14px_30px_-14px_rgba(28,120,60,0.7)] transition-transform hover:-translate-y-0.5 md:px-6 md:text-[14px]"
                >
                  {module.cta}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>
    </>
  )
}
