"use client"

import type { ReactNode } from "react"
import { CheckCircle2, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type AdminEmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  children?: ReactNode
}

export function AdminEmptyState({ icon: Icon, title, description, actionLabel, onAction, children }: AdminEmptyStateProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-white/55">{description}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          onClick={onAction}
          className="mt-6 h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
        >
          {actionLabel}
        </Button>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  )
}

export function AdminStructureCards({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item} className="rounded-[1.25rem] border-white/[0.08] bg-white/[0.03] py-0">
          <CardContent className="flex items-start gap-3 p-4 text-left">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#69F0AE]" />
            <p className="text-sm leading-6 text-white/60">{item}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
