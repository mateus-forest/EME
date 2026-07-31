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
  CreditCard,
  FileSignature,
  History,
  LayoutDashboard,
  LogOut,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import { useBrokerProfile } from "@/components/use-broker-profile"
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
      { label: "Desempenho", icon: BarChart3, href: "/corretor/analytics" },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { label: "Plano", icon: CreditCard, href: "/corretor/plano" },
      { label: "Conta", icon: UserRound, href: "/corretor/conta" },
      { label: "Histórico", icon: History, href: "/corretor/historico" },
    ],
  },
]

function buildOpenSections(pathname: string) {
  return Object.fromEntries(
    menuSections.map((section) => [
      section.label,
      section.items.some((item) => item.href === pathname),
    ]),
  )
}

export function BrokerSidebar({ variant: _variant = "default" }: { variant?: "default" | "cos" }) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useBrokerProfile()
  const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => buildOpenSections(pathname))
  const collapsed = state === "collapsed"
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
    <div className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-[1.25rem] border border-black/[0.05] bg-white/92 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-black/[0.05] px-3 py-3">
        <Link
          href="/"
          className={`flex min-w-0 items-center rounded-xl bg-transparent transition-colors hover:bg-[#f7f8f5] ${collapsed && !isMobile ? "h-10 w-10 justify-center px-0" : "h-10 flex-1 px-2.5"}`}
        >
          <Image
            src="/images/eme-logo-official.png"
            alt="EME"
            width={96}
            height={36}
            className={`${collapsed && !isMobile ? "h-7 w-7" : "h-8 w-8"} object-contain`}
            priority
          />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`ml-2 rounded-xl text-[#5F6B7A] transition-colors hover:bg-[#f7f8f5] hover:text-[#050505] ${collapsed && !isMobile ? "h-9 w-9 bg-transparent" : "h-8 w-8 bg-transparent"}`}
        >
          <ChevronLeft className={`size-[15px] transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          <span className="sr-only">Recolher ou expandir menu</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="grid gap-2.5">
          {menuSections.map((section) => {
            const sectionOpen = collapsed && !isMobile ? true : openSections[section.label]

            return (
              <div key={section.label} className="grid gap-1">
                {(!collapsed || isMobile) && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="flex h-6 items-center justify-between rounded-lg px-3 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8B95A1] transition-colors hover:bg-[#f7f8f5] hover:text-[#050505]"
                    aria-expanded={sectionOpen}
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={`size-3.5 transition-transform ${sectionOpen ? "rotate-180" : ""}`} />
                  </button>
                )}

                {sectionOpen && (
                  <SidebarMenu className="gap-1">
                    {section.items.map((item) => (
                      <SidebarMenuItem key={`${section.label}-${item.label}`}>
                        <SidebarMenuButton
                          asChild
                          isActive={item.href !== "#" && pathname === item.href}
                          tooltip={item.label}
                          className={`h-10 rounded-xl border border-transparent text-[15px] font-medium text-[#5F6B7A] hover:bg-[#f7f8f5] hover:text-[#050505] data-[active=true]:border-[#009b3a]/12 data-[active=true]:bg-[#f2fbf5] data-[active=true]:text-[#050505] ${collapsed && !isMobile ? "px-0" : "px-3"}`}
                        >
                          <Link
                            href={item.href}
                            className={`flex w-full items-center ${collapsed && !isMobile ? "justify-center gap-0" : "gap-3"}`}
                          >
                            <item.icon className="size-[18px] shrink-0" />
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
      </div>

      <div className="mt-auto px-3 pb-3">
        <div className={`rounded-xl border border-black/[0.05] bg-[#fcfcfa] p-2 ${collapsed && !isMobile ? "px-1.5" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed && !isMobile ? "justify-center" : ""}`}>
            <Avatar className={`${collapsed && !isMobile ? "size-7" : "size-10"} shrink-0 border border-black/[0.08] transition-all`}>
              <AvatarImage src={profile.photoUrl} alt={profile.fullName} />
              <AvatarFallback className="bg-[#009b3a]/10 font-semibold text-[#009b3a]">
                {initials || "EM"}
              </AvatarFallback>
            </Avatar>

            {(!collapsed || isMobile) && (
              <div className="min-w-0 max-w-[8.25rem] flex-1 overflow-hidden">
                <p className="truncate text-sm font-semibold text-[#050505]">{profile.fullName || "Corretor"}</p>
              </div>
            )}

            {(!collapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="size-9 shrink-0 rounded-xl text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
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
          className="w-[18rem] border-black/[0.06] bg-[#fbfbf8] p-3 text-[#050505] [&>button]:hidden"
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
