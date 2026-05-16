"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowUpRight, Bot, ChartColumn, CheckCircle2, Globe, Sparkles } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { FinancialStatusCard } from "@/components/financial-status-card"
import { NotificationCenter } from "@/components/notification-center"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { isFinancialNotification } from "@/lib/notification-contract"
import { startStripeCheckout } from "@/lib/stripe-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const benefits = [
  { label: "Anúncios ilimitados", icon: CheckCircle2 },
  { label: "IA para criação de anúncios", icon: Sparkles },
  { label: "Catálogo online", icon: Globe },
  { label: "Link compartilhável", icon: ArrowUpRight },
  { label: "Analytics de desempenho", icon: ChartColumn },
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
    financialSummary,
    markAsRead,
    archive,
    requestRegularization,
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
  const planDisplayName = hasConfirmedPaidPlan ? subscription.planName : "Plano em teste"
  const planStatus = hasConfirmedPaidPlan ? subscription.status : "Ambiente de avaliação"
  const planPrice = hasConfirmedPaidPlan ? subscription.currentPrice : "Modo teste"
  const planDescription = hasConfirmedPaidPlan
    ? "Seu plano Corretor está ativo e pronto para manter sua operação rodando."
    : "Você está usando o EME em modo de avaliação enquanto Stripe e billing são validados."

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

  async function handleUpgradeClick() {
    try {
      setUpgradeFeedback("Redirecionando para o checkout Stripe...")
      await startStripeCheckout()
    } catch (caughtError) {
      setUpgradeFeedback(
        caughtError instanceof Error ? caughtError.message : "Não foi possível iniciar o checkout Stripe.",
      )
    }
  }

  function handleRegularizeClick() {
    const openNotification = historyNotifications.find(
      (notification) =>
        isFinancialNotification(notification) &&
        (notification.financialStatus === "atraso-leve" ||
          notification.financialStatus === "inadimplente" ||
          notification.financialStatus === "notificacao-recebida"),
    )

    if (openNotification) {
      requestRegularization(openNotification.id)
      setUpgradeFeedback("Redirecionamento para regularização em breve.")
      return
    }

    setUpgradeFeedback("Seu histórico financeiro já está atualizado.")
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
      <div className="grid gap-6">
        {hasReachedLimit && (
          <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
            Você atingiu o limite gratuito de 3 imóveis. Faça upgrade para continuar publicando.
          </div>
        )}

        <FinancialStatusCard
          title="Status financeiro"
          summary={financialSummary}
          onRegularize={handleRegularizeClick}
          onViewHistory={() => setUpgradeFeedback("Abra o sino no topo para rever todas as notificações.")}
        />

        <Card className="rounded-[1.75rem] border-[#00C853]/18 bg-[linear-gradient(135deg,rgba(0,200,83,0.14),rgba(17,17,17,0.96)_42%,rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                <Bot className="size-3.5" />
                Pacote extra
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">Pacote Corretor M</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
                IA, WhatsApp, creditos e automacoes para criar anuncios, responder melhor e organizar leads com inteligencia.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleUpgradeClick}
              className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
            >
              Upgrade IA
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardContent className="p-6">
              <div className="inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                Plano atual
              </div>

              <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white">{planDisplayName}</h2>
                  <p className="mt-2 text-sm text-white/55">{planDescription}</p>
                </div>

                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Status comercial</p>
                  <div className="mt-2 flex items-end gap-2">
                    {hasConfirmedPaidPlan && subscription.previousPrice ? (
                      <span className="text-sm text-white/35 line-through">{subscription.previousPrice}</span>
                    ) : null}
                    <p className="text-3xl font-semibold text-white">{planPrice}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
                  <CheckCircle2 className="size-4" />
                  {planStatus}
                </div>
                <Button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  Fazer upgrade
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Informações da assinatura</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Status real" value={planStatus} />
              <InfoBlock label="Créditos IA disponíveis" value={String(aiCredits.balance)} />
              <InfoBlock label="Créditos consumidos no mês" value={String(aiCredits.usedThisMonth)} />
              <InfoBlock label="Próxima cobrança" value={financialSummary.nextBillingAt || subscription.nextCharge} />
              <InfoBlock label="Forma de pagamento" value={subscription.paymentMethod} />
              <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4">
                <p className="text-sm text-[#69F0AE]">
                  Os dados financeiros são atualizados a partir da assinatura e das notificações da conta.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                  O upgrade usa checkout Stripe para ativar seu plano pago com segurança.
                </p>
                <Button
                  type="button"
                  onClick={handleUpgradeClick}
                  className="mt-5 h-10 w-full rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  <Bot className="size-4" />
                  Fazer upgrade
                </Button>
                {upgradeFeedback && <p className="mt-3 text-sm text-[#69F0AE]">{upgradeFeedback}</p>}
              </CardContent>
            </Card>
          </div>
        </section>
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
