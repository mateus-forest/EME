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
    <section className="rounded-[1.75rem] border border-black/[0.06] bg-white p-8 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 text-2xl font-semibold text-[#050505]">{title}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[#6B7280]">{description}</p>
      {actionLabel && onAction ? (
        <Button
          type="button"
          onClick={onAction}
          className="mt-6 h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/18 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/28"
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
        <Card key={item} className="rounded-[1.25rem] border-black/[0.06] bg-[#fbfbf8] py-0">
          <CardContent className="flex items-start gap-3 p-4 text-left">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
            <p className="text-sm leading-6 text-[#5F6B7A]">{item}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
