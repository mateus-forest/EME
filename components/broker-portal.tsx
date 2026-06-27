"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
import { BrokerIntelligenceDashboard } from "@/components/broker-intelligence-dashboard"
import { NotificationCenter } from "@/components/notification-center"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { BrokerProperties } from "@/components/broker-properties"
import { BrokerStats } from "@/components/broker-stats"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"

export function BrokerPortal() {
  const router = useRouter()
  const { properties } = useBrokerProperties()
  const { subscription } = useBrokerSubscription()
  const {
    historyNotifications,
    unreadCount,
    markAsRead,
    archive,
  } = useBrokerPaymentNotifications()
  const [search, setSearch] = useState("")
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeStatusFilter, setActiveStatusFilter] = useState<"Todos" | "Publicado" | "Rascunho">("Todos")
  const [analytics, setAnalytics] = useState<{ totalViews: number; whatsappClicks: number; leads: number } | null>(null)
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
        .filter((property) =>
          activeStatusFilter === "Todos" ? property.status === "Publicado" : property.status === activeStatusFilter,
        )
        .filter((property) =>
          normalizedSearch
            ? [property.title, property.city, property.neighborhood].some((field) =>
                field.toLowerCase().includes(normalizedSearch),
              )
            : true,
        )
        .sort((first, second) => Number(second.views) - Number(first.views))
        .slice(0, 3),
    [properties, normalizedSearch, activeStatusFilter],
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
  const stats = useMemo(
    () => [
      {
        title: "Imóveis ativos",
        value: String(publishedPropertiesCount),
        change: publishedPropertiesCount > 0 ? "Baseado nos imóveis publicados" : "Nenhum imóvel publicado ainda",
      },
      {
        title: "Visualizações",
        value: (analytics?.totalViews ?? totalViews).toLocaleString("pt-BR"),
        change: (analytics?.totalViews ?? totalViews) > 0 ? "Eventos reais do catálogo" : "Aguardando tráfego do catálogo",
      },
      {
        title: "Cliques no WhatsApp",
        value: String(analytics?.whatsappClicks ?? 0),
        change: "Cliques reais nos botões do catálogo",
      },
      {
        title: "Leads",
        value: (analytics?.leads ?? totalLeads).toLocaleString("pt-BR"),
        change: (analytics?.leads ?? totalLeads) > 0 ? "Leads reais recebidos" : "Nenhum lead recebido ainda",
      },
    ],
    [analytics, publishedPropertiesCount, totalLeads, totalViews],
  )

  return (
    <>
      <BrokerPageShell
        title="COS"
        searchPlaceholder="Buscar imóveis, bairros ou campanhas"
        searchValue={search}
        onSearchChange={setSearch}
        primaryActionLabel="Novo imóvel"
        primaryActionHref="/corretor/novo-imovel"
        primaryActionOnClick={
          hasReachedLimit ? () => setIsLimitModalOpen(true) : () => router.push("/corretor/novo-imovel")
        }
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
        headerControls={
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((current) => !current)}
            className="h-8.5 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
          >
            <SlidersHorizontal className="size-4" />
            Filtros rápidos
          </Button>
        }
      >
        {filtersOpen && (
          <div className="mb-4 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4">
            <div className="flex flex-wrap gap-2">
              {(["Todos", "Publicado", "Rascunho"] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveStatusFilter(filter)}
                  className={`h-9 rounded-full border px-4 text-sm ${
                    activeStatusFilter === filter
                      ? "border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a] hover:bg-[#009b3a]/14"
                      : "border-black/[0.06] bg-white/80 text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
                  }`}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        )}

        {normalizedSearch && (
          <div className="mb-4 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
            Filtrando resultados...
          </div>
        )}

        {normalizedSearch && featuredProperties.length === 0 && (
          <div className="mb-4 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
            Nenhum imóvel encontrado
          </div>
        )}

        <BrokerStats stats={stats} />
        <div className="mt-5">
          <BrokerIntelligenceDashboard properties={properties} subscription={subscription} />
        </div>
        <BrokerProperties properties={featuredProperties} onUpgradeClick={() => router.push("/corretor/plano")} />
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
    </>
  )
}
