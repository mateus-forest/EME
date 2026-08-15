import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

type BrokerPageIntroProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  compact?: boolean
}

export function BrokerPageIntro({
  eyebrow,
  title,
  description,
  actions,
  compact = false,
  className,
  ...props
}: BrokerPageIntroProps) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        compact ? "py-0.5" : "py-1",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--broker-accent)]">
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={cn(
            "font-semibold tracking-[-0.035em] text-[var(--broker-ink)]",
            compact ? "mt-1 text-xl sm:text-[1.4rem]" : "mt-1.5 text-2xl sm:text-[1.75rem]",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-[var(--broker-muted)] sm:leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

type BrokerSurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "article" | "aside" | "form"
  tone?: "default" | "subtle" | "inset" | "transparent"
  padding?: "none" | "compact" | "default"
}

export function BrokerSurface({
  as: Component = "section",
  tone = "default",
  padding = "default",
  className,
  ...props
}: BrokerSurfaceProps) {
  return (
    <Component
      className={cn(
        "min-w-0 rounded-[var(--broker-radius-lg)] border",
        tone === "default" &&
          "border-[var(--broker-border)] bg-[var(--broker-surface)] shadow-[var(--broker-shadow-sm)]",
        tone === "subtle" && "border-[var(--broker-border)] bg-[var(--broker-surface-subtle)]",
        tone === "inset" && "border-transparent bg-[var(--broker-surface-inset)]",
        tone === "transparent" && "border-transparent bg-transparent",
        padding === "compact" && "p-3.5 sm:p-4",
        padding === "default" && "p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  )
}

type BrokerToolbarProps = HTMLAttributes<HTMLDivElement> & {
  start?: ReactNode
  end?: ReactNode
}

export function BrokerToolbar({ start, end, children, className, ...props }: BrokerToolbarProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface)] p-2.5 shadow-[var(--broker-shadow-xs)] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      {start ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{start}</div> : null}
      {children ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div> : null}
      {end ? <div className="flex shrink-0 flex-wrap items-center gap-2">{end}</div> : null}
    </div>
  )
}

export function BrokerStatStrip({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-border)] shadow-[var(--broker-shadow-xs)] md:grid-cols-4",
        className,
      )}
      {...props}
    />
  )
}

type BrokerStatItemProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode
  label: string
  value: ReactNode
  helper?: ReactNode
  tone?: "default" | "positive" | "warning" | "danger"
}

const statToneClasses = {
  default: "bg-[var(--broker-surface-inset)] text-[var(--broker-muted)]",
  positive: "bg-[var(--broker-accent-soft)] text-[var(--broker-accent)]",
  warning: "bg-[#fff7df] text-[#9a6700]",
  danger: "bg-[#fff0f0] text-[#b42318]",
} as const

export function BrokerStatItem({
  icon,
  label,
  value,
  helper,
  tone = "positive",
  className,
  ...props
}: BrokerStatItemProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 bg-[var(--broker-surface)] px-3.5 py-3 md:px-4 md:py-3.5",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[0.8rem]", statToneClasses[tone])}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="truncate text-xs text-[var(--broker-muted)]">{label}</p>
        <div className="mt-0.5 truncate text-lg font-semibold leading-tight text-[var(--broker-ink)]">{value}</div>
        {helper ? <div className="mt-0.5 truncate text-[11px] text-[var(--broker-muted-soft)]">{helper}</div> : null}
      </div>
    </div>
  )
}

type BrokerStatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "info" | "warning" | "danger"
}

const statusToneClasses = {
  neutral: "border-[var(--broker-border)] bg-[var(--broker-surface-inset)] text-[var(--broker-muted)]",
  positive: "border-[var(--broker-accent-border)] bg-[var(--broker-accent-soft)] text-[var(--broker-accent-strong)]",
  info: "border-[#d8e8ff] bg-[#eef6ff] text-[#2463a3]",
  warning: "border-[#f1dfad] bg-[#fff8e5] text-[#936300]",
  danger: "border-[#f1cdcd] bg-[#fff1f1] text-[#b42318]",
} as const

export function BrokerStatusPill({ tone = "neutral", className, ...props }: BrokerStatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-4",
        statusToneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}

type BrokerEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function BrokerEmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: BrokerEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-40 flex-col items-center justify-center rounded-[var(--broker-radius-lg)] border border-dashed border-[var(--broker-border-strong)] bg-[var(--broker-surface-subtle)] px-5 py-7 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="mb-3 flex size-10 items-center justify-center rounded-[0.9rem] bg-[var(--broker-accent-soft)] text-[var(--broker-accent)]">
          {icon}
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-[var(--broker-ink)]">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm leading-5 text-[var(--broker-muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

type BrokerWorkspacePaneProps = HTMLAttributes<HTMLElement> & {
  title?: string
  description?: string
  actions?: ReactNode
  scrollable?: boolean
}

export function BrokerWorkspacePane({
  title,
  description,
  actions,
  scrollable = false,
  className,
  children,
  ...props
}: BrokerWorkspacePaneProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-surface)] shadow-[var(--broker-shadow-xs)]",
        className,
      )}
      {...props}
    >
      {title || description || actions ? (
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[var(--broker-border)] px-4 py-3.5">
          <div className="min-w-0">
            {title ? <h3 className="truncate text-base font-semibold text-[var(--broker-ink)]">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs leading-5 text-[var(--broker-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("min-h-0 min-w-0 flex-1", scrollable && "eme-subtle-scrollbar overflow-y-auto overscroll-contain")}>
        {children}
      </div>
    </section>
  )
}
