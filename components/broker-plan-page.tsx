"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, Bot, CalendarDays, ChartColumn, CheckCircle2, FileText, Globe, Headphones, Home, PackagePlus, Sparkles, WalletCards } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { NotificationCenter } from "@/components/notification-center"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type PlanItem = {
  key: string
  name: string
  price: string
  propertyLimit: number
  monthlyAiCredits: number
  initialAiCredits: number
  features: string[]
}

type PlanPackage = {
  key: string
  type: "credit" | "property"
  label: string
  quantity: number
  price: string
}

type CreditHistoryItem = {
  id: string
  type: string
  amount: number
  balanceAfter: number
  actionType: string | null
  description: string | null
  createdAt: string
}

type BrokerPlanSnapshot = {
  currentPlan: PlanItem
  plans: PlanItem[]
  propertyLimits: {
    baseLimit: number
    extraLimit: number
    totalLimit: number
    used: number
    remaining: number
  }
  credits: {
    balance: number
    usedThisMonth: number
    monthlyCredits: number
    history: CreditHistoryItem[]
  }
  packages: PlanPackage[]
}

const featureIcons: Record<string, typeof Home> = {
  catalog: Globe,
  leads: ArrowUpRight,
  agenda: CalendarDays,
  documents: FileText,
  financial: WalletCards,
  analytics: ChartColumn,
  assessor_eme: Sparkles,
  all: CheckCircle2,
}

const featureLabels: Record<string, string> = {
  catalog: "Catálogo online",
  leads: "Leads",
  agenda: "Agenda",
  documents: "Documentos",
  financial: "Financeiro",
  analytics: "Analytics",
  assessor_eme: "Assessor EME",
  all: "Todas as funcionalidades",
}

