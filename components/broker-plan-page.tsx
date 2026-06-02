"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowUpRight, Bot, CalendarDays, ChartColumn, CheckCircle2, FileText, Globe, Headphones, Home, PackagePlus, Sparkles, WalletCards } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { NotificationCenter } from "@/components/notification-center"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const benefits = [
  { label: "Até 3 imóveis", icon: Home },
  { label: "Catálogo online", icon: Globe },
  { label: "Leads", icon: ArrowUpRight },
  { label: "Agenda", icon: CalendarDays },
  { label: "Documentos", icon: FileText },
  { label: "Financeiro", icon: WalletCards },
  { label: "Analytics", icon: ChartColumn },
  { label: "Assessor EME em teste", icon: Sparkles },
  { label: "20 créditos IA", icon: Bot },
]

const availablePlans = [
  {
    name: "Plano Free",
    price: "R$ 0",
    description: "Para começar a operar com catálogo, leads e recursos essenciais do EME.",
    highlights: [
      "Até 3 imóveis",
      "Catálogo online",
      "Leads, agenda, documentos, financeiro e analytics",
      "Assessor EME em teste",
      "20 créditos IA",
    ],
  },
  {
    name: "Plano EME Pro",
    price: "R$ 89,90/mês",
    description: "Para corretores que precisam de mais imóveis e operação assistida pela IA.",
    highlights: [
      "Até 50 imóveis",
      "Todas as funcionalidades",
      "Assessor EME",
      "50 créditos IA/mês",
    ],
  },
  {
    name: "Plano EME Growth",
    price: "R$ 149,90/mês",
    description: "Para carteiras maiores, com mais capacidade de catálogo e créditos mensais.",
    highlights: [
      "Até 150 imóveis",
      "Todas as funcionalidades",
      "Assessor EME",
      "150 créditos IA/mês",
    ],
  },
]

const extraPackages = [
  {
    title: "+50 créditos IA",
    price: "R$ 29,90",
    description: "Créditos IA adicionados à carteira da conta.",
    action: "Solicitar pacote",
    icon: Sparkles,
  },
  {
    title: "+150 créditos IA",
    price: "R$ 69,90",
    description: "Mais créditos para anúncios, propostas, buscas e ações do Assessor EME.",
    action: "Solicitar pacote",
    icon: Sparkles,
  },
  {
    title: "+300 créditos IA",
    price: "R$ 119,90",
    description: "Pacote maior para operações com uso frequente de IA.",
    action: "Solicitar pacote",
    icon: Sparkles,
  },
  {
    title: "+30 imóveis",
    price: "R$ 49,90",
    description: "Aumenta permanentemente o limite de imóveis da conta.",
    action: "Solicitar pacote",
    icon: PackagePlus,
  },
  {
    title: "+90 imóveis",
    price: "R$ 119,90",
    description: "Expande permanentemente a capacidade do catálogo.",
    action: "Solicitar pacote",
    icon: PackagePlus,
  },
]

