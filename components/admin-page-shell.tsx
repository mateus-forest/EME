"use client"

import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"
import { Plus, Search } from "lucide-react"

import { AdminSidebar } from "@/components/admin-sidebar"
import { useAdminProfile } from "@/components/use-admin-profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

type AdminPageShellProps = {
  title: string
  subtitle?: string
  searchPlaceholder?: string
  primaryActionLabel?: string
  primaryActionHref?: string
  primaryActionOnClick?: () => void
  headerControls?: ReactNode
  children: ReactNode
}

export function AdminPageShell({
  title,
  subtitle,
  searchPlaceholder,
  primaryActionLabel,
  primaryActionHref = "#",
  primaryActionOnClick,
  headerControls,
  children,
}: AdminPageShellProps) {
  const hasSearchArea = searchPlaceholder || headerControls
  const hasPrimaryAction = Boolean(primaryActionLabel)
  const { profile } = useAdminProfile()

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
      <div className="pwa-safe-shell relative min-h-screen overflow-hidden bg-[#f3f0ea] text-[#050505] sm:bg-[#f6f8f6]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,155,58,0.10),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_30%)]" />

        <div className="relative z-0 flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 border-b border-black/[0.05] bg-[#f3f0ea]/94 backdrop-blur-2xl sm:border-black/[0.06] sm:bg-white/88">
            <div className="px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
                <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger className="h-8.5 w-8.5 rounded-xl border border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-white hover:text-[#050505] md:hidden" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#8B95A1]">
                        Admin EME
                      </p>
                      <h1 className="text-xl font-semibold leading-none text-[#050505]">{title}</h1>
                      {profile.name ? (
                        <p className="mt-1 max-w-[16rem] truncate text-sm text-[#6B7280] sm:max-w-[22rem]">
                          {profile.name}
                        </p>
                      ) : null}
                      {subtitle ? <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p> : null}
                    </div>
                  </div>

                  {hasSearchArea ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                      {searchPlaceholder ? (
                        <div className="relative w-full max-w-[18rem] lg:max-w-[19rem] xl:max-w-[20rem]">
                          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#98A2B3]" />
                          <Input
                            placeholder={searchPlaceholder}
                            className="h-8.5 rounded-xl border-black/[0.06] bg-white pl-10 text-[#050505] placeholder:text-[#98A2B3] focus-visible:ring-[#009b3a]/20"
                          />
                        </div>
                      ) : null}

                      {headerControls}
                    </div>
                  ) : null}
                </div>

                {hasPrimaryAction ? (
                  primaryActionOnClick ? (
                    <Button
                      type="button"
                      onClick={primaryActionOnClick}
                      className="h-8.5 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/18 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/28"
                    >
                      <Plus className="size-4" />
                      {primaryActionLabel}
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="h-8.5 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/18 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/28"
                    >
                      <Link href={primaryActionHref}>
                        <Plus className="size-4" />
                        {primaryActionLabel}
                      </Link>
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 gap-0 px-0 py-0 sm:gap-3 sm:px-4 sm:py-3 lg:px-5">
            <AdminSidebar />

            <main className="min-w-0 flex-1 overflow-hidden rounded-none border-0 bg-transparent shadow-none sm:rounded-[1.75rem] sm:border sm:border-black/[0.06] sm:bg-white/92 sm:shadow-[0_22px_50px_rgba(15,23,42,0.08)]">
              <div className="h-full max-w-full overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
