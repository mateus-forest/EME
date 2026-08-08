"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bot, CheckCircle2, CreditCard, Mail, MessageCircle, Users } from "lucide-react"

import { AgencyPageShell } from "@/components/agency-page-shell"
import { FinancialStatusCard } from "@/components/financial-status-card"
import { NotificationCenter } from "@/components/notification-center"
import { useAgencyPaymentNotifications } from "@/components/use-agency-payment-notifications"
import { useAgencyProfile } from "@/components/use-agency-profile"
import { useAgencySubscription } from "@/components/use-agency-subscription"
import { isFinancialNotification } from "@/lib/notification-contract"
import { startStripeCheckout } from "@/lib/stripe-client"
import { createWhatsAppUrl } from "@/lib/whatsapp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AgencyPlanPage() {
  const searchParams = useSearchParams()
  const { profile } = useAgencyProfile()
  const { subscription, refreshSubscription } = useAgencySubscription()
  const {
    historyNotifications,
    unreadCount,
    financialSummary,
    markAsRead,
    archive,
    requestRegularization,
  } = useAgencyPaymentNotifications()
  const [showDetails, setShowDetails] = useState(false)
  const [feedback, setFeedback] = useState("")
  const whatsAppUrl = createWhatsAppUrl(
    profile.whatsApp,
    "Olá, quero entender melhor o plano da imobiliária.",
  )

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout")

    if (checkoutStatus === "success") {
      refreshSubscription().catch(() => null)
      setFeedback("Pagamento concluído. Atualizando o plano da imobiliária.")
    }

    if (checkoutStatus === "cancel") {
      setFeedback("Checkout cancelado. Você pode tentar novamente quando quiser.")
    }
  }, [refreshSubscription, searchParams])

  async function handleCheckoutClick() {
    try {
      setFeedback("Redirecionando para o checkout Stripe...")
      await startStripeCheckout()
    } catch (caughtError) {
      setFeedback(
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
      setFeedback("Redirecionamento para regularização em breve.")
      return
    }

    setFeedback("Seu histórico financeiro já está atualizado.")
  }

  return (
    <AgencyPageShell
      title="Plano"
      subtitle="Entenda o custo da sua operação"
      notificationCenter={
        <NotificationCenter
          title="Notificações da imobiliária"
          notifications={historyNotifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onArchive={archive}
        />
      }
    >
      <div className="grid gap-6">
        <FinancialStatusCard
          title="Status financeiro"
          summary={financialSummary}
          onRegularize={handleRegularizeClick}
          onViewHistory={() => setFeedback("Abra o sino no topo para rever todas as notificações.")}
        />

        <Card className="rounded-[1.75rem] border-[#00C853]/18 bg-[linear-gradient(135deg,rgba(0,200,83,0.14),rgba(17,17,17,0.96)_42%,rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardContent className="grid gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#69F0AE]">
                <Bot className="size-3.5" />
                Pacote empresarial
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">COS empresarial</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
                Créditos IA da equipe, WhatsApp, automações e atendimento inteligente para corretores vinculados.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleCheckoutClick}
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
                  <h2 className="text-3xl font-semibold tracking-tight text-white">{subscription.planName}</h2>
                  <p className="mt-2 text-sm text-white/55">
                    Estrutura pensada para operar a imobiliária com catálogo institucional, gestão de equipe e operação centralizada.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/40">Valor atual</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{subscription.currentPrice}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
                  <CheckCircle2 className="size-4" />
                  Assinatura {subscription.status.toLowerCase()}
                </div>
                <Button
                  type="button"
                  onClick={handleCheckoutClick}
                  className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  Assinar plano
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Informações adicionais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Regra de corretores" value={subscription.brokerRule} />
              <InfoBlock label="Próxima cobrança" value={financialSummary.nextBillingAt || subscription.nextCharge} />
              <InfoBlock label="Status da assinatura" value={subscription.status} />
              <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4">
                <p className="text-sm text-[#69F0AE]">
                  A mensalidade considera o valor base da imobiliária mais a cobrança por corretor ativo vinculado.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">Cálculo do custo mensal</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 pt-0">
              <div className="grid gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                <PriceBlock label="Plano base" value={subscription.basePrice} />
                <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#69F0AE]/80">Corretores</p>
                  <p className="mt-2 text-xl font-semibold text-white">{subscription.brokerRule}</p>
                </div>
              </div>

              {showDetails && (
                <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-7 text-white/60">
                  O valor atual soma o plano base da imobiliária com {subscription.activeBrokerCount} corretor{subscription.activeBrokerCount === 1 ? "" : "es"} ativo{subscription.activeBrokerCount === 1 ? "" : "s"} vinculado{subscription.activeBrokerCount === 1 ? "" : "s"}.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Resumo da operação</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                <SummaryItem icon={CreditCard} label="Valor atual" value={subscription.currentPrice} />
                <SummaryItem
                  icon={Users}
                  label="Regra de corretores"
                  value={subscription.brokerRule}
                />
                <SummaryItem
                  icon={CheckCircle2}
                  label="Status da assinatura"
                  value={subscription.status}
                />
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Ações</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-6 pt-0">
                <Button
                  type="button"
                  onClick={handleCheckoutClick}
                  className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  Assinar plano
                </Button>
                <Button
                  asChild
                  className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  <Link href="/imobiliaria/corretores">Gerenciar corretores</Link>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetails((current) => !current)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  Ver detalhes do plano
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <a href={whatsAppUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <a href={`mailto:${profile.email}`}>
                    <Mail className="size-4" />
                    Email
                  </a>
                </Button>
                {feedback && <p className="text-sm text-[#69F0AE]">{feedback}</p>}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </AgencyPageShell>
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

function PriceBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function SummaryItem({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-white/50">
        <Icon className="size-4 text-[#69F0AE]" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}
