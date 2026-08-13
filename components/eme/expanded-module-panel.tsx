"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, ExternalLink, ShieldCheck, X } from "lucide-react"
import { motion } from "motion/react"

import type { EmeModule } from "@/lib/eme-modules"

type Rect = { left: number; top: number; width: number; height: number }

function computeTarget(): Rect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const narrow = vw < 768
  const width = Math.min(vw * (narrow ? 0.94 : 0.88), 1240)
  const height = Math.min(vh * (narrow ? 0.92 : 0.86), 780)
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height }
}

function splitTagline(tagline: string, highlight: string) {
  const start = tagline.lastIndexOf(highlight)
  if (start < 0) return { before: tagline, highlight: "" }
  return { before: tagline.slice(0, start), highlight }
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
  const closeRef = useRef<HTMLButtonElement>(null)
  const Icon = module.icon
  const headline = splitTagline(module.tagline, module.highlight)
  const artwork = module.premiumMockup ?? module.mockup

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

  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    const r = originEl.getBoundingClientRect()
    setStart({ left: r.left, top: r.top, width: r.width, height: r.height })
    setOpen(false)
  }

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!start || !target) return null
  const geo = open ? target : start

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[80] bg-graphite/20 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
        aria-hidden
      />

      <motion.section
        role="dialog"
        aria-label={`Apresentação do módulo ${module.name}`}
        aria-modal="true"
        className="fixed z-[82] overflow-hidden rounded-[32px] border border-white/80 bg-white text-graphite shadow-[0_48px_120px_-36px_rgba(9,40,24,0.55)] md:rounded-[40px]"
        initial={false}
        animate={{ left: geo.left, top: geo.top, width: geo.width, height: geo.height }}
        transition={{ type: "spring", stiffness: 220, damping: 30, mass: 0.9 }}
        onAnimationComplete={() => {
          if (!open && closingRef.current) onClose()
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={handleClose}
          aria-label="Fechar apresentação"
          className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-graphite/10 bg-white/90 text-graphite shadow-lg backdrop-blur-md transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eme md:right-6 md:top-6"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        <motion.div
          className="flex h-full flex-col"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: open ? 0.4 : 0.14, delay: open ? 0.12 : 0 }}
        >
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1.05fr_0.95fr] md:overflow-hidden">
            <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-[#edf5f0] p-5 md:min-h-0 md:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_42%,rgba(255,255,255,0.96),rgba(224,241,231,0.72)_48%,rgba(194,220,204,0.5))]" />
              <div className="absolute bottom-[12%] left-[14%] right-[14%] h-8 rounded-full bg-graphite/15 blur-xl" />
              <div className="relative h-full max-h-[470px] w-full">
                <Image
                  src={artwork}
                  alt={`Prévia premium do módulo ${module.name}`}
                  fill
                  sizes="(max-width: 768px) 88vw, 46vw"
                  className={`${module.mockupFit === "cover" ? "object-cover" : "object-contain"} drop-shadow-[0_28px_30px_rgba(22,68,42,0.2)]`}
                  priority
                />
              </div>
            </div>

            <div className="flex flex-col px-6 pb-7 pt-16 md:min-h-0 md:px-12 md:pb-8 md:pt-12 lg:px-14">
              <div className="flex items-center gap-3 text-eme">
                <Icon className="h-7 w-7" strokeWidth={1.6} aria-hidden />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">{module.name}</span>
              </div>

              <h2 className="mt-6 text-balance text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-graphite lg:text-5xl">
                {headline.before}
                {headline.highlight && <span className="text-eme">{headline.highlight}</span>}
              </h2>
              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-graphite/65 lg:text-base">
                {module.longDescription}
              </p>

              <ul className="mt-7 grid gap-3 lg:mt-8">
                {module.benefits.slice(0, 5).map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3 text-sm leading-5 text-graphite/80">
                    <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-eme/10 text-eme">
                      <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="pt-0.5">{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto flex flex-col gap-3 pt-7 sm:flex-row">
                <Link
                  href="/cadastro"
                  className="eme-gradient inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-primary-foreground shadow-[0_14px_28px_-14px_rgba(0,144,60,0.7)] transition-transform hover:-translate-y-0.5"
                >
                  {module.cta}
                </Link>
                <Link
                  href={module.secondaryAction.href}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-eme/20 px-5 text-sm font-semibold text-eme-dark transition-colors hover:bg-eme/5"
                >
                  {module.secondaryAction.label}
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>

          <footer className="flex flex-col gap-2 border-t border-graphite/8 bg-[#f8faf8] px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-10">
            <div className="flex items-center gap-3 text-graphite/65">
              <ShieldCheck className="h-5 w-5 flex-none text-eme" aria-hidden />
              <p className="text-xs font-medium leading-5">{module.security}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-eme/70">EME</span>
          </footer>
        </motion.div>
      </motion.section>
    </>
  )
}