export function BrokerPlanPage() {
  const searchParams = useSearchParams()
  const [upgradeFeedback, setUpgradeFeedback] = useState("")
  const [aiCredits, setAiCredits] = useState({ balance: 0, usedThisMonth: 0 })
  const { subscription, refreshSubscription } = useBrokerSubscription()
  const { properties } = useBrokerProperties()
  const {
    historyNotifications,
    unreadCount,
    markAsRead,
    archive,
  } = useBrokerPaymentNotifications()

  const publishedPropertiesCount = properties.filter((property) => property.status === "Publicado").length
  const hasReachedLimit =
    subscription.isProfileResolved &&
    !subscription.isUpgraded &&
    publishedPropertiesCount >= (subscription.propertyLimit ?? 3)
  const propertyLimitLabel = !subscription.isProfileResolved
    ? `${publishedPropertiesCount} imóveis cadastrados`
    : subscription.isUpgraded
      ? `${publishedPropertiesCount} imóveis ativos no plano Corretor`
      : `${publishedPropertiesCount} de ${subscription.propertyLimit ?? 3} imóveis gratuitos`
  const usageWidth = !subscription.isProfileResolved || subscription.isUpgraded
    ? "100%"
    : `${Math.min(100, Math.round((publishedPropertiesCount / (subscription.propertyLimit ?? 3)) * 100))}%`
  const hasConfirmedPaidPlan = subscription.isUpgraded && subscription.billingStatus === "ACTIVE"
  const planDisplayName = hasConfirmedPaidPlan ? "Plano EME Pro" : "Plano Free"
  const planStatus = hasConfirmedPaidPlan ? subscription.status : "Ambiente de avaliação"
  const planPrice = hasConfirmedPaidPlan ? "R$ 89,90/mês" : "R$ 0"
  const planDescription = hasConfirmedPaidPlan
    ? "Até 50 imóveis, todas as funcionalidades, Assessor EME e 50 créditos IA por mês."
    : "Até 3 imóveis, catálogo online, leads, agenda, documentos, financeiro, analytics e 20 créditos IA."

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout")

    if (checkoutStatus === "success") {
      refreshSubscription().catch(() => null)
      setUpgradeFeedback("Pagamento concluído. Atualizando seu plano.")
    }

    if (checkoutStatus === "cancel") {
      setUpgradeFeedback("Checkout cancelado. Você pode tentar novamente quando quiser.")
    }
  }, [refreshSubscription, searchParams])

  useEffect(() => {
    let ignore = false

    fetch("/api/ai/broker-assistant", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { credits?: { balance: number; usedThisMonth: number } }
          | null

        if (!ignore && response.ok && data?.credits) {
          setAiCredits(data.credits)
        }
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [])

  async function registerCommercialRequest(title: string, message: string) {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ title, message }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível registrar a solicitação.")
      setUpgradeFeedback("Solicitação registrada. O suporte EME dará continuidade.")
    } catch (caughtError) {
      setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível registrar a solicitação.")
    }
  }

  return (
    <BrokerPageShell
      title="Plano"
      notificationCenter={
        <NotificationCenter
          title="Notificações do corretor"
          notifications={historyNotifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onArchive={archive}
        />
      }
    >
      <div className="grid gap-5">
        {hasReachedLimit && (
          <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
            Você atingiu o limite gratuito de 3 imóveis. Faça upgrade para continuar publicando.
          </div>
        )}

        <section className="grid gap-4">
          <ResponsiveCollapsibleSection title="Plano atual" defaultMobileOpen>
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardContent className="p-4 sm:p-5">
              <div className="inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                Plano atual
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">{planDisplayName}</h2>
                  <p className="mt-2 text-sm text-white/55">{planDescription}</p>
                </div>

                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Status comercial</p>
                  <div className="mt-2 flex items-end gap-2">
                    {hasConfirmedPaidPlan && subscription.previousPrice ? (
                      <span className="text-sm text-white/35 line-through">{subscription.previousPrice}</span>
                    ) : null}
                    <p className="text-2xl font-semibold text-white">{planPrice}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
                  <CheckCircle2 className="size-4" />
                  {planStatus}
                </div>
                <Button
                  type="button"
                  onClick={() => void registerCommercialRequest("Solicitação de plano", `${planDisplayName} - ${planPrice}`)}
                  className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  Solicitar plano
                </Button>
              </div>
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Informações da assinatura">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Informações da assinatura</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Plano atual" value={planDisplayName} />
              <InfoBlock label="Modo teste/em avaliação" value={hasConfirmedPaidPlan ? "Não" : "Sim"} />
              <InfoBlock label="Status da assinatura" value={planStatus} />
              <InfoBlock label="Créditos IA disponíveis" value={String(aiCredits.balance)} />
              <InfoBlock label="Créditos IA usados no mês" value={String(aiCredits.usedThisMonth)} />
              <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4">
                <p className="text-sm text-[#69F0AE]">
                  Esta tela apresenta os planos e pacotes disponíveis. Limites reais, cobrança e consumo seguem sem alteração nesta etapa.
                </p>
              </div>
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        <ResponsiveCollapsibleSection title="Planos disponíveis" defaultMobileOpen>
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Planos disponíveis</CardTitle>
              <p className="text-sm text-white/50">Escolha o plano ideal para a fase atual da sua operação.</p>
            </CardHeader>
            <CardContent className="grid gap-4 p-6 pt-0 lg:grid-cols-3">
              {availablePlans.map((plan) => (
                <div
                  key={plan.name}
                  className="flex min-h-[360px] flex-col justify-between rounded-[1.35rem] border border-white/[0.08] bg-white/[0.03] p-5 transition-all hover:border-[#00C853]/25 hover:bg-white/[0.05]"
                >
                  <div>
                    <div className="inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#69F0AE]">
                      {plan.name === planDisplayName ? "Plano atual" : "Plano"}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">{plan.name}</h3>
                    <p className="mt-2 text-2xl font-semibold text-[#69F0AE]">{plan.price}</p>
                    <p className="mt-3 text-sm leading-6 text-white/58">{plan.description}</p>

                    <div className="mt-5 grid gap-3">
                      {plan.highlights.map((highlight) => (
                        <div key={highlight} className="flex items-start gap-2 text-sm text-white/70">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#69F0AE]" />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={plan.name === planDisplayName ? "ghost" : "default"}
                    onClick={() => void registerCommercialRequest("Solicitação de plano", `${plan.name} - ${plan.price}`)}
                    className={
                      plan.name === planDisplayName
                        ? "mt-6 h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
                        : "mt-6 h-10 w-full rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                    }
                  >
                    {plan.name === planDisplayName ? "Solicitar alteração" : "Solicitar plano"}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <ResponsiveCollapsibleSection title="O que está incluso">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">O que está incluso</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit.label}
                  className="flex items-center gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                    <benefit.icon className="size-4.5" />
                  </div>
                  <p className="text-sm text-white/75">{benefit.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

        </ResponsiveCollapsibleSection>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Uso atual</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-sm text-white/60">Imóveis cadastrados</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{propertyLimitLabel}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-[#00C853]" style={{ width: usageWidth }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Precisa de mais?</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <p className="text-sm leading-7 text-white/60">
                  Solicite uma conversa com o suporte EME para ajustar plano, créditos ou capacidade de imóveis.
                </p>
                <Button
                  type="button"
                  onClick={() => void registerCommercialRequest("Solicitação de plano", "Corretor solicitou conversa sobre planos e pacotes EME.")}
                  className="mt-5 h-10 w-full rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  <Bot className="size-4" />
                  Falar sobre planos
                </Button>
                {upgradeFeedback && <p className="mt-3 text-sm text-[#69F0AE]">{upgradeFeedback}</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <ResponsiveCollapsibleSection title="Pacotes extras">
        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">Pacotes extras</CardTitle>
            <p className="text-sm text-white/50">
              Pacotes extras são compra única. Créditos IA entram na carteira da conta e imóveis extras aumentam permanentemente o limite.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0 md:grid-cols-2 xl:grid-cols-3">
            {extraPackages.map((item) => (
              <div key={item.title} className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                    <item.icon className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm font-medium text-[#69F0AE]">{item.price}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/58">{item.description}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void registerCommercialRequest(item.action, `${item.title} - ${item.price}`)}
                  className="mt-5 h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  {item.action}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-white/[0.03] py-0">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-white/58">
              Créditos IA são adicionados à carteira da conta. Imóveis extras aumentam permanentemente o limite de imóveis. Nenhum bloqueio real foi ativado nesta etapa.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void registerCommercialRequest("Contato com suporte", "Corretor solicitou atendimento de suporte pela página Plano.")}
              className="h-10 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/75 hover:bg-white/[0.08] hover:text-white"
            >
              <Headphones className="size-4" />
              Falar com suporte
            </Button>
          </CardContent>
        </Card>

        <ResponsiveCollapsibleSection title="Histórico de uso">
        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">Histórico simples de uso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {historyNotifications.length > 0 ? (
              historyNotifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">{notification.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">{notification.message}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-sm text-white/55">Nenhum uso financeiro registrado ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>
      </div>
    </BrokerPageShell>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}



