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
}

export function ResponsiveCollapsibleSection({
  title,
  children,
  defaultMobileOpen = false,
  className,
  contentClassName,
}: ResponsiveCollapsibleSectionProps) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    setOpen(media.matches || defaultMobileOpen)
  }, [defaultMobileOpen])

  return (
    <section className={cn("min-w-0 overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left text-white transition-colors hover:bg-white/[0.06]"
        aria-expanded={open}
      >
        <span className="min-w-0 truncate text-sm font-semibold md:text-base">{title}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : "rotate-0")} />
      </button>
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-200", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="min-h-0 overflow-hidden">
          <div className={cn("pt-3", contentClassName)}>{children}</div>
        </div>
      </div>
    </section>
  )
}
