"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowUpRight,
  CalendarDays,
  ChartColumn,
  CheckCircle2,
  Crown,
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
import { startStripeCheckout } from "@/lib/stripe-client"

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

type PackagePurchaseHistoryItem = {
  id: string
  packageKey: string
  packageType: "credit" | "property" | string
  quantity: number
  price: string
  status: string
  createdAt: string
}

type BrokerPlanSnapshot = {
  currentPlan: PlanItem
  plans: PlanItem[]
  propertyLimits: {
    baseLimit: number
    extraLimit: number
    purchasedExtraLimit: number
    suspendedExtraLimit: number
    isExpansionActive: boolean
    totalLimit: number
    used: number
    remaining: number
  }
  credits: {
    balance: number
    usedThisMonth: number
    monthlyCredits: number
    extraCredits: number
    history: CreditHistoryItem[]
  }
  packages: PlanPackage[]
  packageHistory: PackagePurchaseHistoryItem[]
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
  { key: "property_250", type: "property", label: "+50 imóveis", quantity: 50, price: "R$ 49" },
  { key: "property_500", type: "property", label: "+100 imóveis", quantity: 100, price: "R$ 89" },
  { key: "property_1000", type: "property", label: "+200 imóveis", quantity: 200, price: "R$ 159" },
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

function getPackagePurchaseLabel(item: PackagePurchaseHistoryItem) {
  const known = [...creditPackageItems, ...propertyPackageItems].find((pack) => pack.key === item.packageKey)
  if (known) return known.label
  return item.packageType === "credit" ? `+${item.quantity} Créditos IA` : `+${item.quantity} imóveis ativos`
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
  const searchParams = useSearchParams()
  const [upgradeFeedback, setUpgradeFeedback] = useState("")
  const [planSnapshot, setPlanSnapshot] = useState<BrokerPlanSnapshot | null>(null)
  const [isPlanLoading, setIsPlanLoading] = useState(true)
  const { historyNotifications, unreadCount, markAsRead, archive } = useBrokerPaymentNotifications()

  const propertyLimits = planSnapshot?.propertyLimits
  const currentPlan = planSnapshot?.currentPlan
  const propertyUsed = propertyLimits?.used ?? 0
  const propertyTotal = propertyLimits?.totalLimit ?? 0
  const propertyRemaining = propertyLimits?.remaining ?? 0
  const propertyRatio = propertyTotal ? propertyUsed / propertyTotal : 0
  const propertyLimitLabel = propertyLimits
    ? `${propertyUsed} usados / ${propertyTotal} disponíveis`
    : "Carregando limite de imóveis"
  const expansionStatusMessage = propertyLimits
    ? propertyLimits.isExpansionActive
      ? `${propertyLimits.extraLimit} imóveis extras ativos neste plano.`
      : propertyLimits.suspendedExtraLimit > 0
        ? `${propertyLimits.suspendedExtraLimit} imóveis extras comprados aguardando um plano ativo.`
        : "Nenhuma expansão adicional ativa."
    : "Carregando status da expansão"

  const creditBalance = planSnapshot?.credits.balance ?? 0
  const creditUsed = planSnapshot?.credits.usedThisMonth ?? 0
  const creditMonthly = planSnapshot?.credits.monthlyCredits ?? 0
  // Extras comprados não resetam mensalmente — o total exibido precisa somar o limite
  // mensal do plano ao saldo extra ainda não consumido, não só o limite estático do plano.
  const creditExtra = planSnapshot?.credits.extraCredits ?? 0
  const creditTotal = creditMonthly + creditExtra
  const creditRatio = creditTotal ? Math.min(1, creditUsed / creditTotal) : 0
  const creditLimitLabel = planSnapshot
    ? `${creditUsed} utilizados / ${creditTotal} no total`
    : "Carregando Créditos IA"

  const hasReachedPropertyLimit = Boolean(propertyLimits && propertyRemaining <= 0)
  const propertyUsageWidth = getUsageWidth(propertyUsed, propertyTotal)
  const creditUsageWidth = getUsageWidth(creditUsed, creditTotal || Math.max(creditUsed, 1))

  const planDisplayName = currentPlan ? (getCommercialPlanCopy(currentPlan.key)?.name ?? currentPlan.name) : "Carregando plano"
  const planStatus = currentPlan ? "Ativo na conta" : "Sincronizando"
  const planPrice = currentPlan ? (getCommercialPlanCopy(currentPlan.key)?.price ?? currentPlan.price) : "-"
  const planDescription = propertyLimits && currentPlan
    ? `Limite de imóveis: ${propertyLimits.baseLimit} do plano + ${propertyLimits.extraLimit} extras ativos = ${propertyLimits.totalLimit} ativos disponíveis.`
    : "Carregando dados reais do plano."

  const propertyLimitMessage = getLimitMessage(propertyRemaining, "imóveis")
  const creditLimitMessage = getLimitMessage(creditBalance, "Créditos IA")

  const includedFeatures = useMemo(() => {
    const features = currentPlan?.features ?? []
    return [...features].sort((first, second) => premiumFeatureOrder.indexOf(first) - premiumFeatureOrder.indexOf(second))
  }, [currentPlan?.features])

  const creditPackages = useMemo(() => creditPackageItems, [])
  const propertyPackages = useMemo(() => propertyPackageItems, [])
  const propertyPackageHistory = useMemo(
    () => (planSnapshot?.packageHistory ?? []).filter((item) => item.packageType === "property"),
    [planSnapshot?.packageHistory],
  )
  const isFreePlan = currentPlan?.key === "free"
  const visiblePlans = useMemo(
    () => (planSnapshot?.plans ?? []).filter((plan) => ["free", "pro", "scale"].includes(plan.key)),
    [planSnapshot?.plans],
  )

  async function loadPlanSnapshot() {
    setIsPlanLoading(true)

    const response = await fetch("/api/brokers/plan", { credentials: "include", cache: "no-store" })
    const data = (await response.json().catch(() => null)) as BrokerPlanSnapshot | { error?: string } | null

    if (!response.ok || !isPlanSnapshot(data)) {
      throw new Error(data && "error" in data ? data.error : "Não foi possível carregar o plano.")
    }

    setPlanSnapshot(data)
  }

  useEffect(() => {
    let ignore = false

    void loadPlanSnapshot()
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

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout")
    if (!checkoutStatus) return

    if (checkoutStatus === "success") {
      setUpgradeFeedback("Pagamento concluído. Atualizando seu plano e seus pacotes.")
      void loadPlanSnapshot()
        .catch((caughtError) => {
          setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o plano.")
        })
        .finally(() => {
          setIsPlanLoading(false)
        })
      return
    }

    if (checkoutStatus === "cancel") {
      setUpgradeFeedback("Checkout cancelado. Nenhuma alteração foi aplicada.")
    }
  }, [searchParams])

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

  async function handlePlanCheckout(planKey: "pro" | "scale" = "pro") {
    try {
      setUpgradeFeedback("")
      await startStripeCheckout({ plan: planKey })
    } catch (caughtError) {
      setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível iniciar o checkout.")
    }
  }

  async function handlePackageCheckout(packageKey: string) {
    try {
      setUpgradeFeedback("")
      await startStripeCheckout({ packageKey })
    } catch (caughtError) {
      setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível iniciar o checkout.")
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
      <div className="grid gap-4">
        {hasReachedPropertyLimit ? (
          <div className="rounded-[1.2rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            Você atingiu o limite de imóveis do seu plano. Faça upgrade ou solicite um pacote adicional para continuar publicando.
          </div>
        ) : null}

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-[34rem]">
                  <div className="inline-flex rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                    Plano ativo
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <h2 className="text-[1.65rem] font-semibold tracking-tight text-[#050505]">{planDisplayName}</h2>
                    <span className="rounded-full border border-[#009b3a]/16 bg-[#eef9f1] px-3 py-1 text-sm font-medium text-[#009b3a]">
                      {planStatus}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">{planDescription}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                  <div className="rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-3.5 py-2.5 text-left lg:min-w-[170px]">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">Plano</p>
                    <p className="mt-2 text-2xl font-semibold text-[#050505]">{planPrice}</p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => void handlePlanCheckout()}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                  >
                    Fazer upgrade
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <CompactMetricCard label="Plano ativo" value={planDisplayName} caption={planStatus} />
                <CompactMetricCard
                  label="Limite de imóveis"
                  value={propertyLimits ? `${propertyUsed}/${propertyTotal}` : "-"}
                  caption={propertyLimits ? `${propertyRemaining} disponíveis` : "Sincronizando"}
                  toneClass={getUsageTone(propertyRatio)}
                />
                <CompactMetricCard
                  label="Créditos IA"
                  value={planSnapshot ? `${creditUsed}/${creditTotal}` : "-"}
                  caption={planSnapshot ? `${creditBalance} disponíveis` : "Sincronizando"}
                  toneClass={getUsageTone(creditRatio)}
                />
                <CompactMetricCard label="Capacidade" value="Free, Pro e Scale" caption="Três planos para ritmos diferentes de operação" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[var(--broker-shadow)]">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">Upgrade EME</p>
              <h3 className="mt-2 text-[1.15rem] font-semibold tracking-tight text-[#050505]">
                Mais velocidade para vender, publicar e analisar.
              </h3>
              <div className="mt-3 grid gap-2.5">
                <UpgradeBenefit icon={Sparkles} title="Studio IA e vídeos" description="Mais folga para gerar conteúdo visual pronto para venda." />
                <UpgradeBenefit icon={Sparkles} title="COS com mais escala" description="Mais Créditos IA para manter a operação fluindo." />
                <UpgradeBenefit icon={ChartColumn} title="Capacidade de carteira" description="Mais imóveis ativos para sustentar crescimento sem interrupção." />
              </div>
              <Button
                type="button"
                onClick={() => void handlePlanCheckout()}
                className="mt-4 h-10 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                Quero evoluir meu plano
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3.5">
              <CardTitle className="text-lg text-[#050505]">Uso atual</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2">
              <UsageCard
                label="Limite de imóveis"
                value={propertyLimitLabel}
                progressWidth={propertyUsageWidth}
                progressTone="bg-[#009b3a]"
                helper={propertyLimitMessage || expansionStatusMessage}
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

          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3.5">
              <CardTitle className="text-lg text-[#050505]">O que está incluso</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
              {includedFeatures.map((feature) => {
                const Icon = featureIcons[feature] ?? CheckCircle2
                return (
                  <div
                    key={feature}
                    className="flex items-center gap-2.5 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-3 py-2.5"
                  >
                    <div className="flex size-9 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                      <Icon className="size-4.5" />
                    </div>
                    <p className="text-sm text-[#4B5563]">{featureLabels[feature] ?? feature}</p>
                  </div>
                )
              })}
              {currentPlan ? (
                <div className="flex items-center gap-2.5 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-3 py-2.5">
                  <div className="flex size-9 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                    <Sparkles className="size-4.5" />
                  </div>
                  <p className="text-sm text-[#4B5563]">{currentPlan.monthlyAiCredits} Créditos IA por mês</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <ResponsiveCollapsibleSection title="Planos disponíveis" defaultMobileOpen variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader id="planos-disponiveis" className="border-b border-[var(--broker-border)] px-4 py-4">
              <CardTitle className="text-lg text-[#050505]">Planos disponíveis</CardTitle>
              <p className="text-sm text-[#6B7280]">Escolha a capacidade operacional ideal para o ritmo da sua carteira.</p>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 lg:grid-cols-3">
              {visiblePlans.map((plan) => {
                const isCurrent = plan.key === currentPlan?.key
                const isRecommended = plan.key === "pro"
                const commercialCopy = getCommercialPlanCopy(plan.key)

                return (
                  <div
                    key={plan.key}
                    className={`flex min-h-[275px] flex-col justify-between rounded-[var(--broker-radius-md)] border p-4 transition-all ${
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
                      <h3 className="mt-3 text-lg font-semibold text-[#050505]">{commercialCopy?.name ?? plan.name}</h3>
                      <p className="mt-1.5 text-[1.6rem] font-semibold text-[#009b3a]">{commercialCopy?.price ?? plan.price}</p>
                      <p className="mt-2 text-sm leading-5 text-[#5F6B7A]">{getPlanAudience(plan.key)}</p>

                      <div className="mt-4 grid gap-2">
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
                      onClick={isCurrent ? undefined : () => void handlePlanCheckout(plan.key === "scale" ? "scale" : "pro")}
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

        <Card className="rounded-[var(--broker-radius-md)] border-[var(--broker-border)] bg-[var(--broker-surface-muted)] py-0 shadow-[var(--broker-shadow)]">
          <CardContent className="p-4">
            <p className="text-sm leading-7 text-[#4B5563]">
              <span className="font-semibold text-[#050505]">Todos os planos incluem:</span>{" "}
              COS, Cadastro Inteligente, Carteira, Catálogo Público, Studio IA, Propostas, Contratos, Agenda, Financeiro,
              Desempenho, Histórico e Login com PIN e Face ID.
            </p>
          </CardContent>
        </Card>

        <ResponsiveCollapsibleSection title="Pacotes extras" defaultMobileOpen variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-4">
              <CardTitle className="text-lg text-[#050505]">Pacotes extras</CardTitle>
              <p className="text-sm text-[#6B7280]">
                Amplie a operação sem trocar de plano quando precisar de mais capacidade.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 p-4 xl:grid-cols-2">
              <PackageCategory
                title="Pacotes de Créditos IA"
                description="Adicione mais Créditos IA sempre que precisar. Os créditos extras ficam acumulados na conta e são utilizados somente após o consumo dos créditos mensais do plano."
                items={creditPackages}
                onRequest={handlePackageCheckout}
                isLocked={isFreePlan}
                lockedMessage="Faça upgrade para adquirir créditos IA e utilizar todos os recursos inteligentes do EME."
              />
              <PackageCategory
                title="Expansão da Carteira"
                description="Aumente o limite de imóveis do plano atual. A expansão fica vinculada ao plano ativo da conta."
                items={propertyPackages}
                onRequest={handlePackageCheckout}
                isLocked={isFreePlan}
                lockedMessage="Faça upgrade para expandir o limite da sua carteira de imóveis."
              />
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[var(--broker-shadow)]">
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
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
                onClick={() => void handlePlanCheckout()}
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

        <ResponsiveCollapsibleSection title="Histórico de Créditos IA" variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3.5">
              <CardTitle className="text-lg text-[#050505]">Histórico de Créditos IA</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--broker-border)] p-4">
              {planSnapshot?.credits.history.length ? (
                planSnapshot.credits.history.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-[#050505]">{item.description || item.actionType || "Movimento de Créditos IA"}</p>
                      <span className={item.amount >= 0 ? "text-sm font-semibold text-[#009b3a]" : "text-sm font-semibold text-[#4B5563]"}>
                        {item.amount > 0 ? "+" : ""}
                        {item.amount} crédito{Math.abs(item.amount) === 1 ? "" : "s"} IA
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">
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

        <ResponsiveCollapsibleSection title="Histórico de Capacidade de Carteira" variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3.5">
              <CardTitle className="text-lg text-[#050505]">Histórico de Capacidade de Carteira</CardTitle>
              <p className="text-sm text-[#6B7280]">Compras de imóveis extras aplicadas ao limite da sua carteira.</p>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--broker-border)] p-4">
              {propertyPackageHistory.length ? (
                propertyPackageHistory.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-[#050505]">{getPackagePurchaseLabel(item)}</p>
                      <span className="text-sm font-semibold text-[#009b3a]">{item.price}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#6B7280]">
                      {formatHistoryDate(item.createdAt)} · Status: {item.status === "completed" ? "Concluída" : item.status}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-sm text-[#6B7280]">Nenhuma compra de capacidade de imóveis registrada ainda.</p>
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
    <div className="rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-[#6B7280]">{caption}</p>
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
  isLocked = false,
  lockedMessage,
}: {
  title: string
  description: string
  items: PlanPackage[]
  onRequest: (packageKey: string) => Promise<void>
  isLocked?: boolean
  lockedMessage?: string
}) {
  return (
    <div
      className={`rounded-[1.25rem] border p-4 transition-opacity ${
        isLocked ? "border-black/[0.08] bg-[#f7f7f4] opacity-85" : "border-black/[0.06] bg-[#fbfbf8]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[#050505]">{title}</h3>
        {isLocked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#009b3a]/16 bg-[#eef9f1] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#009b3a]">
            <Crown className="size-3.5" />
            Pro+
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
      {isLocked ? (
        <div className="mt-4 rounded-[1rem] border border-[#009b3a]/14 bg-white/85 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#009b3a]">
            Disponível a partir do plano Pro
          </p>
          <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">{lockedMessage}</p>
          <Button
            asChild
            type="button"
            variant="ghost"
            className="mt-3 h-9 rounded-xl border border-black/[0.06] bg-white/90 px-4 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505]"
          >
            <Link href="/corretor/plano#planos-disponiveis">Conhecer planos</Link>
          </Button>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {items.map((item) => {
          const Icon = item.type === "credit" ? Sparkles : PackagePlus

          return (
            <div
              key={item.key}
              className={`rounded-[1.1rem] border p-4 ${
                isLocked ? "border-black/[0.05] bg-white/75" : "border-black/[0.06] bg-white/90"
              }`}
            >
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
                onClick={() => void onRequest(item.key)}
                disabled={isLocked}
                className="mt-4 h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 text-sm text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:cursor-not-allowed disabled:border-black/[0.05] disabled:bg-[#f3f4f1] disabled:text-[#9CA3AF]"
              >
                {isLocked ? "Disponível no Pro+" : "Comprar"}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
