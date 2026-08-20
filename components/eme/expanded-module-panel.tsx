"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion } from "motion/react"
import { Check, X } from "lucide-react"

import type { EmeModule } from "@/lib/eme-modules"

type Rect = { left: number; top: number; width: number; height: number }

const MODAL_AR: Record<string, number> = {
  cos: 1448 / 932,
  clientes: 1486 / 972,
  imoveis: 1536 / 1024,
  catalogo: 1536 / 1024,
  "studio-ia": 1536 / 1024,
  propostas: 1536 / 1024,
  contratos: 1536 / 1024,
  agenda: 1452 / 941,
  marketplace: 1522 / 1033,
}
const DEFAULT_AR = 1480 / 962

function computeTarget(aspectRatio: number): Rect {
  const visualViewport = window.visualViewport
  const viewportWidth = visualViewport?.width ?? window.innerWidth
  const viewportHeight = visualViewport?.height ?? window.innerHeight
  const viewportLeft = visualViewport?.offsetLeft ?? 0
  const viewportTop = visualViewport?.offsetTop ?? 0
  const isNarrow = viewportWidth < 768

  if (isNarrow) {
    const gutter = 8
    return {
      left: viewportLeft + gutter,
      top: viewportTop + gutter,
      width: viewportWidth - gutter * 2,
      height: viewportHeight - gutter * 2,
    }
  }

  const maxWidth = viewportWidth * 0.9
  const maxHeight = viewportHeight * 0.92
  const width = Math.min(maxWidth, maxHeight * aspectRatio)
  const height = width / aspectRatio

  return {
    left: viewportLeft + (viewportWidth - width) / 2,
    top: viewportTop + (viewportHeight - height) / 2,
    width,
    height,
  }
}

