"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Calculator,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react"

import { clearAdminMockStorage } from "@/components/use-admin-data"
import { useAdminProfile } from "@/components/use-admin-profile"
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
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "Usuarios", icon: Users, href: "/admin/usuarios" },
  { label: "Corretores", icon: UserRound, href: "/admin/corretores" },
  { label: "Assessor EME", icon: Bot, href: "/admin/assessor-eme" },
  { label: "Corretor EME", icon: MessageCircle, href: "/admin/corretor-eme" },
  { label: "Consumo IA", icon: Sparkles, href: "/admin/consumo-ia" },
  { label: "Custos", icon: Calculator, href: "/admin/custos" },
  { label: "Assinaturas", icon: CreditCard, href: "/admin/assinaturas" },
  { label: "Receita", icon: BarChart3, href: "/admin/receita" },
  { label: "Analytics", icon: BarChart3, href: "/admin/analytics" },
  { label: "Alertas", icon: AlertTriangle, href: "/admin/alertas" },
  { label: "Conta", icon: ShieldCheck, href: "/admin/conta" },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar()
  const { profile } = useAdminProfile()
  const collapsed = state === "collapsed"

  async function handleLogout() {
    clearAdminMockStorage()
    clearLegacyAuthState()
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null)
    router.push("/login")
  }

  const initials =
    profile.name
      .split(" ")
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "AE"

  const sidebarInner = (
    <div className="flex h-full min-w-0 max-w-full flex-col overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[#f9fbf9] shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-3 py-3">
        <Link
          href="/"
          className={`flex min-w-0 items-center rounded-2xl border border-black/[0.06] bg-white transition-all ${collapsed && !isMobile ? "h-10 w-10 justify-center px-0" : "h-10 flex-1 px-3"}`}
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
          className={`ml-2 rounded-xl border text-[#7B8491] transition-colors hover:bg-white hover:text-[#050505] ${collapsed && !isMobile ? "h-9 w-9 border-black/[0.06] bg-white" : "h-8 w-8 border-transparent bg-transparent"}`}
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
                className={`h-10 rounded-xl border border-transparent text-[15px] text-[#5F6B7A] hover:border-black/[0.06] hover:bg-white hover:text-[#050505] data-[active=true]:border-[#009b3a]/18 data-[active=true]:bg-[#eef9f1] data-[active=true]:text-[#050505] ${collapsed && !isMobile ? "px-0" : "px-3"}`}
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
        <div className={`rounded-2xl border border-black/[0.06] bg-white p-2 ${collapsed && !isMobile ? "px-1.5" : ""}`}>
          <div className={`flex items-center gap-3 ${collapsed && !isMobile ? "justify-center" : ""}`}>
            <Avatar className={`${collapsed && !isMobile ? "size-7" : "size-10"} shrink-0 border border-black/[0.06] transition-all`}>
              <AvatarImage src="/placeholder-user.jpg" alt={profile.name} />
              <AvatarFallback className="bg-[#eef9f1] font-semibold text-[#009b3a]">
                {initials}
              </AvatarFallback>
            </Avatar>

            {(!collapsed || isMobile) && (
              <div className="min-w-0 max-w-[8.25rem] flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-[#050505]">{profile.name || "Admin"}</p>
              </div>
            )}

            {(!collapsed || isMobile) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="size-9 shrink-0 rounded-xl text-[#7B8491] hover:bg-[#f5f7f5] hover:text-[#050505]"
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
          className="w-[18rem] border-black/[0.06] bg-[#f6f8f6] p-3 text-[#050505] [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Admin EME</SheetTitle>
            <SheetDescription>Navegacao lateral do portal administrativo da EME.</SheetDescription>
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
