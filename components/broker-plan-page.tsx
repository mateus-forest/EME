"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  FileText,
  Globe,
  Headphones,
  Home,
  PackagePlus,
  Sparkles,
  TriangleAlert,
  Video,
  WalletCards,
} from "lucide-react"

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
  catalog: "Catalogo online",
  leads: "Leads",
  agenda: "Agenda",
  documents: "Propostas",
  financial: "Financeiro",
  analytics: "Analytics",
  assessor_eme: "COS e Studio IA",
  all: "Todas as funcionalidades",
}

const premiumFeatureOrder = ["assessor_eme", "analytics", "documents", "agenda", "catalog", "financial", "leads", "all"]

function buildPlanHighlights(plan: PlanItem) {
  return [
    `Ate ${plan.propertyLimit} imoveis`,
    `${plan.monthlyAiCredits} creditos IA por mes`,
    plan.features.includes("assessor_eme") ? "COS e Studio IA ativos" : "",
    plan.features.includes("analytics") || plan.features.includes("all") ? "Analytics e desempenho" : "",
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

function getUsageWidth(used: number, total: number) {
  if (!total) return "0%"
  return `${Math.min(100, Math.round((used / total) * 100))}%`
}

function getUsageTone(ratio: number) {
  if (ratio >= 0.9) return "text-[#d97706]"
  if (ratio >= 0.75) return "text-[#b45309]"
  return "text-[#009b3a]"
}

function getLimitMessage(remaining: number, label: string) {
  if (remaining <= 0) return `Voce atingiu o limite de ${label}.`
  if (remaining === 1) return `Falta 1 unidade para atingir o limite de ${label}.`
  if (remaining <= 3) return `Faltam ${remaining} unidades para atingir o limite de ${label}.`
  return ""
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
  const propertyUsed = propertyLimits?.used ?? 0
  const propertyTotal = propertyLimits?.totalLimit ?? 0
  const propertyRemaining = propertyLimits?.remaining ?? 0
  const propertyRatio = propertyTotal ? propertyUsed / propertyTotal : 0
  const propertyLimitLabel = propertyLimits
    ? `${propertyUsed} usados / ${propertyTotal} disponiveis`
    : "Carregando limite de imoveis"

  const creditBalance = planSnapshot?.credits.balance ?? 0
  const creditUsed = planSnapshot?.credits.usedThisMonth ?? 0
  const creditMonthly = planSnapshot?.credits.monthlyCredits ?? 0
  const creditRemaining = Math.max(0, creditBalance)
  const creditRatio = creditMonthly ? Math.min(1, creditUsed / creditMonthly) : 0
  const creditLimitLabel = planSnapshot
    ? `${creditUsed} usados / ${creditMonthly} do plano`
    : "Carregando creditos IA"

  const hasReachedPropertyLimit = Boolean(propertyLimits && propertyRemaining <= 0)
  const propertyUsageWidth = getUsageWidth(propertyUsed, propertyTotal)
  const creditUsageWidth = getUsageWidth(creditUsed, creditMonthly || Math.max(creditUsed, 1))

  const planDisplayName = currentPlan?.name ?? "Carregando plano"
  const planStatus = currentPlan ? "Ativo na conta" : "Sincronizando"
  const planPrice = currentPlan?.price ?? "-"
  const planDescription = propertyLimits && currentPlan
    ? `${propertyLimits.baseLimit} imoveis do plano + ${propertyLimits.extraLimit} extras = ${propertyLimits.totalLimit} disponiveis.`
    : "Carregando dados reais do plano."

  const propertyLimitMessage = getLimitMessage(propertyRemaining, "imoveis")
  const creditLimitMessage = getLimitMessage(Math.max(0, creditMonthly - creditUsed), "creditos IA do plano")

  const includedFeatures = useMemo(() => {
    const features = currentPlan?.features ?? []
    return [...features].sort((first, second) => premiumFeatureOrder.indexOf(first) - premiumFeatureOrder.indexOf(second))
  }, [currentPlan?.features])

  const creditPackages = useMemo(
    () => (planSnapshot?.packages ?? []).filter((item) => item.type === "credit"),
    [planSnapshot?.packages],
  )
  const propertyPackages = useMemo(
    () => (planSnapshot?.packages ?? []).filter((item) => item.type === "property"),
    [planSnapshot?.packages],
  )

  useEffect(() => {
    let ignore = false

    fetch("/api/brokers/plan", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as BrokerPlanSnapshot | { error?: string } | null
        if (!response.ok || !isPlanSnapshot(data)) throw new Error(data && "error" in data ? data.error : "Nao foi possivel carregar o plano.")
        if (!ignore) setPlanSnapshot(data)
      })
      .catch((caughtError) => {
        if (!ignore) setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel carregar o plano.")
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
      if (!response.ok) throw new Error(data?.error || "Nao foi possivel registrar a solicitacao.")
      setUpgradeFeedback("Solicitacao registrada. O suporte EME dara continuidade.")
    } catch (caughtError) {
      setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel registrar a solicitacao.")
    }
  }

  return (
    <BrokerPageShell
      title="Plano"
      notificationCenter={
        <NotificationCenter
          title="Notificacoes do corretor"
          notifications={historyNotifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onArchive={archive}
          tone="light"
        />
      }
    >
      <div className="grid gap-5">
        {hasReachedPropertyLimit ? (
          <div className="rounded-[1.2rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            Voce atingiu o limite de imoveis do seu plano. Faca upgrade ou solicite um pacote adicional para continuar publicando.
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-[34rem]">
                  <div className="inline-flex rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                    Plano ativo
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <h2 className="text-[1.9rem] font-semibold tracking-tight text-[#050505]">{planDisplayName}</h2>
                    <span className="rounded-full border border-[#009b3a]/16 bg-[#eef9f1] px-3 py-1 text-sm font-medium text-[#009b3a]">
                      {planStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">{planDescription}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                  <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-left lg:min-w-[180px]">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">Plano</p>
                    <p className="mt-2 text-2xl font-semibold text-[#050505]">{planPrice}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void registerCommercialRequest("Solicitacao de plano", `${planDisplayName} - ${planPrice}`)}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                  >
                    Fazer upgrade
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CompactMetricCard label="Plano ativo" value={planDisplayName} caption={planStatus} />
                <CompactMetricCard
                  label="Imoveis"
                  value={propertyLimits ? `${propertyUsed}/${propertyTotal}` : "-"}
                  caption={propertyLimits ? `${propertyRemaining} disponiveis` : "Sincronizando"}
                  toneClass={getUsageTone(propertyRatio)}
                />
                <CompactMetricCard
                  label="Creditos IA"
                  value={planSnapshot ? `${creditUsed}/${creditMonthly}` : "-"}
                  caption={planSnapshot ? `${creditBalance} disponiveis` : "Sincronizando"}
                  toneClass={getUsageTone(creditRatio)}
                />
                <CompactMetricCard label="Upgrade" value="Pro e Growth" caption="Mais Studio IA, COS e analytics" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.65rem] border-black/[0.06] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">Upgrade EME</p>
              <h3 className="mt-3 text-[1.3rem] font-semibold tracking-tight text-[#050505]">
                Mais velocidade para vender, publicar e analisar.
              </h3>
              <div className="mt-4 grid gap-3">
                <UpgradeBenefit icon={Sparkles} title="Studio IA e videos" description="Mais folga para gerar conteudo visual pronto para venda." />
                <UpgradeBenefit icon={Bot} title="COS com mais escala" description="Credito IA e uso assistido para manter a operacao fluindo." />
                <UpgradeBenefit icon={ChartColumn} title="Analytics e desempenho" description="Mais visibilidade para ajustar a operacao com seguranca." />
              </div>
              <Button
                type="button"
                onClick={() =>
                  void registerCommercialRequest(
                    "Solicitacao de plano",
                    "Corretor quer entender beneficios de upgrade para Studio IA, COS e analytics.",
                  )
                }
                className="mt-5 h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                Quero evoluir meu plano
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Uso atual</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0 md:grid-cols-2">
              <UsageCard
                label="Imoveis"
                value={propertyLimitLabel}
                progressWidth={propertyUsageWidth}
                progressTone="bg-[#009b3a]"
                helper={propertyLimitMessage || "Capacidade atual do plano e dos extras permanentes."}
                alert={Boolean(propertyLimitMessage)}
              />
              <UsageCard
                label="Creditos IA"
                value={creditLimitLabel}
                progressWidth={creditUsageWidth}
                progressTone="bg-[#009b3a]"
                helper={creditLimitMessage || "Acompanhe o consumo mensal de IA do seu plano atual."}
                alert={Boolean(creditLimitMessage)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">O que esta incluso</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0 sm:grid-cols-2">
              {includedFeatures.map((feature) => {
                const Icon = featureIcons[feature] ?? CheckCircle2
                return (
                  <div
                    key={feature}
                    className="flex items-center gap-3 rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3.5"
                  >
                    <div className="flex size-9 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                      <Icon className="size-4.5" />
                    </div>
                    <p className="text-sm text-[#4B5563]">{featureLabels[feature] ?? feature}</p>
                  </div>
                )
              })}
              {currentPlan ? (
                <div className="flex items-center gap-3 rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3.5">
                  <div className="flex size-9 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                    <Sparkles className="size-4.5" />
                  </div>
                  <p className="text-sm text-[#4B5563]">{currentPlan.monthlyAiCredits} creditos IA por mes</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <ResponsiveCollapsibleSection title="Planos disponiveis" defaultMobileOpen>
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Planos disponiveis</CardTitle>
              <p className="text-sm text-[#6B7280]">Compare a fase atual da operacao com o que cada plano libera no portal.</p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0 lg:grid-cols-3">
              {(planSnapshot?.plans ?? []).map((plan) => {
                const isCurrent = plan.key === currentPlan?.key
                const isRecommended = plan.key === "pro"

                return (
                  <div
                    key={plan.key}
                    className={`flex min-h-[320px] flex-col justify-between rounded-[1.3rem] border p-5 transition-all ${
                      isRecommended
                        ? "border-[#009b3a]/24 bg-[linear-gradient(180deg,#f7fbf8_0%,#ffffff_100%)] shadow-[0_18px_36px_rgba(0,155,58,0.08)]"
                        : "border-black/[0.06] bg-[#fbfbf8]"
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#009b3a]">
                          {isCurrent ? "Plano atual" : "Plano"}
                        </span>
                        {isRecommended ? (
                          <span className="rounded-full bg-[#009b3a] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                            Mais escolhido
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-4 text-[1.25rem] font-semibold text-[#050505]">{plan.name}</h3>
                      <p className="mt-2 text-[1.9rem] font-semibold text-[#009b3a]">{plan.price}</p>
                      <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">
                        {plan.propertyLimit} imoveis no plano e {plan.monthlyAiCredits} creditos IA por mes.
                      </p>

                      <div className="mt-5 grid gap-3">
                        {buildPlanHighlights(plan).map((highlight) => (
                          <div key={highlight} className="flex items-start gap-2 text-sm text-[#5F6B7A]">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
                            <span>{highlight}</span>
                          </div>
                        ))}
                        <div className="flex items-start gap-2 text-sm text-[#5F6B7A]">
                          <Video className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
                          <span>{plan.monthlyAiCredits > 0 ? "Fluxos de video e Studio IA com mais folego de uso" : "Uso inicial para organizar a operacao"}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-[#5F6B7A]">
                          <Bot className="mt-0.5 size-4 shrink-0 text-[#009b3a]" />
                          <span>{plan.features.includes("assessor_eme") || plan.features.includes("all") ? "COS com mais capacidade operacional" : "Base do portal e estrutura essencial"}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={isCurrent ? "ghost" : "default"}
                      onClick={() => void registerCommercialRequest("Solicitacao de plano", `${plan.name} - ${plan.price}`)}
                      className={
                        isCurrent
                          ? "mt-6 h-10 w-full rounded-xl border border-black/[0.06] bg-white/80 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
                          : "mt-6 h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                      }
                    >
                      {isCurrent ? "Plano atual" : "Solicitar upgrade"}
                    </Button>
                  </div>
                )
              })}
              {!isPlanLoading && !planSnapshot ? (
                <p className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280] lg:col-span-3">
                  Nao foi possivel carregar os planos agora.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <ResponsiveCollapsibleSection title="Pacotes extras">
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Pacotes extras</CardTitle>
              <p className="text-sm text-[#6B7280]">
                Pacotes extras sao compra unica. Creditos IA entram na carteira da conta e imoveis extras aumentam permanentemente o limite.
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 p-5 pt-0 xl:grid-cols-2">
              <PackageCategory
                title="Creditos IA"
                description="Amplie a capacidade do COS, do Studio IA e dos fluxos de geracao conforme a demanda da operacao."
                items={creditPackages}
                onRequest={registerCommercialRequest}
              />
              <PackageCategory
                title="Capacidade adicional de imoveis"
                description="Aumente o limite permanente da conta para sustentar mais publicacoes e crescimento de carteira."
                items={propertyPackages}
                onRequest={registerCommercialRequest}
              />
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <Card className="rounded-[1.65rem] border-black/[0.06] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[40rem]">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">Subir de nivel</p>
              <h3 className="mt-2 text-[1.35rem] font-semibold text-[#050505]">
                Destrave mais Studio IA, videos, COS e analytics para operar com mais margem.
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                Se sua carteira esta crescendo ou o limite esta proximo, o upgrade ajuda a manter publicacao, atendimento e geracao de conteudo sem interrupcao.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() =>
                  void registerCommercialRequest(
                    "Solicitacao de plano",
                    "Corretor quer fazer upgrade e entender qual plano libera mais Studio IA, COS e analytics.",
                  )
                }
                className="h-10 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                Fazer upgrade do plano
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void registerCommercialRequest("Contato com suporte", "Corretor solicitou atendimento de suporte pela pagina Plano.")}
                className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                <Headphones className="size-4" />
                Falar com suporte
              </Button>
            </div>
          </CardContent>
        </Card>

        {upgradeFeedback ? <p className="text-sm text-[#009b3a]">{upgradeFeedback}</p> : null}

        <ResponsiveCollapsibleSection title="Historico de creditos">
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Historico de creditos IA</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              {planSnapshot?.credits.history.length ? (
                planSnapshot.credits.history.map((item) => (
                  <div key={item.id} className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-[#050505]">{item.description || item.actionType || "Movimento de creditos"}</p>
                      <span className={item.amount >= 0 ? "text-sm font-semibold text-[#009b3a]" : "text-sm font-semibold text-[#4B5563]"}>
                        {item.amount > 0 ? "+" : ""}
                        {item.amount} credito{Math.abs(item.amount) === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {formatHistoryDate(item.createdAt)} · Saldo apos movimento: {item.balanceAfter}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-sm text-[#6B7280]">Nenhuma movimentacao de creditos registrada ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>
      </div>
    </BrokerPageShell>
  )
}

function CompactMetricCard({
  label,
  value,
  caption,
  toneClass = "text-[#050505]",
}: {
  label: string
  value: string
  caption: string
  toneClass?: string
}) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">{label}</p>
      <p className={`mt-2 text-[1.45rem] font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-sm text-[#6B7280]">{caption}</p>
    </div>
  )
}

function UsageCard({
  label,
  value,
  progressWidth,
  progressTone,
  helper,
  alert,
}: {
  label: string
  value: string
  progressWidth: string
  progressTone: string
  helper: string
  alert?: boolean
}) {
  return (
    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#5F6B7A]">{label}</p>
        {alert ? <TriangleAlert className="size-4 text-[#d97706]" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-[#050505]">{value}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eef1ec]">
        <div className={`h-full rounded-full ${progressTone}`} style={{ width: progressWidth }} />
      </div>
      <p className={`mt-3 text-sm leading-6 ${alert ? "text-[#b45309]" : "text-[#6B7280]"}`}>{helper}</p>
    </div>
  )
}

function UpgradeBenefit({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.15rem] border border-black/[0.06] bg-white/80 px-4 py-3.5">
      <div className="flex size-9 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
        <Icon className="size-4.5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#050505]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#6B7280]">{description}</p>
      </div>
    </div>
  )
}

function PackageCategory({
  title,
  description,
  items,
  onRequest,
}: {
  title: string
  description: string
  items: PlanPackage[]
  onRequest: (title: string, message: string) => Promise<void>
}) {
  return (
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <h3 className="text-base font-semibold text-[#050505]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => {
          const Icon = item.type === "credit" ? Sparkles : PackagePlus
          return (
            <div key={item.key} className="rounded-[1.1rem] border border-black/[0.06] bg-white/90 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                  <Icon className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-[#050505]">{item.label}</h4>
                  <p className="mt-1 text-sm font-medium text-[#009b3a]">{item.price}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onRequest("Solicitar pacote", `${item.label} - ${item.price}`)}
                className="mt-4 h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                Solicitar pacote
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
