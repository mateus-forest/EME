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
          "--sidebar-width": isCosVariant ? "17rem" : "15rem",
          "--sidebar-width-icon": "4.5rem",
        } as CSSProperties
      }
    >
      <div className={`pwa-safe-shell relative w-full overflow-hidden text-[#050505] ${isCosVariant ? "h-full min-h-0 bg-[#f4f1eb]" : "min-h-svh bg-[#f6f2eb] sm:bg-[#fbfbf8]"}`}>
        {!isCosVariant ? (
          <div className="pointer-events-none absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_top_left,rgba(0,200,83,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,230,118,0.08),transparent_30%)]" />
        ) : null}

        <div className={`relative z-0 flex w-full flex-col ${isCosVariant ? "h-full min-h-0" : "min-h-svh"}`}>
          {!isCosVariant ? (
            <header className="sticky top-0 z-20 border-b border-transparent bg-[#f6f2eb]/96 backdrop-blur-2xl sm:border-black/[0.06] sm:bg-white/86">
              <div className="px-4 py-3 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
                  <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                    <div className="flex items-center gap-3">
                      <SidebarTrigger className="h-8.5 w-8.5 rounded-xl border border-black/[0.06] bg-white/80 text-[#5F6B7A] hover:bg-white hover:text-[#050505] md:hidden" />
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-[0.24em] text-[#7B8491]">
                            Portal do corretor
                          </p>
                          <h1 className="text-xl font-semibold leading-none text-[#050505]">{title}</h1>
                          {profile.fullName ? (
                            <p className="mt-1 max-w-[16rem] truncate text-sm text-[#6B7280] sm:max-w-[22rem]">
                              {profile.fullName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {hasSearchArea && (
                      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        {searchPlaceholder && (
                          <div className="relative w-full max-w-[18rem] lg:max-w-[19rem] xl:max-w-[20rem]">
                            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#8B95A1]" />
                            <Input
                              placeholder={searchPlaceholder}
                              value={searchValue}
                              onChange={(event) => onSearchChange?.(event.target.value)}
                              className="h-8.5 rounded-xl border-black/[0.06] bg-white/80 pl-10 text-[#050505] placeholder:text-[#8B95A1] focus-visible:ring-[#009b3a]/35"
                            />
                          </div>
                        )}

                        {headerControls ? <div className="shrink-0">{headerControls}</div> : null}
                      </div>
                    )}
                  </div>

                  {(resolvedNotificationCenter || hasPrimaryAction) && (
                    <div className="flex max-w-full flex-wrap items-center gap-2 self-start xl:self-center">
                      <BrokerSupportQuickAccess
                        tone="light"
                        brokerName={profile.fullName}
                        planName={subscription.planName}
                      />
                      {resolvedNotificationCenter}
                      {hasPrimaryAction && (
                        <Button
                          asChild
                          className="h-8.5 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
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
            <div className="shrink-0 px-3 pt-3 pb-2 md:hidden">
              <SidebarTrigger className="h-9 w-9 rounded-xl border border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-white hover:text-[#050505]" />
            </div>
          )}

          <div className={`flex min-h-0 flex-1 overflow-hidden ${isCosVariant ? "gap-0 px-0 py-0" : "gap-0 px-0 py-0 sm:gap-3 sm:px-4 sm:py-3 lg:px-5"}`}>
            <BrokerSidebar variant={isCosVariant ? "cos" : "default"} />

            <main
              className={
                isCosVariant
                  ? "min-h-0 min-w-0 flex-1 overflow-hidden rounded-none border-y-0 border-r border-l border-black/[0.06] bg-transparent shadow-none"
                  : "min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent shadow-none md:rounded-[1.75rem] md:border md:border-black/[0.06] md:bg-white/86 md:shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
              }
            >
              <div
                className={`h-full max-w-full overflow-x-hidden ${isCosVariant ? "overflow-y-hidden px-0 py-0" : "overflow-y-auto px-0 py-0 sm:px-6 sm:py-5 lg:px-8"} ${contentClassName ?? ""}`}
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
