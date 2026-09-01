"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  BookOpenText,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  LogOut,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { useBrokerProfile } from "@/components/use-broker-profile"
import { BrokerSidebarConversations } from "@/components/broker-sidebar-conversations"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { clearLegacyAuthState } from "@/lib/auth-client"

type MenuItem = {
  label: string
  icon: LucideIcon
  href: string
}

const menuSections: Array<{ label: string; items: MenuItem[] }> = [
  {
    label: "COS",
    items: [{ label: "COS", icon: LayoutDashboard, href: "/corretor" }],
  },
  {
    label: "CARTEIRA",
    items: [
      { label: "Clientes", icon: UserRound, href: "/corretor/clientes" },
      { label: "Imóveis", icon: Building2, href: "/corretor/imoveis" },
    ],
  },
  {
    label: "VENDER",
    items: [
      { label: "Marketplace", icon: Store, href: "/corretor/marketplace" },
      { label: "Catálogo", icon: BookOpenText, href: "/corretor/catalogo" },
      { label: "Studio IA", icon: Bot, href: "/corretor/studio-ia" },
    ],
  },
  {
    label: "DOCUMENTOS",
    items: [
      { label: "Propostas", icon: FileSignature, href: "/corretor/documentos" },
      { label: "Contratos", icon: FileSignature, href: "/corretor/documentos/contratos" },
    ],
  },
  {
    label: "OPERAÇÃO",
    items: [
      { label: "Compromissos", icon: CalendarDays, href: "/corretor/agenda" },
      { label: "Financeiro", icon: CircleDollarSign, href: "/corretor/financeiro" },
      { label: "Desempenho", icon: BarChart3, href: "/corretor/analytics" },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { label: "Plano", icon: CreditCard, href: "/corretor/plano" },
      { label: "Conta", icon: UserRound, href: "/corretor/conta" },
    ],
  },
]

function buildOpenSections(pathname: string) {
  const activeHref = resolveActiveMenuHref(pathname)

  return Object.fromEntries(
    menuSections.map((section) => [
      section.label,
      section.items.some((item) => item.href === activeHref),
    ]),
  )
}

