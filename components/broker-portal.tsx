"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  MessageCircle,
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
  const { properties } = useBrokerProperties()
  const { profile } = useBrokerProfile()
  const { subscription } = useBrokerSubscription()
  const {
    historyNotifications,
    unreadCount,
    markAsRead,
    archive,
    financialSummary,
  } = useBrokerPaymentNotifications()
  const [search, setSearch] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
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

  const totalLeads = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.leads || 0), 0),
    [properties],
  )

  useEffect(() => {
    let ignore = false

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

  const contextMetrics = useMemo(
    () => [
      { label: "Clientes", value: totalLeads.toLocaleString("pt-BR") },
      { label: "OperaÃ§Ãµes", value: String(upcomingAppointmentsCount) },
      { label: "BalanÃ§o", value: financialSummary.currentAmount.replace("R$", "").trim() || "0,00" },
      { label: "ImÃ³veis", value: String(publishedPropertiesCount) },
    ],
    [financialSummary.currentAmount, publishedPropertiesCount, totalLeads, upcomingAppointmentsCount],
  )

  const contextFeed = useMemo(() => historyNotifications.slice(0, 5), [historyNotifications])

  const quickActions = [
    {
      label: "PrÃ³ximo passo",
      icon: Sparkles,
      href: "/corretor/corretor-eme",
    },
    {
      label: "Studio IA",
      icon: Bot,
      href: "/corretor/studio-ia",
    },
    {
      label: "Novo imÃ³vel",
      icon: Building2,
      href: "/corretor/novo-imovel",
      onClick: hasReachedLimit ? () => setIsLimitModalOpen(true) : undefined,
    },
    {
      label: "Compromissos",
      icon: CalendarDays,
      href: "/corretor/agenda",
    },
  ]

  return (
    <>
      <BrokerPageShell title="COS" variant="cos" contentClassName="overflow-hidden">
        <section className="grid min-h-full w-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="flex min-h-full items-start justify-center bg-[#f4f1eb] px-6 py-8 lg:px-12 lg:py-12">
            <div className="flex w-full max-w-5xl flex-col items-center">
              <div className="flex size-7 items-center justify-center text-[#111111]">
                <Sparkles className="size-4" />
              </div>
              <h2 className="mt-6 text-center text-[2.1rem] font-semibold tracking-tight text-[#111111]">
                Ola, {brokerFirstName}
              </h2>
              <p className="mt-2 text-center text-[15px] text-[#70809a]">O que voce deseja fazer hoje?</p>

              <div className="mt-8 flex flex-wrap justify-center gap-2.5">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  const className =
                    "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#d9dde5] bg-white px-5 text-sm font-medium text-[#2f3a4d] transition-colors hover:bg-[#f8f9fb]"

                  if (action.onClick) {
                    return (
                      <button key={action.label} type="button" onClick={action.onClick} className={className}>
                        <Icon className="size-4 text-[#5e6d82]" />
                        {action.label}
                      </button>
                    )
                  }

                  return (
                    <Link key={action.label} href={action.href ?? "#"} className={className}>
                      <Icon className="size-4 text-[#5e6d82]" />
                      {action.label}
                    </Link>
                  )
                })}
              </div>

              <div className="mt-8 w-full max-w-[60rem]">
                <div className="flex items-center justify-between px-6 text-sm text-[#91a0b5]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4" />
                    Atalhos inteligentes
                  </div>
                  <button type="button" className="transition-colors hover:text-[#111111]">
                    Editar
                  </button>
                </div>
                <div className="mt-3 rounded-[1.8rem] bg-white px-8 py-6 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  <div className="grid grid-cols-4 gap-4">
                    {contextMetrics.map((item) => (
                      <div key={item.label} className="flex flex-col items-center justify-center text-center">
                        <UsersRound className="size-4 text-[#9aa8bd]" />
                        <p className="mt-3 text-[2rem] font-semibold leading-none text-[#111111]">{item.value}</p>
                        <p className="mt-1 text-sm text-[#6f7f97]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-auto w-full max-w-[60rem] pt-10">
                <form
                  onSubmit={(event) => event.preventDefault()}
                  className="flex items-center gap-3 rounded-full bg-white px-7 py-5 shadow-[0_10px_26px_rgba(15,23,42,0.06)]"
                >
                  <Input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Fale com o COS..."
                    className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] text-[#111111] shadow-none outline-none placeholder:text-[#7a8798] focus-visible:ring-0"
                  />
                  <MessageCircle className="size-5 text-[#9aa6b6]" />
                  <Button
                    type="submit"
                    size="icon"
                    className="size-11 shrink-0 rounded-full bg-[#a7a7a7] text-white shadow-none hover:bg-[#8f8f8f]"
                    aria-label="Enviar mensagem ao COS"
                  >
                    <Send className="size-4" />
                  </Button>
                </form>
                {hasReachedLimit ? (
                  <div className="mt-3 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsLimitModalOpen(true)}
                      className="rounded-full text-sm text-[#5f6d82]"
                    >
                      Limite do plano atingido
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <aside className="hidden border-l border-black/[0.06] bg-white lg:flex lg:min-h-full lg:flex-col">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-5">
              <h3 className="text-[1.05rem] font-semibold text-[#111111]">Contexto</h3>
              <NotificationCenter
                title="NotificaÃ§Ãµes do corretor"
                notifications={historyNotifications}
                unreadCount={unreadCount}
                onMarkAsRead={markAsRead}
                onArchive={archive}
                tone="light"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
                  <span className="text-[#9aa6b6]">$</span>
                  Financeiro
                </div>
                <div className="rounded-[1.7rem] bg-[#111111] px-5 py-4 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm">Saldo final</span>
                    <span className="text-[1.05rem] font-semibold">{financialSummary.currentAmount}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2.5">
                  <ContextRow label="Ganhos" value={financialSummary.currentAmount} valueClassName="text-[#16a34a]" />
                  <ContextRow
                    label="Gastos"
                    value={financialSummary.valueOpen ?? "R$ 0,00"}
                    valueClassName="text-[#ef4444]"
                  />
                  <ContextRow label="Saldo anterior" value={financialSummary.currentAmount} />
                </div>
                <p className="mt-3 text-sm text-[#91a0b5]">
                  {historyNotifications.length} atividade(s) registrada(s) no workspace.
                </p>
              </div>

              <div className="mt-7">
                <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
                  <ClockBadge />
                  Atividades recentes
                </div>
                <div className="grid gap-5">
                  {contextFeed.length > 0 ? (
                    contextFeed.map((notification) => (
                      <div key={notification.id} className="flex gap-3">
                        <span className="mt-2 size-2 shrink-0 rounded-full bg-[#4c83ff]" />
                        <div>
                          <p className="text-[15px] text-[#24324a]">{notification.title.toLowerCase()}</p>
                          <p className="mt-1 text-sm text-[#91a0b5]">{notification.date}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#91a0b5]">Sem atividades recentes.</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
    </>
  )
}

function ContextRow({
  label,
  value,
  valueClassName = "text-[#40516d]",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-center justify-between rounded-[1.5rem] bg-[#f8f8f8] px-4 py-4">
      <span className="text-sm text-[#7d8aa0]">{label}</span>
      <span className={`text-[0.95rem] font-semibold ${valueClassName}`}>{value}</span>
    </div>
  )
}

function ClockBadge() {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full border border-[#b6c0d0] text-[#8b98ab]">
      <ArrowRight className="size-3 rotate-90" />
    </span>
  )
}
