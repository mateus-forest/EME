"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Bot,
  BookOpenText,
  Building2,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  UserRound,
  UsersRound,
} from "lucide-react"

import { useBrokerProfile } from "@/components/use-broker-profile"
import { clearLegacyAuthState } from "@/lib/auth-client"
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

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/corretor" },
  { label: "Meus imóveis", icon: Building2, href: "/corretor/imoveis" },
  { label: "Catálogo", icon: BookOpenText, href: "/corretor/catalogo" },
  { label: "Leads", icon: UsersRound, href: "/corretor/leads" },
  { label: "Assessor EME", icon: Bot, href: "/corretor/corretor-m" },
  { label: "Analytics", icon: BarChart3, href: "/corretor/analytics" },
  { label: "Plano", icon: CreditCard, href: "/corretor/plano" },
  { label: "Suporte", icon: LifeBuoy, href: "/corretor/suporte" },
  { label: "Conta", icon: UserRound, href: "/corretor/conta" },
]

export function BrokerSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { profile } = useBrokerProfile()
  const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar()
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

  const sidebarInner = (
    <div className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(10,10,10,0.92))] shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-3">
        <Link
          href="/"
          className={`flex min-w-0 items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] transition-all ${collapsed && !isMobile ? "h-10 w-10 justify-center px-0" : "h-10 flex-1 px-3"}`}
        >
          <Image
            src="/images/eme-logo.png"
            alt="EME"
            width={96}
            height={36}
            className={`${collapsed && !isMobile ? "h-5" : "h-7"} w-auto`}
            priority
          />
        </Link>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={`ml-2 rounded-xl border text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white ${collapsed && !isMobile ? "h-9 w-9 border-white/[0.08] bg-white/[0.04]" : "h-8 w-8 border-transparent bg-transparent"}`}
        >
          <ChevronLeft className={`size-[15px] transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} />
          <span className="sr-only">Recolher ou expandir menu</span>
        </Button>
      </div>

      <div className="flex-1 px-2.5 py-3">
        <SidebarMenu className="gap-1.5">
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={item.href !== "#" && pathname === item.href}
                tooltip={item.label}
                className={`h-10 rounded-xl border border-transparent text-[15px] text-white/70 hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white data-[active=true]:border-[#00C853]/20 data-[active=true]:bg-[#00C853]/14 data-[active=true]:text-white ${collapsed && !isMobile ? "px-0" : "px-3"}`}
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
      </div>

      <div className="mt-auto px-3 pb-3">
        <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2 ${collapsed && !isMobile ? "px-1.5" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed && !isMobile ? "justify-center" : ""}`}>
            <Avatar className={`${collapsed && !isMobile ? "size-7" : "size-10"} shrink-0 border border-white/10 transition-all`}>
              <AvatarImage src={profile.photoUrl} alt={profile.fullName} />
              <AvatarFallback className="bg-[#00C853]/15 font-semibold text-[#69F0AE]">
                {initials || "EM"}
              </AvatarFallback>
            </Avatar>

            {(!collapsed || isMobile) && (
              <div className="min-w-0 max-w-[8.25rem] flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">{profile.fullName || "Corretor"}</p>
              </div>
            )}

            {(!collapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="size-9 shrink-0 rounded-xl text-white/55 hover:bg-white/[0.08] hover:text-white"
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
          className="w-[18rem] border-white/[0.08] bg-[#0B0B0B] p-3 text-white [&>button]:hidden"
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
      className={`hidden shrink-0 grow-0 basis-auto overflow-hidden md:flex transition-[width] duration-200 ease-linear ${collapsed ? "w-[var(--sidebar-width-icon)] min-w-[var(--sidebar-width-icon)] max-w-[var(--sidebar-width-icon)]" : "w-[var(--sidebar-width)] min-w-[var(--sidebar-width)] max-w-[var(--sidebar-width)]"}`}
    >
      {sidebarInner}
    </aside>
  )
}
