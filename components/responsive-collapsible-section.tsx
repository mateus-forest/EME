"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type ResponsiveCollapsibleSectionProps = {
  title: string
  children: ReactNode
  defaultMobileOpen?: boolean
  className?: string
  contentClassName?: string
  variant?: "default" | "broker"
  tone?: "default" | "broker"
}

export function ResponsiveCollapsibleSection({
  title,
  children,
  defaultMobileOpen = false,
  className,
  contentClassName,
  variant = "default",
  tone,
}: ResponsiveCollapsibleSectionProps) {
  const [open, setOpen] = useState(true)
  const [isDesktop, setIsDesktop] = useState(false)
  const resolvedVariant = tone ?? variant

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    const initialOpen = media.matches || defaultMobileOpen

    setIsDesktop(media.matches)
    setOpen(initialOpen)

    if (resolvedVariant !== "broker") return

    const handleViewportChange = (matches: boolean) => {
      setIsDesktop(matches)
      setOpen(matches || defaultMobileOpen)
    }

    const handleChange = (event: MediaQueryListEvent) => handleViewportChange(event.matches)
    media.addEventListener("change", handleChange)

    return () => media.removeEventListener("change", handleChange)
  }, [defaultMobileOpen, resolvedVariant])

  const contentOpen = resolvedVariant === "broker" && isDesktop ? true : open

  return (
    <section className={cn("min-w-0 overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-3 px-4 text-left transition-colors",
          resolvedVariant === "broker"
            ? "min-h-11 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface)] py-2.5 text-[var(--broker-ink)] shadow-[var(--broker-shadow-xs)] hover:border-[var(--broker-border-strong)] hover:bg-white md:hidden"
            : "rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] py-3 text-white hover:bg-white/[0.06]",
        )}
        aria-expanded={contentOpen}
      >
        <span className={cn("min-w-0 truncate font-semibold", resolvedVariant === "broker" ? "text-sm" : "text-sm md:text-base")}>
          {title}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            resolvedVariant === "broker" && "text-[var(--broker-muted)]",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-200", contentOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className={cn(resolvedVariant === "broker" ? "pt-2.5 md:pt-0" : "pt-3", contentClassName)}>{children}</div>
        </div>
      </div>
    </section>
  )
}
