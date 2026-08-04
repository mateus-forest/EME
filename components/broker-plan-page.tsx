"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
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
  catalog: "Catálogo online",
  leads: "Leads",
  agenda: "Agenda",
  documents: "Propostas",
  financial: "Financeiro",
  analytics: "Desempenho",
  assessor_eme: "COS e Studio IA",
  all: "Todos os módulos disponíveis",
}

const premiumFeatureOrder = ["assessor_eme", "analytics", "documents", "agenda", "catalog", "financial", "leads", "all"]

const commercialPlanContent = {
  free: {
    name: "Plano Free",
    price: "R$ 0",
    description: "Ideal para conhecer o EME e validar sua operação.",
    highlights: [
      "Até 5 imóveis ativos",
      "30 Créditos IA por mês",
      "Sistema Operacional EME completo",
      "Login com PIN e Face ID",
      "Todos os módulos disponíveis",
    ],
  },
  pro: {
    name: "Plano Pro",
    price: "R$ 129/mês",
    description: "Para corretores autônomos em crescimento.",
    highlights: [
      "Até 150 imóveis ativos",
      "500 Créditos IA por mês",
      "Sistema Operacional EME completo",
      "Todos os módulos disponíveis",
      "Mais capacidade para campanhas, vídeos e automações",
    ],
  },
  scale: {
    name: "Plano Scale",
    price: "R$ 389/mês",
    description: "Para imobiliárias e operações maiores.",
    highlights: [
      "Até 1000 imóveis ativos",
      "2000 Créditos IA por mês",
      "Sistema Operacional EME completo",
      "Todos os módulos disponíveis",
      "Ideal para equipes e alto volume operacional",
    ],
  },
} as const

const creditPackageItems: PlanPackage[] = [
  { key: "credit_250", type: "credit", label: "+250 Créditos IA", quantity: 250, price: "R$ 29" },
  { key: "credit_750", type: "credit", label: "+750 Créditos IA", quantity: 750, price: "R$ 79" },
  { key: "credit_1500", type: "credit", label: "+1500 Créditos IA", quantity: 1500, price: "R$ 139" },
  { key: "credit_3000", type: "credit", label: "+3000 Créditos IA", quantity: 3000, price: "R$ 249" },
]

const propertyPackageItems: PlanPackage[] = [
  { key: "property_250", type: "property", label: "+250 imóveis", quantity: 250, price: "R$ 49" },
  { key: "property_500", type: "property", label: "+500 imóveis", quantity: 500, price: "R$ 89" },
  { key: "property_1000", type: "property", label: "+1000 imóveis", quantity: 1000, price: "R$ 159" },
]

function getCommercialPlanCopy(planKey: string) {
  if (planKey === "free" || planKey === "pro" || planKey === "scale") {
    return commercialPlanContent[planKey]
  }

  return null
}

function buildPlanHighlights(plan: PlanItem) {
  return getCommercialPlanCopy(plan.key)?.highlights ?? [
    `Até ${plan.propertyLimit} imóveis ativos`,
    `${plan.monthlyAiCredits} Créditos IA por mês`,
    "Sistema Operacional EME completo",
  ]
}

