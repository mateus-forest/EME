"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  Building2,
  CalendarDays,
  FileText,
  Home,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UsersRound,
} from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { NotificationCenter } from "@/components/notification-center"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type AgendaEventItem = {
  id: string
  title: string
  date: string
  time: string
  status: string
}

export function BrokerPortal() {
  const router = useRouter()
  const { properties } = useBrokerProperties()
  const { profile } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const {
    historyNotifications,
    unreadCount,
    markAsRead,
    archive,
  } = useBrokerPaymentNotifications()
  const [search, setSearch] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [analytics, setAnalytics] = useState<{ totalViews: number; whatsappClicks: number; leads: number } | null>(null)
  const [agendaEvents, setAgendaEvents] = useState<AgendaEventItem[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedSearch = search.trim().toLowerCase()
  const publishedPropertiesCount = useMemo(
    () => properties.filter((property) => property.status === "Publicado").length,
    [properties],
  )
  const hasReachedLimit =
    subscription.isProfileResolved &&
    !subscription.isUpgraded &&
    publishedPropertiesCount >= (subscription.propertyLimit ?? 3)

  const featuredProperties = useMemo(
    () =>
      properties
        .filter((property) => property.status === "Publicado")
        .filter((property) =>
          normalizedSearch
            ? [property.title, property.city, property.neighborhood].some((field) =>
                field.toLowerCase().includes(normalizedSearch),
              )
            : true,
        )
        .sort((first, second) => Number(second.views) - Number(first.views))
        .slice(0, 3),
    [properties, normalizedSearch],
  )

  const totalViews = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.views || 0), 0),
    [properties],
  )
  const totalLeads = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.leads || 0), 0),
    [properties],
  )

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/analytics", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { totalViews?: number; whatsappClicks?: number; leads?: number } | null
        if (!ignore && response.ok && data) {
          setAnalytics({
            totalViews: data.totalViews ?? 0,
            whatsappClicks: data.whatsappClicks ?? 0,
            leads: data.leads ?? 0,
          })
        }
      })
      .catch(() => null)

    fetch("/api/brokers/agenda?filter=all", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { events?: AgendaEventItem[] } | null
        if (!ignore && response.ok) setAgendaEvents(data?.events ?? [])
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const query = search.trim()
    if (!query) return

    const timeoutId = window.setTimeout(() => {
      fetch("/api/brokers/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          query,
          resultCount: featuredProperties.length,
          source: "dashboard",
        }),
      }).catch(() => null)
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [featuredProperties.length, search])

  const brokerFirstName = useMemo(() => {
    const [firstName] = profile.fullName.trim().split(" ").filter(Boolean)
    return firstName || "Corretor"
  }, [profile.fullName])

  const upcomingAppointmentsCount = useMemo(
    () => agendaEvents.filter((event) => event.status !== "cancelled").length,
    [agendaEvents],
  )

  const stats = useMemo(
    () => [
      {
        title: "Imóveis ativos",
        value: String(publishedPropertiesCount),
        change: publishedPropertiesCount > 0 ? "Publicados no catálogo" : "Nenhum imóvel publicado",
      },
      {
        title: "Visualizações",
        value: (analytics?.totalViews ?? totalViews).toLocaleString("pt-BR"),
        change: (analytics?.totalViews ?? totalViews) > 0 ? "No catálogo" : "Aguardando tráfego",
      },
      {
        title: "Leads",
        value: (analytics?.leads ?? totalLeads).toLocaleString("pt-BR"),
        change: (analytics?.leads ?? totalLeads) > 0 ? "Recebidos" : "Nenhum lead ainda",
      },
      {
        title: "Próximos compromissos",
        value: String(upcomingAppointmentsCount),
        change: upcomingAppointmentsCount > 0 ? "Na agenda" : "Agenda livre",
      },
    ],
    [analytics, publishedPropertiesCount, totalLeads, totalViews, upcomingAppointmentsCount],
  )

  const quickActions = [
    {
      label: "Novo imóvel",
      icon: Building2,
      href: "/corretor/novo-imovel",
      onClick: hasReachedLimit ? () => setIsLimitModalOpen(true) : undefined,
    },
    {
      label: "Buscar imóvel",
      icon: Search,
      onClick: () => searchInputRef.current?.focus(),
    },
    {
      label: "Criar proposta",
      icon: FileText,
      href: "/corretor/documentos",
    },
    {
      label: "Agendar visita",
      icon: CalendarDays,
      href: "/corretor/agenda",
    },
  ]

  return (
    <>
      <BrokerPageShell
        title="COS"
        contentClassName="lg:overflow-y-hidden"
        notificationCenter={
          <NotificationCenter
            title="Notificações do corretor"
            notifications={historyNotifications}
            unreadCount={unreadCount}
            onMarkAsRead={markAsRead}
            onArchive={archive}
            tone="light"
          />
        }
      >
        <section className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-1 py-4 sm:px-3 lg:h-full lg:justify-between lg:py-2">
          <div className="mx-auto w-full max-w-4xl text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-[#009b3a]/15 bg-white text-[#009b3a] shadow-[0_12px_32px_rgba(0,155,58,0.08)]">
              <Sparkles className="size-5" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#050505] sm:text-5xl">
              Olá, {brokerFirstName}.
            </h2>
            <p className="mt-3 text-lg text-[#667085] sm:text-xl">O que deseja fazer hoje?</p>
          </div>

          <div className="mx-auto mt-6 flex w-full max-w-4xl flex-wrap justify-center gap-2.5">
            {quickActions.map((action) => {
              const Icon = action.icon
              const className =
                "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-black/[0.07] bg-white px-4 text-sm font-medium text-[#344054] shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition-colors hover:border-[#009b3a]/25 hover:bg-[#f8fbf7] hover:text-[#050505]"

              if (action.onClick) {
                return (
                  <button key={action.label} type="button" onClick={action.onClick} className={className}>
                    <Icon className="size-4 text-[#009b3a]" />
                    {action.label}
                  </button>
                )
              }

              return (
                <Link key={action.label} href={action.href ?? "#"} className={className}>
                  <Icon className="size-4 text-[#009b3a]" />
                  {action.label}
                </Link>
              )
            })}
          </div>

          <div className="mx-auto mt-7 w-full max-w-4xl">
            <form
              onSubmit={(event) => event.preventDefault()}
              className="overflow-hidden rounded-[2rem] border border-black/[0.06] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
            >
              <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5">
                <div className="hidden size-11 shrink-0 items-center justify-center rounded-2xl bg-[#009b3a]/10 text-[#009b3a] sm:flex">
                  <MessageCircle className="size-5" />
                </div>
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Converse com o COS..."
                  className="h-14 flex-1 border-0 bg-transparent px-0 text-base text-[#050505] shadow-none outline-none placeholder:text-[#98A2B3] focus-visible:ring-0 sm:text-lg"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-12 shrink-0 rounded-full bg-[#009b3a] text-white shadow-[0_16px_34px_rgba(0,155,58,0.22)] hover:bg-[#008633]"
                  aria-label="Enviar mensagem ao COS"
                >
                  <Send className="size-5" />
                </Button>
              </div>
            </form>
          </div>

          <div className="mx-auto mt-8 w-full max-w-5xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Resumo do dia</p>
                <h3 className="mt-2 text-xl font-semibold text-[#050505]">Contexto para o COS</h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/corretor/analytics")}
                className="h-10 self-start rounded-full border border-black/[0.06] bg-white px-4 text-sm text-[#5F6B7A] shadow-[0_10px_28px_rgba(15,23,42,0.04)] hover:bg-white hover:text-[#050505] sm:self-auto"
              >
                Ver desempenho
                <ArrowRight className="size-4" />
              </Button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.title} className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_12px_34px_rgba(15,23,42,0.04)]">
                  <p className="text-sm text-[#667085]">{stat.title}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-[#050505]">{stat.value}</p>
                  <p className="mt-1 text-xs text-[#009b3a]">{stat.change}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-6 grid w-full max-w-5xl gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-[1.75rem] border border-black/[0.06] bg-white px-5 py-5 shadow-[0_12px_34px_rgba(15,23,42,0.04)] lg:min-h-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#050505]">Imóveis em foco</h3>
                  <p className="mt-1 text-sm text-[#667085]">
                    {normalizedSearch ? "Resultados filtrados pelo campo do COS." : "Mais relevantes para começar a operação."}
                  </p>
                </div>
                <Link href="/corretor/imoveis" className="text-sm font-medium text-[#009b3a] hover:text-[#008633]">
                  Ver todos
                </Link>
              </div>

              <div className="mt-4 grid gap-3">
                {featuredProperties.length > 0 ? (
                  featuredProperties.map((property) => (
                    <Link
                      key={property.id}
                      href="/corretor/imoveis"
                      className="group flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-black/[0.05] bg-[#fbfbf8] px-4 py-3 transition-colors hover:bg-white"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#009b3a]">
                          <Home className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#050505]">{property.title}</p>
                          <p className="mt-1 truncate text-xs text-[#667085]">{property.location}</p>
                        </div>
                      </div>
                      <p className="hidden shrink-0 text-sm font-medium text-[#344054] sm:block">{property.price}</p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-black/[0.05] bg-[#fbfbf8] px-4 py-6 text-sm text-[#667085]">
                    Nenhum imóvel encontrado.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-black/[0.06] bg-white px-5 py-5 shadow-[0_12px_34px_rgba(15,23,42,0.04)] lg:min-h-0">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#009b3a]/10 text-[#009b3a]">
                  <UsersRound className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#050505]">Próxima leitura</h3>
                  <p className="mt-1 text-sm text-[#667085]">O COS acompanha sua operação sem roubar a tela.</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#667085]">
                <p className="rounded-2xl bg-[#fbfbf8] px-4 py-3">
                  {analytics?.whatsappClicks
                    ? `${analytics.whatsappClicks} cliques no WhatsApp registrados.`
                    : "Os cliques no WhatsApp aparecerão conforme o catálogo ganhar tráfego."}
                </p>
                <p className="rounded-2xl bg-[#fbfbf8] px-4 py-3">
                  {upcomingAppointmentsCount > 0
                    ? `${upcomingAppointmentsCount} compromisso(s) aguardando acompanhamento.`
                    : "Sem compromissos pendentes na agenda."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
    </>
  )
}
