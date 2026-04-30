"use client"

import { useMemo, useState } from "react"
import { Building2, MessageCircleMore, PencilLine, SlidersHorizontal, UserCheck, Zap } from "lucide-react"

import { AgencyBrokerManagementModal } from "@/components/agency-broker-management-modal"
import { AgencyInviteBrokerModal } from "@/components/agency-invite-broker-modal"
import { NotificationCenter } from "@/components/notification-center"
import { AgencyPageShell } from "@/components/agency-page-shell"
import { PaymentNotificationPanel } from "@/components/payment-notification-panel"
import { useAgencyPaymentNotifications } from "@/components/use-agency-payment-notifications"
import { useAgencyBrokers } from "@/components/use-agency-brokers"
import { useAgencyProperties } from "@/components/use-agency-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const filterOptions = ["Tudo", "Corretores", "Imóveis publicados", "Rascunhos"]

export function AgencyPortal() {
  const { brokers, addBroker, updateBroker, deleteBroker } = useAgencyBrokers()
  const { properties } = useAgencyProperties()
  const {
    notifications,
    historyNotifications,
    unreadCount,
    primaryNotification,
    markAsRead,
    dismiss,
    archive,
    requestRegularization,
  } = useAgencyPaymentNotifications()
  const [selectedBroker, setSelectedBroker] = useState<(typeof brokers)[number] | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState("Tudo")
  const [search, setSearch] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)

  const normalizedSearch = search.trim().toLowerCase()
  const showBrokersSection = activeFilter === "Tudo" || activeFilter === "Corretores"
  const showPropertiesSection =
    activeFilter === "Tudo" || activeFilter === "Imóveis publicados" || activeFilter === "Rascunhos"
  const featuredBrokers = useMemo(
    () =>
      brokers
        .filter((broker) =>
          normalizedSearch
            ? broker.name.toLowerCase().includes(normalizedSearch) ||
              broker.creci.toLowerCase().includes(normalizedSearch)
            : true,
        )
        .slice(0, 3),
    [brokers, normalizedSearch],
  )

  const recentProperties = useMemo(
    () =>
      properties
        .filter((property) =>
          activeFilter === "Imóveis publicados"
            ? property.status === "Publicado"
            : activeFilter === "Rascunhos"
              ? property.status === "Rascunho"
              : true,
        )
        .filter((property) =>
          normalizedSearch
            ? property.title.toLowerCase().includes(normalizedSearch) ||
              property.location.toLowerCase().includes(normalizedSearch) ||
              property.broker.name.toLowerCase().includes(normalizedSearch)
            : true,
        )
        .slice(0, 3),
    [activeFilter, normalizedSearch, properties],
  )

  const totalViews = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.views || 0), 0),
    [properties],
  )
  const totalLeads = useMemo(
    () => properties.reduce((sum, property) => sum + Number(property.leads || 0), 0),
    [properties],
  )

  const metrics = useMemo(
    () => [
      {
        title: "Imóveis ativos",
        value: String(properties.filter((property) => property.status === "Publicado").length),
        change: properties.length > 0 ? "Baseado nos imóveis reais" : "Nenhum imóvel publicado",
        icon: Building2,
      },
      {
        title: "Visualizações totais",
        value: totalViews.toLocaleString("pt-BR"),
        change: totalViews > 0 ? "Somatório real da operação" : "Sem visualizações registradas",
        icon: Zap,
      },
      {
        title: "Cliques no WhatsApp",
        value: "0",
        change: "Ainda sem fonte real conectada",
        icon: MessageCircleMore,
      },
      {
        title: "Leads gerados",
        value: totalLeads.toLocaleString("pt-BR"),
        change: totalLeads > 0 ? "Somatório real da operação" : "Sem leads registrados",
        icon: Zap,
      },
      {
        title: "Corretores ativos",
        value: String(brokers.filter((broker) => broker.status === "Ativo").length),
        change: brokers.length > 0 ? "Equipe carregada na tela" : "Nenhum corretor ativo",
        icon: UserCheck,
      },
    ],
    [brokers, properties, totalLeads, totalViews],
  )

  function showFeedback(message: string) {
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 1800)
  }

  function handleEditBroker(broker: (typeof brokers)[number]) {
    setSelectedBroker(broker)
    showFeedback(`Fluxo de edição aberto para ${broker.name}.`)
  }

  function handleToggleBrokerStatus(broker: (typeof brokers)[number]) {
    const nextStatus = broker.status === "Ativo" ? "Inativo" : "Ativo"
    updateBroker(broker.id, { status: nextStatus })
      .then((updatedBroker) => {
        setSelectedBroker((current) => (current?.id === broker.id ? updatedBroker : current))
        showFeedback(`Corretor ${nextStatus === "Ativo" ? "ativado" : "desativado"} com sucesso.`)
      })
      .catch((caughtError) => {
        showFeedback(
          caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o corretor.",
        )
      })
  }

  function handleSecondaryBrokerAction(broker: (typeof brokers)[number]) {
    showFeedback(`${broker.secondaryAction} enviado com sucesso.`)
  }

  function handleDeleteBroker(broker: (typeof brokers)[number]) {
    if (!window.confirm(`Tem certeza que deseja excluir ${broker.name}?`)) return
    deleteBroker(broker.id)
      .then(() => {
        setSelectedBroker((current) => (current?.id === broker.id ? null : current))
        showFeedback("Corretor removido com sucesso.")
      })
      .catch((caughtError) => {
        showFeedback(
          caughtError instanceof Error ? caughtError.message : "Não foi possível excluir o corretor.",
        )
      })
  }

  return (
    <AgencyPageShell
      title="Portal da imobiliária"
      subtitle="Visão geral da sua operação"
      searchPlaceholder="Buscar corretor, imóvel ou bairro"
      searchValue={search}
      onSearchChange={setSearch}
      primaryActionLabel="Convidar corretor"
      primaryActionOnClick={() => setInviteOpen(true)}
      notificationCenter={
        <NotificationCenter
          title="Notificações da imobiliária"
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
          Filtros
        </Button>
      }
    >
      {feedback && (
        <div className="mb-6 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          {feedback}
        </div>
      )}

      <PaymentNotificationPanel
        entityLabel="Financeiro da imobiliária"
        dismissLabel="Dispensar aviso"
        notifications={notifications}
        primaryNotification={primaryNotification}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
        onDismiss={dismiss}
        onRegularize={requestRegularization}
      />

      {filtersOpen && (
        <div className="mb-6 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm text-white/65">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option}
                type="button"
                variant="ghost"
                onClick={() => setActiveFilter(option)}
                className={`h-9 rounded-full border px-4 text-sm ${
                  activeFilter === option
                    ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE] hover:bg-[#00C853]/14"
                    : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      )}

      {normalizedSearch && (
        <div className="mb-6 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
          Filtrando resultados...
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.title} className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-sm text-white/55">{metric.title}</p>
                <p className="mt-2.5 text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
                <p className="mt-2 text-sm text-[#69F0AE]">{metric.change}</p>
              </div>
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <metric.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          {showBrokersSection && (
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Corretores em destaque</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0">
                {featuredBrokers.length > 0 ? (
                  featuredBrokers.map((broker) => (
                    <div
                      key={broker.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedBroker(broker)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          setSelectedBroker(broker)
                        }
                      }}
                      className="grid gap-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1fr)_96px_72px_110px]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full bg-[#00C853]/15 font-semibold text-[#69F0AE]">{broker.initials}</div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-white">{broker.name}</p>
                            {broker.highlight && <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-2.5 py-1 text-[11px] text-[#69F0AE]">{broker.highlight}</span>}
                          </div>
                          <p className="mt-1 text-sm text-white/45">{broker.status}</p>
                        </div>
                      </div>
                      <MiniMetric label="Imóveis" value={String(broker.properties)} />
                      <MiniMetric label="Leads" value={String(broker.leads)} />
                      <div className="flex items-center justify-start md:justify-end">
                        <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-xs text-white/65">{broker.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-sm text-white/60">
                    Nenhum corretor real disponível.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Imóveis recentes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0 md:grid-cols-2 2xl:grid-cols-3">
              {showPropertiesSection && recentProperties.length > 0 ? (
                recentProperties.map((property) => (
                  <article
                    key={property.id}
                    className="overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,16,16,0.96),rgba(12,12,12,0.92))]"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={property.image} alt={property.title} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                        <p className="text-lg font-bold text-white">{property.price}</p>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            property.status === "Publicado"
                              ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
                              : property.status === "Rascunho"
                                ? "border-[#ffd54f]/20 bg-[#ffd54f]/10 text-[#ffe082]"
                                : "border-white/[0.08] bg-black/30 text-white/70"
                          }`}
                        >
                          {property.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4">
                      <div>
                        <p className="text-base font-semibold text-white">{property.title}</p>
                        <p className="mt-1 text-sm text-white/45">{property.location}</p>
                      </div>
                      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/65">
                        <PencilLine className="size-4 text-[#69F0AE]" />
                        Publicado por {property.broker.name}
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-6 text-sm text-white/60 md:col-span-2 2xl:col-span-3">
                  Nenhum imóvel real encontrado.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Resumo lateral</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-sm text-white/50">Corretor com mais leads</p><p className="mt-2 text-base font-semibold text-white">{brokers[0]?.name ?? "Sem dados"}</p></div>
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-sm text-white/50">Imóvel mais acessado</p><p className="mt-2 text-base font-semibold text-white">{properties[0]?.title ?? "Sem dados"}</p></div>
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-sm text-white/50">Origem dos dados</p><p className="mt-2 text-base font-semibold text-white">Dados da conta</p></div>
            </CardContent>
          </Card>
        </div>
      </section>

      <AgencyBrokerManagementModal
        broker={selectedBroker}
        open={!!selectedBroker}
        onOpenChange={(open) => !open && setSelectedBroker(null)}
        onEdit={handleEditBroker}
        onToggleStatus={handleToggleBrokerStatus}
        onSecondaryAction={handleSecondaryBrokerAction}
        onDelete={handleDeleteBroker}
      />
      <AgencyInviteBrokerModal open={inviteOpen} onOpenChange={setInviteOpen} onInvite={addBroker} />
    </AgencyPageShell>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