function useModalScrollLock() {
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [])
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
  const aspectRatio = MODAL_AR[module.id] ?? DEFAULT_AR
  const [start, setStart] = useState<Rect | null>(null)
  const [target, setTarget] = useState<Rect | null>(null)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useModalScrollLock()

  useLayoutEffect(() => {
    const rect = originEl.getBoundingClientRect()
    setStart({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    setTarget(computeTarget(aspectRatio))
  }, [aspectRatio, originEl])

  useEffect(() => {
    const updateTarget = () => setTarget(computeTarget(aspectRatio))
    const visualViewport = window.visualViewport

    window.addEventListener("resize", updateTarget)
    visualViewport?.addEventListener("resize", updateTarget)
    visualViewport?.addEventListener("scroll", updateTarget)
    return () => {
      window.removeEventListener("resize", updateTarget)
      visualViewport?.removeEventListener("resize", updateTarget)
      visualViewport?.removeEventListener("scroll", updateTarget)
    }
  }, [aspectRatio])

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true

    const rect = originEl.getBoundingClientRect()
    setStart({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    setClosing(true)
    closeFallbackRef.current = setTimeout(onClose, 750)
  }, [onClose, originEl])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleClose])

  useEffect(
    () => () => {
      if (closeFallbackRef.current) clearTimeout(closeFallbackRef.current)
    },
    [],
  )

  if (!start || !target) return null

  const geometry = closing ? start : target
  const isMobilePanel = target.height / target.width > 1.7
  const ModuleIcon = module.icon

  return (
    <>
      <button
        type="button"
        aria-label="Fechar módulo"
        className="fixed inset-0 z-[80] cursor-default bg-graphite/10 md:bg-transparent"
        onClick={handleClose}
      />

      <motion.section
        role="dialog"
        aria-label={module.name}
        aria-modal="true"
        data-module-dialog={module.id}
        className="fixed z-[82] cursor-default overflow-hidden rounded-[26px] border border-white/70 bg-white text-foreground shadow-[0_26px_70px_-36px_rgba(20,52,36,0.48)] md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:shadow-none md:[filter:drop-shadow(0_40px_80px_rgba(28,52,40,0.34))]"
        initial={{
          left: isMobilePanel ? target.left : start.left,
          top: isMobilePanel ? target.top : start.top,
          width: isMobilePanel ? target.width : start.width,
          height: isMobilePanel ? target.height : start.height,
        }}
        animate={{
          left: geometry.left,
          top: geometry.top,
          width: geometry.width,
          height: geometry.height,
        }}
        transition={
          isMobilePanel
            ? { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
            : { type: "spring", stiffness: 200, damping: 30, mass: 0.9 }
        }
        onAnimationComplete={() => {
          if (closing && closingRef.current) {
            if (closeFallbackRef.current) clearTimeout(closeFallbackRef.current)
            onClose()
          }
        }}
      >
        <motion.div
          className="absolute inset-0 hidden md:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: closing ? 0 : 1 }}
          transition={{ duration: closing ? 0.18 : 0.4, delay: closing ? 0 : 0.16 }}
        >
          <Image
            src={module.mockup || "/placeholder.svg"}
            alt={`Módulo ${module.name}`}
            fill
            sizes="90vw"
            className="object-contain"
            priority
          />

          {module.id === "marketplace" && module.demoHref ? (
            <a
              href={module.demoHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver exemplo no Marketplace — Abrir demonstração"
              className="absolute bottom-[3.2%] left-[64.1%] h-[10.7%] w-[23.1%] rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme focus-visible:ring-offset-2"
            />
          ) : null}
        </motion.div>

        <motion.div
          className="absolute inset-0 flex flex-col md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: closing ? 0 : 1 }}
          transition={{ duration: closing ? 0.16 : 0.32, delay: closing ? 0 : 0.12 }}
        >
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="absolute right-[max(12px,env(safe-area-inset-right))] top-[max(12px,env(safe-area-inset-top))] z-20 flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 bg-white/95 text-foreground/75 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/50"
          >
            <X className="size-5" aria-hidden />
          </button>

          <div
            data-mobile-module-scroll
            className="eme-hidden-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-5"
            style={{
              paddingTop: "max(4.75rem, calc(env(safe-area-inset-top) + 3.5rem))",
              paddingBottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))",
            }}
          >
            <div className="flex items-center gap-2.5 text-eme-dark">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-eme/10">
                <ModuleIcon className="size-5 text-eme" strokeWidth={1.7} aria-hidden />
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">{module.name}</span>
            </div>

            <h2 className="mt-5 text-balance text-[27px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground">
              {module.tagline}
            </h2>
            <p className="mt-3 text-pretty text-[14px] leading-relaxed text-foreground/68">
              {module.longDescription}
            </p>

            <div
              data-mobile-module-mockup
              className="relative mt-5 w-full overflow-hidden rounded-[22px] border border-foreground/8 bg-[#f6f3ef] p-2 shadow-[0_18px_42px_-32px_rgba(20,52,36,0.42)]"
              style={{ aspectRatio }}
            >
              <Image
                src={module.mockup || "/placeholder.svg"}
                alt={`Prévia visual do módulo ${module.name}`}
                fill
                sizes="(max-width: 767px) calc(100vw - 58px), 680px"
                className="object-contain p-2"
                priority
              />
            </div>

            <ul className="mt-5 grid gap-3" aria-label={`Benefícios de ${module.name}`}>
              {module.benefits.map((benefit) => {
                const title = typeof benefit === "string" ? benefit : benefit.title
                const description = typeof benefit === "string" ? null : benefit.description

                return (
                  <li key={title} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-eme/12 text-eme-dark">
                      <Check className="size-3.5" strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="min-w-0 text-[13px] leading-snug text-foreground/82">
                      <span className="font-medium">{title}</span>
                      {description ? (
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-foreground/55">
                          {description}
                        </span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ul>

            {module.id === "marketplace" && module.demoHref ? (
              <a
                href={module.demoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="eme-gradient mt-6 flex min-h-12 w-full items-center justify-center rounded-full px-5 text-center text-[14px] font-medium text-primary-foreground shadow-[0_14px_28px_-16px_rgba(28,120,60,0.58)]"
              >
                {module.cta}
              </a>
            ) : null}
          </div>
        </motion.div>

        <motion.button
          type="button"
          onClick={handleClose}
          aria-label="Fechar"
          className="absolute right-0 top-0 z-10 hidden h-[14%] w-[12%] cursor-pointer items-start justify-end p-[10%] md:flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: closing ? 0 : 1 }}
          transition={{ duration: 0.2, delay: closing ? 0 : 0.15 }}
        >
          {module.id === "contratos" || module.id === "propostas" ? (
            <span className="flex size-11 items-center justify-center rounded-full border border-foreground/8 bg-white/95 text-foreground shadow-[0_10px_28px_rgba(22,34,27,0.12)]">
              <X className="size-5" aria-hidden />
            </span>
          ) : null}
        </motion.button>
      </motion.section>
    </>
  )
}