function buildPlanHighlights(plan: PlanItem) {
  return [
    `Até ${plan.propertyLimit} imóveis`,
    plan.features.includes("all") ? "Todas as funcionalidades" : "Catálogo, leads, agenda, documentos, financeiro e analytics",
    plan.features.includes("assessor_eme") ? "Assessor EME" : "",
    `${plan.monthlyAiCredits} créditos IA/mês`,
  ].filter(Boolean)
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function isPlanSnapshot(value: BrokerPlanSnapshot | { error?: string } | null): value is BrokerPlanSnapshot {
  return Boolean(value && "currentPlan" in value && "propertyLimits" in value && "credits" in value)
}

export function BrokerPlanPage() {
  const [upgradeFeedback, setUpgradeFeedback] = useState("")
  const [planSnapshot, setPlanSnapshot] = useState<BrokerPlanSnapshot | null>(null)
  const [isPlanLoading, setIsPlanLoading] = useState(true)
  const {
    historyNotifications,
    unreadCount,
    markAsRead,
    archive,
  } = useBrokerPaymentNotifications()

  const propertyLimits = planSnapshot?.propertyLimits
  const currentPlan = planSnapshot?.currentPlan
  const hasReachedLimit = Boolean(propertyLimits && propertyLimits.remaining <= 0)
  const propertyLimitLabel = propertyLimits
    ? `${propertyLimits.used} usados / ${propertyLimits.totalLimit} disponíveis`
    : "Carregando limite de imóveis"
  const usageWidth = propertyLimits?.totalLimit
    ? `${Math.min(100, Math.round((propertyLimits.used / propertyLimits.totalLimit) * 100))}%`
    : "0%"
  const planDisplayName = currentPlan?.name ?? "Carregando plano"
  const planStatus = currentPlan ? "Ativo na conta" : "Sincronizando"
  const planPrice = currentPlan?.price ?? "-"
  const planDescription = propertyLimits && currentPlan
    ? `${propertyLimits.baseLimit} imóveis do plano + ${propertyLimits.extraLimit} extras = ${propertyLimits.totalLimit} disponíveis.`
    : "Carregando dados reais do plano."

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/plan", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as BrokerPlanSnapshot | { error?: string } | null
        if (!response.ok || !isPlanSnapshot(data)) throw new Error(data && "error" in data ? data.error : "Não foi possível carregar o plano.")
        if (!ignore) setPlanSnapshot(data)
      })
      .catch((caughtError) => {
        if (!ignore) setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar o plano.")
      })
      .finally(() => {
        if (!ignore) setIsPlanLoading(false)
      })

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
          <div className="rounded-[1.25rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            Você atingiu o limite de imóveis do seu plano. Faça upgrade ou solicite um pacote de imóveis extras para continuar publicando.
          </div>
        )}

        <section className="grid gap-4">
          <ResponsiveCollapsibleSection title="Plano atual" defaultMobileOpen>
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardContent className="p-4 sm:p-5">
              <div className="inline-flex rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                Plano atual
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-[#050505]">{planDisplayName}</h2>
                  <p className="mt-2 text-sm text-[#6B7280]">{planDescription}</p>
                </div>

                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">Status comercial</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-2xl font-semibold text-[#050505]">{planPrice}</p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1.5 text-sm text-[#009b3a]">
                  <CheckCircle2 className="size-4" />
                  {planStatus}
                </div>
                <Button
                  type="button"
                  onClick={() => void registerCommercialRequest("Solicitação de plano", `${planDisplayName} - ${planPrice}`)}
                  className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                >
                  Solicitar plano
                </Button>
              </div>
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>

          <ResponsiveCollapsibleSection title="Informações da assinatura">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Informações da assinatura</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Plano atual" value={planDisplayName} />
              <InfoBlock label="Limite base do plano" value={propertyLimits ? `${propertyLimits.baseLimit} imóveis` : "-"} />
              <InfoBlock label="Imóveis extras permanentes" value={propertyLimits ? `${propertyLimits.extraLimit} imóveis` : "-"} />
              <InfoBlock label="Limite total atual" value={propertyLimits ? `${propertyLimits.totalLimit} imóveis` : "-"} />
              <InfoBlock label="Imóveis usados" value={propertyLimits ? `${propertyLimits.used} imóveis` : "-"} />
              <InfoBlock label="Imóveis restantes" value={propertyLimits ? `${propertyLimits.remaining} imóveis` : "-"} />
              <InfoBlock label="Status da assinatura" value={planStatus} />
              <InfoBlock label="Créditos IA disponíveis" value={String(planSnapshot?.credits.balance ?? 0)} />
              <InfoBlock label="Créditos IA do plano/mês" value={String(planSnapshot?.credits.monthlyCredits ?? 0)} />
              <InfoBlock label="Créditos IA usados no mês" value={String(planSnapshot?.credits.usedThisMonth ?? 0)} />
              <div className="rounded-[1.25rem] border border-[#009b3a]/20 bg-[#009b3a]/10 p-4">
                <p className="text-sm text-[#009b3a]">
                  Dados carregados do backend de planos, limites e créditos IA. Pagamento real ainda não foi integrado.
                </p>
              </div>
            </CardContent>
          </Card>
          </ResponsiveCollapsibleSection>
        </section>

        <ResponsiveCollapsibleSection title="Planos disponíveis" defaultMobileOpen>
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Planos disponíveis</CardTitle>
              <p className="text-sm text-[#6B7280]">Escolha o plano ideal para a fase atual da sua operação.</p>
            </CardHeader>
            <CardContent className="grid gap-4 p-6 pt-0 lg:grid-cols-3">
              {(planSnapshot?.plans ?? []).map((plan) => (
                <div
                  key={plan.key}
                  className="flex min-h-[360px] flex-col justify-between rounded-[1.35rem] border border-black/[0.06] bg-[#fbfbf8] p-5 transition-all hover:border-[#009b3a]/25 hover:bg-white/85"
                >
                  <div>
                    <div className="inline-flex rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#009b3a]">
                      {plan.key === currentPlan?.key ? "Plano atual" : "Plano"}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-[#050505]">{plan.name}</h3>
                    <p className="mt-2 text-2xl font-semibold text-[#009b3a]">{plan.price}</p>
                    <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">
                      {plan.propertyLimit} imóveis no plano e {plan.monthlyAiCredits} créditos IA por mês.
                    </p>

                    <div className="mt-5 grid gap-3">
                      {buildPlanHighlights(plan).map((highlight) => (
                        <div key={highlight} className="flex items-start gap-2 text-sm text-[#5F6B7A]">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
                          <span>{highlight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={plan.key === currentPlan?.key ? "ghost" : "default"}
                    onClick={() => void registerCommercialRequest("Solicitação de plano", `${plan.name} - ${plan.price}`)}
                    className={
                      plan.key === currentPlan?.key
                        ? "mt-6 h-10 w-full rounded-xl border border-black/[0.06] bg-white/80 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
                        : "mt-6 h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                    }
                  >
                    {plan.key === currentPlan?.key ? "Plano atual" : "Solicitar plano"}
                  </Button>
                </div>
              ))}
              {!isPlanLoading && !planSnapshot ? (
                <p className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280] lg:col-span-3">
                  Não foi possível carregar os planos agora.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <ResponsiveCollapsibleSection title="O que está incluso">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">O que está incluso</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0 md:grid-cols-2">
              {(currentPlan?.features ?? []).map((feature) => {
                const Icon = featureIcons[feature] ?? CheckCircle2
                return (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4"
                >
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                    <Icon className="size-4.5" />
                  </div>
                  <p className="text-sm text-[#4B5563]">{featureLabels[feature] ?? feature}</p>
                </div>
                )
              })}
              {currentPlan ? (
                <div className="flex items-center gap-3 rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-4">
                  <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                    <Bot className="size-4.5" />
                  </div>
                  <p className="text-sm text-[#4B5563]">{currentPlan.monthlyAiCredits} créditos IA/mês</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

        </ResponsiveCollapsibleSection>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#050505]">Uso atual</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-sm text-[#5F6B7A]">Imóveis cadastrados</p>
                  <p className="mt-2 text-2xl font-semibold text-[#050505]">{propertyLimitLabel}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f6f7f4]">
                    <div className="h-full rounded-full bg-[#009b3a]" style={{ width: usageWidth }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#050505]">Precisa de mais?</CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <p className="text-sm leading-7 text-[#5F6B7A]">
                  Solicite uma conversa com o suporte EME para ajustar plano, créditos ou capacidade de imóveis.
                </p>
                <Button
                  type="button"
                  onClick={() => void registerCommercialRequest("Solicitação de plano", "Corretor solicitou conversa sobre planos e pacotes EME.")}
                  className="mt-5 h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                >
                  <Bot className="size-4" />
                  Falar sobre planos
                </Button>
                {upgradeFeedback && <p className="mt-3 text-sm text-[#009b3a]">{upgradeFeedback}</p>}
              </CardContent>
            </Card>
          </div>
        </section>

        <ResponsiveCollapsibleSection title="Pacotes extras">
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-[#050505]">Pacotes extras</CardTitle>
            <p className="text-sm text-[#6B7280]">
              Pacotes extras são compra única. Créditos IA entram na carteira da conta e imóveis extras aumentam permanentemente o limite.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0 md:grid-cols-2 xl:grid-cols-3">
            {(planSnapshot?.packages ?? []).map((item) => {
              const Icon = item.type === "credit" ? Sparkles : PackagePlus
              const description = item.type === "credit"
                ? "Créditos IA adicionados à carteira da conta."
                : "Aumenta permanentemente o limite de imóveis da conta."
              return (
              <div key={item.key} className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                    <Icon className="size-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[#050505]">{item.label}</h3>
                    <p className="mt-1 text-sm font-medium text-[#009b3a]">{item.price}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#5F6B7A]">{description}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void registerCommercialRequest("Solicitar pacote", `${item.label} - ${item.price}`)}
                  className="mt-5 h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  Solicitar pacote
                </Button>
              </div>
              )
            })}
          </CardContent>
        </Card>
        </ResponsiveCollapsibleSection>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-[#fbfbf8] py-0">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[#5F6B7A]">
              Créditos IA são adicionados à carteira da conta. Imóveis extras aumentam permanentemente o limite de imóveis. Pagamento real ainda não foi integrado.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void registerCommercialRequest("Contato com suporte", "Corretor solicitou atendimento de suporte pela página Plano.")}
              className="h-10 shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
            >
              <Headphones className="size-4" />
              Falar com suporte
            </Button>
          </CardContent>
        </Card>

        <ResponsiveCollapsibleSection title="Histórico de créditos">
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-[#050505]">Histórico de créditos IA</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {planSnapshot?.credits.history.length ? (
              planSnapshot.credits.history.map((item) => (
                <div key={item.id} className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-[#050505]">{item.description || item.actionType || "Movimento de créditos"}</p>
                    <span className={item.amount >= 0 ? "text-sm font-semibold text-[#009b3a]" : "text-sm font-semibold text-[#4B5563]"}>
                      {item.amount > 0 ? "+" : ""}{item.amount} crédito{Math.abs(item.amount) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                    {formatHistoryDate(item.createdAt)} · Saldo após movimento: {item.balanceAfter}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <p className="text-sm text-[#6B7280]">Nenhuma movimentação de créditos registrada ainda.</p>
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
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[#050505]">{value}</p>
    </div>
  )
}