function resolveActiveMenuHref(pathname: string) {
  return (
    menuSections
      .flatMap((section) => section.items)
      .filter((item) =>
        item.href === "/corretor"
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null
  )
}

export function BrokerSidebar({ variant = "default" }: { variant?: "default" | "cos" }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useBrokerProfile()
  const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => buildOpenSections(pathname))
  const collapsed = state === "collapsed"
  const activeHref = resolveActiveMenuHref(pathname)
  const initials = profile.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  async function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("eme-broker-profile")
      window.localStorage.removeItem("eme-broker-properties")
    }
    clearLegacyAuthState()
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null)

    if (isMobile) {
      setOpenMobile(false)
    }

    router.push("/login")
  }

  function toggleSection(label: string) {
    setOpenSections((current) => {
      const nextValue = !current[label]

      return Object.fromEntries(
        menuSections.map((section) => [section.label, section.label === label ? nextValue : false]),
      )
    })
  }

  useEffect(() => {
    setOpenSections(buildOpenSections(pathname))
  }, [pathname])

  const sidebarInner = (
    <div
      className={`flex h-full min-w-0 max-w-full flex-col overflow-hidden border border-[var(--broker-border)] bg-[var(--broker-surface)] shadow-[var(--broker-shadow-sm)] backdrop-blur-xl ${
        variant === "cos"
          ? "rounded-[var(--broker-radius-lg)] md:rounded-l-none md:rounded-r-[var(--broker-radius-lg)]"
          : "rounded-[var(--broker-radius-lg)]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--broker-border)] px-2.5 py-2.5">
        <Link
          href="/"
          className={`flex min-w-0 items-center rounded-[var(--broker-radius-sm)] bg-transparent transition-colors hover:bg-[var(--broker-surface-inset)] ${collapsed && !isMobile ? "size-9 justify-center px-0" : "h-9 flex-1 px-2"}`}
        >
          <Image
            src="/images/eme-logo-official.png"
            alt="EME"
            width={96}
            height={36}
            className={`${collapsed && !isMobile ? "size-6" : "size-7"} object-contain`}
            priority
          />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`ml-1.5 rounded-[var(--broker-radius-sm)] text-[var(--broker-muted)] transition-colors hover:bg-[var(--broker-surface-inset)] hover:text-[var(--broker-ink)] ${collapsed && !isMobile ? "size-9 bg-transparent" : "size-8 bg-transparent"}`}
        >
          <ChevronLeft className={`size-[15px] transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          <span className="sr-only">Recolher ou expandir menu</span>
        </Button>
      </div>

      <div className="eme-subtle-scrollbar flex-1 overflow-y-auto px-2 py-2.5">
        <div className="grid gap-1.5">
          {menuSections.map((section) => {
            const sectionOpen = collapsed && !isMobile ? true : openSections[section.label]

            return (
              <div key={section.label} className="grid gap-0.5">
                {(!collapsed || isMobile) && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="flex h-5.5 items-center justify-between rounded-lg px-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--broker-muted-soft)] transition-colors hover:bg-[var(--broker-surface-inset)] hover:text-[var(--broker-ink)]"
                    aria-expanded={sectionOpen}
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={`size-3.5 transition-transform ${sectionOpen ? "rotate-180" : ""}`} />
                  </button>
                )}

                {sectionOpen && (
                  <SidebarMenu className="gap-0.5">
                    {section.items.map((item) => (
                      <SidebarMenuItem key={`${section.label}-${item.label}`}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.href !== "#" && item.href === activeHref}
                          tooltip={item.label}
                          className={`h-9 rounded-[var(--broker-radius-sm)] border border-transparent text-[13px] font-medium text-[var(--broker-muted)] hover:bg-[var(--broker-surface-inset)] hover:text-[var(--broker-ink)] data-[active=true]:border-[var(--broker-accent-border)] data-[active=true]:bg-[var(--broker-accent-soft)] data-[active=true]:text-[var(--broker-accent-strong)] ${collapsed && !isMobile ? "px-0" : "px-2.5"}`}
                        >
                          <Link
                            href={item.href}
                            aria-current={item.href === activeHref ? "page" : undefined}
                            className={`flex w-full items-center ${collapsed && !isMobile ? "justify-center gap-0" : "gap-2.5"}`}
                          >
                            <item.icon className="size-4 shrink-0" />
                            <span className={collapsed && !isMobile ? "hidden" : "min-w-0 truncate"}>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                )}
              </div>
            )
          })}
        </div>
        <BrokerSidebarConversations
          collapsed={collapsed}
          isMobile={isMobile}
          onCollapsedClick={toggleSidebar}
          onNavigate={() => {
            if (isMobile) setOpenMobile(false)
          }}
        />
      </div>

      <div className="mt-auto px-2.5 pb-2.5">
        <div className={`rounded-[var(--broker-radius-sm)] border border-[var(--broker-border)] bg-[var(--broker-surface-subtle)] p-1.5 ${collapsed && !isMobile ? "px-1" : ""}`}>
          <div className={`flex items-center gap-2.5 ${collapsed && !isMobile ? "justify-center" : ""}`}>
            <Avatar className={`${collapsed && !isMobile ? "size-7" : "size-9"} shrink-0 border border-[var(--broker-border-strong)] transition-all`}>
              <AvatarImage src={profile.photoUrl} alt={profile.fullName} />
              <AvatarFallback className="bg-[#009b3a]/10 font-semibold text-[#009b3a]">
                {initials || "EM"}
              </AvatarFallback>
            </Avatar>

            {(!collapsed || isMobile) && (
              <div className="min-w-0 max-w-[8.25rem] flex-1 overflow-hidden">
                <p className="truncate text-[13px] font-semibold text-[var(--broker-ink)]">{profile.fullName || "Corretor"}</p>
              </div>
            )}

            {(!collapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="size-8 shrink-0 rounded-[var(--broker-radius-sm)] text-[var(--broker-muted)] hover:bg-white hover:text-[var(--broker-ink)]"
              >
                <LogOut className="size-4" />
                <span className="sr-only">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="broker-portal-scope w-[17rem] border-[var(--broker-border)] bg-[var(--broker-canvas)] px-2.5 pb-[max(env(safe-area-inset-bottom,0px),0.625rem)] pt-[max(env(safe-area-inset-top,0px),0.625rem)] text-[var(--broker-ink)] [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Portal do corretor</SheetTitle>
            <SheetDescription>Navegação lateral do portal do corretor.</SheetDescription>
          </SheetHeader>
          {sidebarInner}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      className={`hidden shrink-0 grow-0 basis-auto overflow-hidden transition-[width] duration-200 ease-linear md:flex ${collapsed ? "w-[var(--sidebar-width-icon)] min-w-[var(--sidebar-width-icon)] max-w-[var(--sidebar-width-icon)]" : "w-[var(--sidebar-width)] min-w-[var(--sidebar-width)] max-w-[var(--sidebar-width)]"}`}
    >
      {sidebarInner}
    </aside>
  )
}
