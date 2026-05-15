"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SlidersHorizontal } from "lucide-react"

import { BrokerFreePlanLimitModal } from "@/components/broker-free-plan-limit-modal"
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
  const normalizedSearch = search.trim().toLowerCase()
  const publishedPropertiesCount = useMemo(
    () => properties.filter((property) => property.status === "Publicado").length,
    [properties],
  )
  const hasReachedLimit =
    subscription.isProfileResolved &&
    !subscription.isUpgraded &&
    !subscription.isAgencyLinked &&
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
  const stats = useMemo(
    () => [
      {
        title: "Imóveis ativos",
        value: String(publishedPropertiesCount),
        change: publishedPropertiesCount > 0 ? "Baseado nos imóveis publicados" : "Nenhum imóvel publicado",
      },
      {
        title: "Visualizações",
        value: totalViews.toLocaleString("pt-BR"),
        change: totalViews > 0 ? "Somatório dos imóveis" : "Sem visualizações registradas",
      },
      {
        title: "Cliques no WhatsApp",
        value: "0",
        change: "Sem cliques registrados",
      },
      {
        title: "Leads",
        value: totalLeads.toLocaleString("pt-BR"),
        change: totalLeads > 0 ? "Somatório dos imóveis" : "Sem leads registrados",
      },
    ],
    [publishedPropertiesCount, totalLeads, totalViews],
  )

  return (
    <>
      <BrokerPageShell
        title="Dashboard"
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
          />
        }
        headerControls={
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((current) => !current)}
            className="h-8.5 rounded-xl border border-white/10 bg-white/5 px-4 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <SlidersHorizontal className="size-4" />
            Filtros rápidos
          </Button>
        }
      >
        {hasReachedLimit && (
          <div className="mb-4 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
            Você atingiu o limite gratuito de 3 imóveis. Faça upgrade para continuar publicando.
          </div>
        )}

        {filtersOpen && (
          <div className="mb-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4">
            <div className="flex flex-wrap gap-2">
              {(["Todos", "Publicado", "Rascunho"] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  variant="ghost"
                  onClick={() => setActiveStatusFilter(filter)}
                  className={`h-9 rounded-full border px-4 text-sm ${
                    activeStatusFilter === filter
                      ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE] hover:bg-[#00C853]/14"
                      : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>
        )}

        {normalizedSearch && (
          <div className="mb-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Filtrando resultados...
          </div>
        )}

        {normalizedSearch && featuredProperties.length === 0 && (
          <div className="mb-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
            Nenhum imóvel encontrado
          </div>
        )}

        <BrokerStats stats={stats} />
        <BrokerProperties properties={featuredProperties} onUpgradeClick={() => router.push("/corretor/plano")} />
      </BrokerPageShell>

      <BrokerFreePlanLimitModal open={isLimitModalOpen} onOpenChange={setIsLimitModalOpen} />
    </>
  )
}