function getPlanAudience(planKey: string) {
  return getCommercialPlanCopy(planKey)?.description ?? "Plano disponível para sua operação."
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
  if (remaining <= 0) return `Você atingiu o limite de ${label}.`
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
    ? `${propertyUsed} usados / ${propertyTotal} disponíveis`
    : "Carregando limite de imóveis"

  const creditBalance = planSnapshot?.credits.balance ?? 0
  const creditUsed = planSnapshot?.credits.usedThisMonth ?? 0
  const creditMonthly = planSnapshot?.credits.monthlyCredits ?? 0
  const creditRatio = creditMonthly ? Math.min(1, creditUsed / creditMonthly) : 0
  const creditLimitLabel = planSnapshot
    ? `${creditUsed} utilizados / ${creditMonthly} do plano`
    : "Carregando Créditos IA"

  const hasReachedPropertyLimit = Boolean(propertyLimits && propertyRemaining <= 0)
  const propertyUsageWidth = getUsageWidth(propertyUsed, propertyTotal)
  const creditUsageWidth = getUsageWidth(creditUsed, creditMonthly || Math.max(creditUsed, 1))

  const planDisplayName = currentPlan ? (getCommercialPlanCopy(currentPlan.key)?.name ?? currentPlan.name) : "Carregando plano"
  const planStatus = currentPlan ? "Ativo na conta" : "Sincronizando"
  const planPrice = currentPlan ? (getCommercialPlanCopy(currentPlan.key)?.price ?? currentPlan.price) : "-"
  const planDescription = propertyLimits && currentPlan
    ? `Limite de imóveis: ${propertyLimits.baseLimit} do plano + ${propertyLimits.extraLimit} extras = ${propertyLimits.totalLimit} ativos disponíveis.`
    : "Carregando dados reais do plano."

  const propertyLimitMessage = getLimitMessage(propertyRemaining, "imóveis")
  const creditLimitMessage = getLimitMessage(Math.max(0, creditMonthly - creditUsed), "Créditos IA do plano")

  const includedFeatures = useMemo(() => {
    const features = currentPlan?.features ?? []
    return [...features].sort((first, second) => premiumFeatureOrder.indexOf(first) - premiumFeatureOrder.indexOf(second))
  }, [currentPlan?.features])

  const creditPackages = useMemo(() => creditPackageItems, [])
  const propertyPackages = useMemo(() => propertyPackageItems, [])
  const visiblePlans = useMemo(
    () => (planSnapshot?.plans ?? []).filter((plan) => ["free", "pro", "scale"].includes(plan.key)),
    [planSnapshot?.plans],
  )

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
      notificationCenter={(
        <NotificationCenter
          title="Notificações do corretor"
          notifications={historyNotifications}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onArchive={archive}
          tone="light"
        />
      )}
    >
      <div className="grid gap-5">
        {hasReachedPropertyLimit ? (
          <div className="rounded-[1.2rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            Você atingiu o limite de imóveis do seu plano. Faça upgrade ou solicite um pacote adicional para continuar publicando.
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
                    onClick={() => void registerCommercialRequest("Solicitação de plano", `${planDisplayName} - ${planPrice}`)}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                  >
                    Fazer upgrade
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CompactMetricCard label="Plano ativo" value={planDisplayName} caption={planStatus} />
                <CompactMetricCard
                  label="Limite de imóveis"
                  value={propertyLimits ? `${propertyUsed}/${propertyTotal}` : "-"}
                  caption={propertyLimits ? `${propertyRemaining} disponíveis` : "Sincronizando"}
                  toneClass={getUsageTone(propertyRatio)}
                />
                <CompactMetricCard
                  label="Créditos IA"
                  value={planSnapshot ? `${creditUsed}/${creditMonthly}` : "-"}
                  caption={planSnapshot ? `${creditBalance} disponíveis` : "Sincronizando"}
                  toneClass={getUsageTone(creditRatio)}
                />
                <CompactMetricCard label="Capacidade" value="Free, Pro e Scale" caption="Três planos para ritmos diferentes de operação" />
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
                <UpgradeBenefit icon={Sparkles} title="Studio IA e vídeos" description="Mais folga para gerar conteúdo visual pronto para venda." />
                <UpgradeBenefit icon={Sparkles} title="COS com mais escala" description="Mais Créditos IA para manter a operação fluindo." />
                <UpgradeBenefit icon={ChartColumn} title="Capacidade de carteira" description="Mais imóveis ativos para sustentar crescimento sem interrupção." />
              </div>
              <Button
                type="button"
                onClick={() => void registerCommercialRequest("Solicitação de plano", "Corretor quer entender benefícios de upgrade para Studio IA, COS e analytics.")}
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
                label="Limite de imóveis"
                value={propertyLimitLabel}
                progressWidth={propertyUsageWidth}
                progressTone="bg-[#009b3a]"
                helper={propertyLimitMessage || "Capacidade atual do plano e dos extras permanentes."}
                alert={Boolean(propertyLimitMessage)}
              />
              <UsageCard
                label="Créditos IA"
                value={creditLimitLabel}
                progressWidth={creditUsageWidth}
                progressTone="bg-[#009b3a]"
                helper={creditLimitMessage || "Acompanhe o consumo mensal dos Créditos IA do seu plano atual."}
                alert={Boolean(creditLimitMessage)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">O que está incluso</CardTitle>
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
                  <p className="text-sm text-[#4B5563]">{currentPlan.monthlyAiCredits} Créditos IA por mês</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <ResponsiveCollapsibleSection title="Planos disponíveis" defaultMobileOpen>
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Planos disponíveis</CardTitle>
              <p className="text-sm text-[#6B7280]">Escolha a capacidade operacional ideal para o ritmo da sua carteira.</p>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 pt-0 lg:grid-cols-3">
              {visiblePlans.map((plan) => {
                const isCurrent = plan.key === currentPlan?.key
                const isRecommended = plan.key === "pro"
                const commercialCopy = getCommercialPlanCopy(plan.key)

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
                      <h3 className="mt-4 text-[1.25rem] font-semibold text-[#050505]">{commercialCopy?.name ?? plan.name}</h3>
                      <p className="mt-2 text-[1.9rem] font-semibold text-[#009b3a]">{commercialCopy?.price ?? plan.price}</p>
                      <p className="mt-3 text-sm leading-6 text-[#5F6B7A]">{getPlanAudience(plan.key)}</p>

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
                      variant={isCurrent ? "ghost" : "default"}
                      onClick={() => void registerCommercialRequest("Solicitação de plano", `${commercialCopy?.name ?? plan.name} - ${commercialCopy?.price ?? plan.price}`)}
                      className={
                        isCurrent
                          ? "mt-6 h-10 w-full rounded-xl border border-black/[0.06] bg-white/80 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
                          : "mt-6 h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                      }
                    >
                      {isCurrent ? "Plano atual" : plan.key === "pro" ? "Assinar Pro" : "Assinar Scale"}
                    </Button>
                  </div>
                )
              })}
              {!isPlanLoading && !planSnapshot ? (
                <p className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm text-[#6B7280] lg:col-span-3">
                  Não foi possível carregar os planos agora.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <Card className="rounded-[1.45rem] border-black/[0.06] bg-[#fbfbf8]/95 py-0 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5">
            <p className="text-sm leading-7 text-[#4B5563]">
              <span className="font-semibold text-[#050505]">Todos os planos incluem:</span>{" "}
              COS, Cadastro Inteligente, Carteira, Catálogo Público, Studio IA, Propostas, Contratos, Agenda, Financeiro,
              Desempenho, Histórico e Login com PIN e Face ID.
            </p>
          </CardContent>
        </Card>

        <ResponsiveCollapsibleSection title="Pacotes extras">
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Pacotes extras</CardTitle>
              <p className="text-sm text-[#6B7280]">
                Amplie a operação sem trocar de plano quando precisar de mais capacidade.
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 p-5 pt-0 xl:grid-cols-2">
              <PackageCategory
                title="Pacotes de Créditos IA"
                description="Adicione mais Créditos IA sempre que precisar. Os créditos extras ficam acumulados na conta e são utilizados somente após o consumo dos créditos mensais do plano."
                items={creditPackages}
                onRequest={registerCommercialRequest}
              />
              <PackageCategory
                title="Expansão da Carteira"
                description="Aumente permanentemente o limite de imóveis ativos da sua operação."
                items={propertyPackages}
                onRequest={registerCommercialRequest}
              />
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <Card className="rounded-[1.65rem] border-black/[0.06] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[40rem]">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">Subir de nível</p>
              <h3 className="mt-2 text-[1.35rem] font-semibold text-[#050505]">
                Destrave mais capacidade operacional para publicar, atender e executar sem interrupção.
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                Se sua carteira está crescendo ou o limite está próximo, o upgrade ajuda a manter publicação, atendimento e geração de conteúdo no mesmo ritmo da operação.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => void registerCommercialRequest("Solicitação de plano", "Corretor quer fazer upgrade e entender qual plano libera mais Studio IA, COS e analytics.")}
                className="h-10 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                Fazer upgrade do plano
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void registerCommercialRequest("Contato com suporte", "Corretor solicitou atendimento de suporte pela página Plano.")}
                className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                <Headphones className="size-4" />
                Falar com suporte
              </Button>
            </div>
          </CardContent>
        </Card>

        {upgradeFeedback ? <p className="text-sm text-[#009b3a]">{upgradeFeedback}</p> : null}

        <ResponsiveCollapsibleSection title="Histórico de Créditos IA">
          <Card className="rounded-[1.65rem] border-black/[0.06] bg-white/92 py-0 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">Histórico de Créditos IA</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-5 pt-0">
              {planSnapshot?.credits.history.length ? (
                planSnapshot.credits.history.map((item) => (
                  <div key={item.id} className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-[#050505]">{item.description || item.actionType || "Movimento de Créditos IA"}</p>
                      <span className={item.amount >= 0 ? "text-sm font-semibold text-[#009b3a]" : "text-sm font-semibold text-[#4B5563]"}>
                        {item.amount > 0 ? "+" : ""}
                        {item.amount} crédito{Math.abs(item.amount) === 1 ? "" : "s"} IA
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {formatHistoryDate(item.createdAt)} · Saldo após movimento: {item.balanceAfter}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-sm text-[#6B7280]">Nenhuma movimentação de Créditos IA registrada ainda.</p>
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
                Comprar
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
