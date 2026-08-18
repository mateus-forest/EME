"use client"

import { useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { NotificationCenter } from "@/components/notification-center"
import { BrokerSupportQuickAccess } from "@/components/broker-support-quick-access"
import { BrokerSidebar } from "@/components/broker-sidebar"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

type BrokerPageShellProps = {
  title: string
  eyebrow?: string
  subtitle?: ReactNode
  variant?: "default" | "cos"
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  primaryActionLabel?: string
  primaryActionHref?: string
  primaryActionOnClick?: () => void
  headerControls?: ReactNode
  notificationCenter?: ReactNode
  contentClassName?: string
  children: ReactNode
}

export function BrokerPageShell({
  title,
  eyebrow = "Portal do corretor",
  subtitle,
  variant = "default",
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryActionLabel,
  primaryActionHref = "#",
  primaryActionOnClick,
  headerControls,
  notificationCenter,
  contentClassName,
  children,
}: BrokerPageShellProps) {
  const isCosVariant = variant === "cos"
  const hasSearchArea = searchPlaceholder || headerControls
  const hasPrimaryAction = Boolean(primaryActionLabel)
  const { profile } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const { historyNotifications, unreadCount, markAsRead, archive } = useBrokerPaymentNotifications()
  const resolvedNotificationCenter = useMemo(
    () =>
      notificationCenter ?? (
        <NotificationCenter
          title="Notificações do corretor"
          notifications={historyNotifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onArchive={archive}
          historyHref="/corretor/notificacoes"
          relatedActionHref="/corretor/plano"
          tone="light"
        />
      ),
    [archive, historyNotifications, markAsRead, notificationCenter, unreadCount],
  )

  return (
    <SidebarProvider
      defaultOpen
      className={isCosVariant ? "h-[100dvh] min-h-0 overflow-hidden" : undefined}
      style={
        {
          "--sidebar-width": isCosVariant ? "15.5rem" : "14rem",
          "--sidebar-width-icon": "4rem",
        } as CSSProperties
      }
    >
      <div
        className={`broker-portal-scope pwa-safe-shell relative w-full overflow-hidden text-[var(--broker-ink)] ${
          isCosVariant
            ? "h-full min-h-0 bg-[#f4f1eb]"
            : "min-h-svh bg-[var(--broker-canvas)]"
        }`}
      >
        <div className={`relative z-0 flex w-full flex-col ${isCosVariant ? "h-full min-h-0" : "min-h-svh"}`}>
          {!isCosVariant ? (
            <header className="sticky top-0 z-20 border-b border-[var(--broker-border)] bg-white/92 backdrop-blur-xl">
              <div className="px-3.5 py-2.5 sm:px-4 lg:px-5">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:flex-row md:items-center md:gap-5">
                    <div className="flex items-center gap-3">
                      <SidebarTrigger className="size-9 rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-white text-[var(--broker-muted)] shadow-[var(--broker-shadow-xs)] hover:bg-white hover:text-[var(--broker-ink)] md:hidden" />
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--broker-muted-soft)]">
                            {eyebrow}
                          </p>
                          <h1 className="mt-0.5 text-[1.2rem] font-semibold leading-tight tracking-[-0.025em] text-[var(--broker-ink)]">
                            {title}
                          </h1>
                          {subtitle || profile.fullName ? (
                            <p className="mt-0.5 max-w-[16rem] truncate text-xs text-[var(--broker-muted)] sm:max-w-[22rem]">
                              {subtitle ?? profile.fullName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {hasSearchArea && (
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                        {searchPlaceholder && (
                          <div className="relative w-full max-w-[22rem]">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--broker-muted-soft)]" />
                            <Input
                              placeholder={searchPlaceholder}
                              value={searchValue}
                              onChange={(event) => onSearchChange?.(event.target.value)}
                              className="h-9 rounded-[var(--broker-radius-sm)] border-[var(--broker-border)] bg-white pl-9 text-sm text-[var(--broker-ink)] shadow-[var(--broker-shadow-xs)] placeholder:text-[var(--broker-muted-soft)] focus-visible:border-[var(--broker-accent-border)] focus-visible:ring-[var(--broker-accent)]/10"
                            />
                          </div>
                        )}

                        {headerControls ? <div className="shrink-0">{headerControls}</div> : null}
                      </div>
                    )}
                  </div>

                  {(resolvedNotificationCenter || hasPrimaryAction) && (
                    <div className="flex max-w-full flex-wrap items-center gap-1.5 self-start lg:self-center">
                      <BrokerSupportQuickAccess
                        tone="light"
                        brokerName={profile.fullName}
                        planName={subscription.planName}
                      />
                      {resolvedNotificationCenter}
                      {hasPrimaryAction && (
                        <Button
                          asChild
                          className="h-9 rounded-[var(--broker-radius-sm)] bg-[var(--broker-accent)] px-3.5 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(0,155,58,0.16)] transition-colors hover:bg-[#008633]"
                        >
                          {primaryActionOnClick ? (
                            <button type="button" onClick={primaryActionOnClick}>
                              <Plus className="size-4" />
                              {primaryActionLabel}
                            </button>
                          ) : (
                            <Link href={primaryActionHref}>
                              <Plus className="size-4" />
                              {primaryActionLabel}
                            </Link>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>
          ) : (
            <div className="shrink-0 px-3 pb-1.5 pt-2.5 md:hidden">
              <SidebarTrigger className="size-9 rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-white text-[var(--broker-muted)] shadow-[var(--broker-shadow-xs)] hover:bg-white hover:text-[var(--broker-ink)]" />
            </div>
          )}

          <div
            className={`flex min-h-0 flex-1 overflow-hidden ${
              isCosVariant ? "gap-0 px-0 py-0" : "gap-0 px-0 py-0 sm:gap-2.5 sm:px-3 sm:py-2.5 lg:px-4"
            }`}
          >
            <BrokerSidebar variant={isCosVariant ? "cos" : "default"} />

            <main
              className={
                isCosVariant
                  ? "min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-y-0 border-r border-l border-[var(--broker-border)] bg-transparent shadow-none"
                  : "min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent shadow-none md:rounded-[var(--broker-radius-lg)] md:border md:border-[var(--broker-border)] md:bg-white/82 md:shadow-[var(--broker-shadow-sm)]"
              }
            >
              <div
                className={`h-full max-w-full overflow-x-hidden ${
                  isCosVariant
                    ? "overflow-y-hidden px-0 py-0"
                    : "eme-subtle-scrollbar overflow-y-auto px-0 py-0 sm:px-3.5 sm:py-3.5 lg:px-4"
                } ${contentClassName ?? ""}`}
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
