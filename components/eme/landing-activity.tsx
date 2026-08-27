"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import type { LandingActivityMetric, LandingActivityResponse } from "@/lib/landing-activity"

const ROTATION_INTERVAL_MS = 5_500

function isActivityMetric(value: unknown): value is LandingActivityMetric {
  if (!value || typeof value !== "object") return false
  const metric = value as Partial<LandingActivityMetric>
  return (
    typeof metric.id === "string" &&
    typeof metric.value === "number" &&
    metric.value > 0 &&
    typeof metric.period === "string" &&
    typeof metric.title === "string" &&
    typeof metric.subtitle === "string"
  )
}

export function LandingActivity({
  authOpen = false,
  compact = false,
  className = "",
}: {
  authOpen?: boolean
  compact?: boolean
  className?: string
}) {
  const [metrics, setMetrics] = useState<LandingActivityMetric[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    fetch("/api/landing/activity", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as Partial<LandingActivityResponse>
      })
      .then((payload) => {
        if (!payload?.metrics || !Array.isArray(payload.metrics)) return
        setMetrics(payload.metrics.filter(isActivityMetric))
        setActiveIndex(0)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setReducedMotion(media.matches)
    updatePreference()
    media.addEventListener("change", updatePreference)
    return () => media.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    if (reducedMotion || metrics.length < 2 || authOpen) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % metrics.length)
    }, ROTATION_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [authOpen, metrics.length, reducedMotion])

  if (metrics.length === 0) return null

  const metric = metrics[Math.min(activeIndex, metrics.length - 1)]

  return (
    <aside
      aria-label="Agora no EME"
      aria-live="polite"
      className={`transition-opacity duration-500 motion-reduce:transition-none ${className}`.trim()}
      style={{ opacity: authOpen ? 0 : 1, pointerEvents: authOpen ? "none" : undefined }}
      data-testid="landing-activity"
      data-active-metric={metric.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="eme-landing-glass-chip inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 shadow-[0_8px_24px_rgba(36,55,45,0.06)] backdrop-blur-md">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full rounded-full bg-eme/35 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-eme" />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-graphite/80 sm:text-[10px]">
            Agora no EME
          </span>
        </div>
        <a
          href="https://www.meueme.com/imoveis"
          aria-label="Abrir Marketplace EME"
          className="eme-landing-glass-chip inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-graphite/80 shadow-[0_8px_24px_rgba(36,55,45,0.06)] backdrop-blur-md transition-colors hover:text-eme focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/50 sm:text-[10px]"
        >
          Marketplace &gt;
        </a>
      </div>

      <div className={compact ? "mt-2.5 min-h-[54px] max-w-[250px]" : "mt-4 min-h-[72px] max-w-[370px]"}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={metric.id}
            initial={reducedMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
          >
            <p className={compact ? "text-[14px] font-medium leading-snug tracking-[-0.02em] text-graphite" : "text-[20px] font-medium leading-tight tracking-[-0.025em] text-graphite sm:text-[22px]"}>
              {metric.title}
            </p>
            <p className={compact ? "mt-1 text-[10px] leading-snug text-graphite/60" : "mt-2 text-[12px] text-graphite/60 sm:text-[13px]"}>
              {metric.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {metrics.length > 1 ? (
        <div className={compact ? "mt-2 flex items-center gap-2" : "mt-3 flex items-center gap-2.5"} aria-label="Indicadores disponíveis">
          {metrics.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Mostrar indicador ${index + 1} de ${metrics.length}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
              className="group inline-flex size-3 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/50"
            >
              <span
                className={`block rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                  index === activeIndex ? "h-1.5 w-3 bg-eme" : "size-1.5 bg-graphite/20 group-hover:bg-graphite/35"
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
