"use client"

import { useMemo } from "react"
import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { NotificationCenter } from "@/components/notification-center"
import { AgencySidebar } from "@/components/agency-sidebar"
import { useAgencyPaymentNotifications } from "@/components/use-agency-payment-notifications"
import { useAgencyProfile } from "@/components/use-agency-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

type AgencyPageShellProps = {
  title: string
  subtitle?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  primaryActionLabel?: string
  primaryActionHref?: string
  primaryActionOnClick?: () => void
  headerControls?: ReactNode
  notificationCenter?: ReactNode
  children: ReactNode
}

export function AgencyPageShell({
  title,
  subtitle,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  primaryActionLabel,
  primaryActionHref = "#",
  primaryActionOnClick,
  headerControls,
  notificationCenter,
  children,
}: AgencyPageShellProps) {
  const hasSearchArea = searchPlaceholder || headerControls
  const hasPrimaryAction = Boolean(primaryActionLabel)
  const { profile } = useAgencyProfile()
  const { historyNotifications, unreadCount, markAsRead, archive } = useAgencyPaymentNotifications()
  const resolvedNotificationCenter = useMemo(
    () =>
      notificationCenter ?? (
        <NotificationCenter
          title="Notificações da imobiliária"
          notifications={historyNotifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onArchive={archive}
        />
      ),
    [archive, historyNotifications, markAsRead, notificationCenter, unreadCount],
  )

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "4.5rem",
        } as CSSProperties
      }
    >
      <div className="relative min-h-screen overflow-hidden bg-[#0f1111] text-white sm:bg-[#0B0B0B]">
        <div className="pointer-events-none absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_top_left,rgba(0,200,83,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(0,230,118,0.08),transparent_30%)]" />

        <div className="relative z-0 flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-[#0f1111]/94 backdrop-blur-2xl sm:border-white/[0.08] sm:bg-[linear-gradient(180deg,rgba(15,15,15,0.94),rgba(11,11,11,0.9))]">
            <div className="px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger className="h-8.5 w-8.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white md:hidden" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                        Portal da imobiliária
                      </p>
                      <h1 className="text-xl font-semibold leading-none text-white">{title}</h1>
                      {profile.companyName ? (
                        <p className="mt-1 max-w-[16rem] truncate text-sm text-white/50 sm:max-w-[22rem]">
                          {profile.companyName}
                        </p>
                      ) : null}
                      {subtitle && <p className="mt-1 text-sm text-white/50">{subtitle}</p>}
                    </div>
                  </div>

                  {hasSearchArea && (
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      {searchPlaceholder && (
                        <div className="relative w-full max-w-[18rem] lg:max-w-[19rem] xl:max-w-[20rem]">
                          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-white/35" />
                          <Input
                            value={searchValue}
                            onChange={(event) => onSearchChange?.(event.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-8.5 rounded-xl border-white/[0.08] bg-white/[0.04] pl-10 text-white placeholder:text-white/35 focus-visible:ring-[#00C853]/35"
                          />
                        </div>
                      )}

                      {headerControls}
                    </div>
                  )}
                </div>

                {(resolvedNotificationCenter || hasPrimaryAction) && (
                  <div className="flex items-center gap-2 self-start xl:self-center">
                    {resolvedNotificationCenter}
                    {hasPrimaryAction &&
                      (primaryActionOnClick ? (
                        <Button
                          type="button"
                          onClick={primaryActionOnClick}
                          className="h-8.5 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                        >
                          <Plus className="size-4" />
                          {primaryActionLabel}
                        </Button>
                      ) : (
                        <Button
                          asChild
                          className="h-8.5 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                        >
                          <Link href={primaryActionHref}>
                            <Plus className="size-4" />
                            {primaryActionLabel}
                          </Link>
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 gap-0 px-0 py-0 sm:gap-5 sm:px-6 sm:py-6 lg:gap-6 lg:px-7 lg:py-7">
            <AgencySidebar />

            <main className="min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent shadow-none sm:rounded-[1.75rem] sm:border sm:border-white/[0.08] sm:bg-[linear-gradient(180deg,rgba(15,15,15,0.88),rgba(11,11,11,0.78))] sm:shadow-[0_22px_50px_rgba(0,0,0,0.16)]">
              <div className="h-full overflow-y-auto px-4 py-4 sm:px-7 sm:py-7 lg:px-10 lg:py-8">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
