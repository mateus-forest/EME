"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { ArrowUpRight, Check, Link2, X } from "lucide-react"
import Image from "next/image"

import type { EmeModule } from "@/lib/eme-modules"

type Rect = { left: number; top: number; width: number; height: number }

function computeTarget(): Rect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const isMobile = vw < 768
  const width = isMobile ? vw * 0.92 : Math.min(950, vw * 0.92)
  const height = isMobile ? Math.min(vh * 0.84, 660) : Math.min(560, vh * 0.86)
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
  const isCosModule = module.id === "cos"
  const isCatalogModule = module.id === "catalogo"
  const isContractsModule = module.id === "contratos"
  const isProposalsModule = module.id === "propostas"

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
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-graphite/15 bg-white/80 text-graphite backdrop-blur-sm transition-colors hover:bg-white"
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: 0.2, delay: open ? 0.15 : 0 }}
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </motion.button>

        <motion.div
          className={`relative flex h-full w-full flex-col ${isContractsModule ? "md:flex-row-reverse" : "md:flex-row"}`}
          animate={{ opacity: open ? 1 : 0 }}
          transition={{ duration: open ? 0.4 : 0.18, delay: open ? 0.18 : 0 }}
        >
          <div
            className={`relative flex min-h-0 items-center justify-center overflow-hidden ${
              isCosModule
                ? "basis-[50%] px-2 pb-2 pt-4 md:basis-[49%] md:px-3 md:py-5"
                : isCatalogModule
                ? "basis-[44%] px-3 pb-2 pt-5 md:basis-[52%] md:px-5 md:py-8"
                : isContractsModule
                  ? "basis-[50%] px-2 pb-0 pt-4 md:basis-[48%] md:px-3 md:py-4"
                  : isProposalsModule
                    ? "basis-[50%] px-3 pb-3 pt-5 md:basis-[46%] md:px-4 md:py-7"
                : "basis-[52%] p-4 md:basis-auto md:flex-1 md:p-8"
            }`}
          >
            <motion.div
              className={`relative w-full ${
                  isCosModule
                    ? "h-full min-h-[300px] rounded-[28px] md:min-h-0 md:rounded-[34px]"
                  : isCatalogModule
                  ? "h-full max-h-[300px] md:max-h-none"
                  : isContractsModule
                    ? "h-full min-h-[280px] overflow-hidden rounded-[30px] md:min-h-0 md:rounded-[36px]"
                    : isProposalsModule
                      ? "h-full min-h-[320px] overflow-hidden rounded-[28px] md:min-h-0 md:rounded-[32px]"
                    : "h-full"
              }`}
              animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.94 }}
              transition={{ duration: 0.5, delay: open ? 0.2 : 0, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                src={module.mockup || "/placeholder.svg"}
                alt={`Mockup do módulo ${module.name}`}
                fill
                sizes="(max-width: 768px) 90vw, 45vw"
                className={`${
                  isCosModule
                    ? "object-contain object-center"
                    : isContractsModule
                    ? "object-cover object-[76%_52%] md:object-[78%_50%]"
                    : isProposalsModule
                      ? "object-cover object-[36%_50%] md:object-[41%_50%]"
                    : "object-contain"
                } ${isCatalogModule ? "drop-shadow-[0_36px_70px_rgba(20,38,28,0.16)]" : ""} ${
                  isContractsModule ? "drop-shadow-[0_28px_70px_rgba(17,24,39,0.14)]" : ""
                } ${isProposalsModule ? "drop-shadow-[0_32px_72px_rgba(17,24,39,0.16)]" : ""} ${
                  isCosModule ? "drop-shadow-[0_30px_74px_rgba(17,24,39,0.16)]" : ""
                }`}
                priority
              />
            </motion.div>
          </div>

          <div
            className={`flex flex-1 flex-col justify-center overflow-y-auto px-6 pb-6 pt-1 md:overflow-visible md:px-8 md:py-10 ${
              isCosModule
                ? "gap-4 md:pl-10 md:pr-12"
                : isCatalogModule
                ? "gap-4 md:pr-12"
                : isContractsModule
                  ? "gap-4 md:pl-12 md:pr-10"
                  : isProposalsModule
                    ? "gap-4 md:pl-8 md:pr-12"
                  : "gap-2.5 md:gap-5 md:pr-14"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className="h-5 w-5 text-eme md:h-6 md:w-6" strokeWidth={1.5} aria-hidden />
              <span className="text-[10.5px] font-medium uppercase tracking-[0.32em] text-eme/70 md:text-[11px]">
                {module.name}
              </span>
            </div>

            <h2 className="text-balance text-[20px] font-medium leading-[1.15] tracking-tight text-foreground md:text-[32px]">
              {module.tagline}
            </h2>

            <div className="min-h-0 overflow-y-auto pr-1 md:overflow-visible md:pr-0">
              <p
                className={`text-pretty text-[13px] leading-relaxed text-muted-foreground md:text-[14.5px] ${
                  isCatalogModule ? "max-w-lg" : isContractsModule ? "max-w-[28rem]" : isProposalsModule ? "max-w-[30rem]" : "max-w-md"
                }`}
              >
                {module.longDescription}
              </p>

              <ul
                className={`flex flex-col ${
                  isCatalogModule
                    ? "mt-5 gap-3.5 md:mt-6"
                    : isContractsModule
                      ? "mt-6 gap-4"
                      : isProposalsModule
                        ? "mt-6 gap-4"
                      : "mt-4 gap-2 md:mt-5 md:gap-2.5"
                }`}
              >
                {module.benefits.map((benefit) => (
                  <li
                    key={typeof benefit === "string" ? benefit : benefit.title}
                    className={`flex items-start gap-2.5 text-foreground/90 ${
                      isCatalogModule
                        ? "text-[13px] md:text-[14px]"
                        : isContractsModule || isProposalsModule
                          ? "text-[14px]"
                          : "text-[12.5px] md:text-[14px]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-eme-soft ${
                        isCatalogModule ? "h-5 w-5 md:h-6 md:w-6" : isContractsModule || isProposalsModule ? "h-6 w-6" : "h-4 w-4 md:h-5 md:w-5"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 text-eme md:h-3 md:w-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {typeof benefit === "string" ? (
                      <span className="leading-snug">{benefit}</span>
                    ) : (
                      <span className="space-y-0.5">
                        <span className="block font-medium leading-snug text-foreground">{benefit.title}</span>
                        {benefit.description ? (
                          <span className="block leading-snug text-muted-foreground">{benefit.description}</span>
                        ) : null}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {isCatalogModule && module.demoLink ? (
                <div className="mt-6 rounded-[22px] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_50px_-30px_rgba(17,24,39,0.28)]">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3f7f4] text-[#5b6575]">
                      <Link2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium tracking-tight text-[#465162]">{module.demoLabel}</span>
                        {module.demoBadge ? (
                          <span className="rounded-full bg-[#e6f6eb] px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.18em] text-[#4b9c63]">
                            {module.demoBadge}
                          </span>
                        ) : null}
                      </div>
                      <a
                        href={module.demoLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex max-w-full items-center gap-2 text-[13px] leading-snug text-[#4f7cff] transition-colors hover:text-[#305ee6]"
                      >
                        <span className="truncate">{module.demoLink}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                      </a>
                      {module.demoHint ? (
                        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{module.demoHint}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className={isCatalogModule ? "pt-5 md:pt-6" : isContractsModule || isProposalsModule ? "pt-6" : "pt-4 md:pt-5"}>
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full bg-eme text-[13.5px] font-medium tracking-tight text-primary-foreground shadow-[0_14px_30px_-14px_rgba(28,120,60,0.7)] transition-transform hover:-translate-y-0.5 md:text-[14px] ${
                    isCatalogModule || isContractsModule || isProposalsModule ? "px-6 py-3" : "px-6 py-2.5"
                  }`}
                >
                  <span>{module.cta}</span>
                  {isCatalogModule || isContractsModule || isProposalsModule ? <ArrowUpRight className="h-4 w-4" strokeWidth={1.9} aria-hidden /> : null}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>
    </>
  )
}
