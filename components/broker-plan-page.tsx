"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
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
  Store,
  TriangleAlert,
  WalletCards,
  XCircle,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { NotificationCenter } from "@/components/notification-center"
import { ResponsiveCollapsibleSection } from "@/components/responsive-collapsible-section"
import { useBrokerPaymentNotifications } from "@/components/use-broker-payment-notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchCurrentUser } from "@/lib/auth-client"
import { getNextEmePlanKey, isEmePlanUpgrade } from "@/lib/eme-plans"
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

type PackageCustomCard = {
  title: string
  description: string
  actionLabel: string
  onRequest: () => void
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
  core_modules: CheckCircle2,
  marketplace: Store,
}

const featureLabels: Record<string, string> = {
  catalog: "Catálogo online",
  leads: "Leads",
  agenda: "Agenda",
  documents: "Propostas",
  financial: "Financeiro",
  analytics: "Desempenho",
  assessor_eme: "COS e Studio IA",
  core_modules: "Módulos essenciais do EME",
  marketplace: "Marketplace",
}

const premiumFeatureOrder = ["marketplace", "assessor_eme", "analytics", "documents", "agenda", "catalog", "financial", "leads", "core_modules"]

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

const capacityPackageItems: PlanPackage[] = [
  { key: "property_250", type: "property", label: "+100 imóveis", quantity: 100, price: "R$ 59/mês" },
  { key: "property_500", type: "property", label: "+250 imóveis", quantity: 250, price: "R$ 119/mês" },
  { key: "property_1000", type: "property", label: "+500 imóveis", quantity: 500, price: "R$ 199/mês" },
]

function getCommercialPlanCopy(planKey: string) {
  if (planKey === "free" || planKey === "pro" || planKey === "scale") {
    return commercialPlanContent[planKey]
  }

  return null
}

function buildPlanHighlights(plan: PlanItem) {
  const highlights = getCommercialPlanCopy(plan.key)?.highlights ?? [
    `Até ${plan.propertyLimit} imóveis ativos`,
    `${plan.monthlyAiCredits} Créditos IA por mês`,
    "Sistema Operacional EME completo",
  ]

  return [
    ...highlights,
    plan.features.includes("marketplace") ? "Marketplace incluso" : "Marketplace não incluso",
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

function getLimitMessage(remaining: number, label: string) {
  if (remaining <= 0) return `Você atingiu o limite de ${label}.`
  if (remaining === 1) return `Falta 1 unidade para atingir o limite de ${label}.`
  if (remaining <= 3) return `Faltam ${remaining} unidades para atingir o limite de ${label}.`
  return ""
}

export function BrokerPlanPage() {
  const searchParams = useSearchParams()
  const packagesSectionRef = useRef<HTMLDivElement>(null)
  const [upgradeFeedback, setUpgradeFeedback] = useState("")
  const [planSnapshot, setPlanSnapshot] = useState<BrokerPlanSnapshot | null>(null)
  const [isPlanLoading, setIsPlanLoading] = useState(true)
  const [isCreditHistoryExpanded, setIsCreditHistoryExpanded] = useState(false)
  const [isPropertyHistoryExpanded, setIsPropertyHistoryExpanded] = useState(false)
  const [isCapacityRequestOpen, setIsCapacityRequestOpen] = useState(false)
  const [capacityPreset, setCapacityPreset] = useState("1000")
  const [capacityAmount, setCapacityAmount] = useState("1000")
  const [capacityNotes, setCapacityNotes] = useState("")
  const [brokerName, setBrokerName] = useState("")
  const { historyNotifications, unreadCount, markAsRead, archive } = useBrokerPaymentNotifications()

  const propertyLimits = planSnapshot?.propertyLimits
  const currentPlan = planSnapshot?.currentPlan
  const propertyUsed = propertyLimits?.used ?? 0
  const propertyTotal = propertyLimits?.totalLimit ?? 0
  const propertyRemaining = propertyLimits?.remaining ?? 0
  const propertyLimitLabel = propertyLimits
    ? `${propertyUsed} usados / ${propertyTotal} disponíveis`
    : isPlanLoading
      ? "Carregando limite de imóveis"
      : "Limite indisponível"
  const expansionStatusMessage = propertyLimits
    ? propertyLimits.isExpansionActive
      ? `${propertyLimits.extraLimit} imóveis extras ativos neste plano.`
      : propertyLimits.suspendedExtraLimit > 0
        ? `${propertyLimits.suspendedExtraLimit} imóveis extras comprados aguardando um plano ativo.`
        : "Nenhuma expansão adicional ativa."
    : isPlanLoading
      ? "Carregando status da expansão"
      : "Status da expansão indisponível"

  const creditBalance = planSnapshot?.credits.balance ?? 0
  const creditUsed = planSnapshot?.credits.usedThisMonth ?? 0
  const creditMonthly = planSnapshot?.credits.monthlyCredits ?? 0
  // Extras comprados não resetam mensalmente — o total exibido precisa somar o limite
  // mensal do plano ao saldo extra ainda não consumido, não só o limite estático do plano.
  const creditExtra = planSnapshot?.credits.extraCredits ?? 0
  const creditTotal = creditMonthly + creditExtra
  const creditLimitLabel = planSnapshot
    ? `${creditUsed} utilizados / ${creditTotal} no total`
    : isPlanLoading
      ? "Carregando Créditos IA"
      : "Créditos indisponíveis"

  const hasReachedPropertyLimit = Boolean(propertyLimits && propertyRemaining <= 0)
  const propertyUsageWidth = getUsageWidth(propertyUsed, propertyTotal)
  const creditUsageWidth = getUsageWidth(creditUsed, creditTotal || Math.max(creditUsed, 1))

  const planDisplayName = currentPlan
    ? (getCommercialPlanCopy(currentPlan.key)?.name ?? currentPlan.name)
    : isPlanLoading
      ? "Carregando plano"
      : "Plano indisponível"
  const planStatus = currentPlan ? "Ativo na conta" : isPlanLoading ? "Sincronizando" : "Consulta indisponível"
  const planPrice = currentPlan ? (getCommercialPlanCopy(currentPlan.key)?.price ?? currentPlan.price) : "-"
  const planDescription = propertyLimits && currentPlan
    ? `Limite de imóveis: ${propertyLimits.baseLimit} do plano + ${propertyLimits.extraLimit} extras ativos = ${propertyLimits.totalLimit} ativos disponíveis.`
    : isPlanLoading
      ? "Carregando dados reais do plano."
      : "Não foi possível consultar os dados do plano agora."

  const propertyLimitMessage = propertyLimits ? getLimitMessage(propertyRemaining, "imóveis") : ""
  const creditLimitMessage = planSnapshot ? getLimitMessage(creditBalance, "Créditos IA") : ""

  const includedFeatures = useMemo(() => {
    const features = currentPlan?.features ?? []
    return [...features].sort((first, second) => premiumFeatureOrder.indexOf(first) - premiumFeatureOrder.indexOf(second))
  }, [currentPlan?.features])

  const creditPackages = useMemo(() => creditPackageItems, [])
  const propertyPackages = useMemo(() => capacityPackageItems, [])
  const propertyPackageHistory = useMemo(
    () => (planSnapshot?.packageHistory ?? []).filter((item) => item.packageType === "property"),
    [planSnapshot?.packageHistory],
  )
  const creditHistory = planSnapshot?.credits.history ?? []
  const visibleCreditHistory = isCreditHistoryExpanded ? creditHistory : creditHistory.slice(0, 3)
  const visiblePropertyHistory = isPropertyHistoryExpanded
    ? propertyPackageHistory
    : propertyPackageHistory.slice(0, 3)
  const isFreePlan = currentPlan?.key === "free"
  const nextPlanKey = currentPlan ? getNextEmePlanKey(currentPlan.key) : null
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
    if (!isCapacityRequestOpen || brokerName) return

    let ignore = false
    void fetchCurrentUser()
      .then((user) => {
        if (!ignore && user) setBrokerName(user.name)
      })
      .catch(() => null)

    return () => {
      ignore = true
    }
  }, [brokerName, isCapacityRequestOpen])

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout")
    if (!checkoutStatus) return

    if (checkoutStatus === "success") {
      setUpgradeFeedback("Pagamento concluído. Atualizando seu plano e seus pacotes.")
      let cancelled = false

      const revalidateCheckout = async () => {
        const attempts = 8

        for (let attempt = 0; attempt < attempts; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 1_500))
          }

          if (cancelled) return

          try {
            await loadPlanSnapshot()
          } catch (caughtError) {
            if (attempt === attempts - 1 && !cancelled) {
              setUpgradeFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar o plano.")
            }
          }
        }

        if (!cancelled) setIsPlanLoading(false)
      }

      void revalidateCheckout()

      return () => {
        cancelled = true
      }
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

  async function handlePlanCheckout(planKey?: "pro" | "scale") {
    const targetPlanKey = planKey ?? nextPlanKey

    if (!currentPlan || !targetPlanKey || !isEmePlanUpgrade(currentPlan.key, targetPlanKey)) {
      setUpgradeFeedback(
        currentPlan?.key === "scale"
          ? "Plano máximo ativo. Use os pacotes extras para ampliar sua operação."
          : "Não foi possível identificar um upgrade válido para sua conta.",
      )
      return
    }

    try {
      setUpgradeFeedback("")
      await startStripeCheckout({ plan: targetPlanKey })
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

  function focusPackagesSection() {
    const section = packagesSectionRef.current
    if (!section) return
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
    section.focus({ preventScroll: true })
    setUpgradeFeedback("Escolha um pacote extra para ampliar sua operação.")
  }

  function handleEvolvePlan() {
    if (nextPlanKey) {
      void handlePlanCheckout(nextPlanKey)
      return
    }

    focusPackagesSection()
  }

  function handleCapacityPresetChange(value: string) {
    setCapacityPreset(value)
    setCapacityAmount(value === "other" ? "" : value)
  }

  function openCapacityWhatsApp() {
    const requestedAmount = Number(capacityAmount)
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) return

    const formattedAmount = new Intl.NumberFormat("pt-BR").format(requestedAmount)
    const planName = currentPlan
      ? (getCommercialPlanCopy(currentPlan.key)?.name ?? currentPlan.name).replace(/^Plano\s+/i, "")
      : "não identificado"
    const introduction = brokerName.trim() ? `Olá, meu nome é ${brokerName.trim()} e gostaria` : "Olá, gostaria"
    const observation = capacityNotes.trim() ? ` Observação: ${capacityNotes.trim()}` : ""
    const message = `${introduction} de solicitar uma capacidade personalizada no EME. Meu plano atual é ${planName} e preciso de aproximadamente +${formattedAmount} imóveis adicionais.${observation}`

    window.open(`https://wa.me/5554999902688?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer")
    setIsCapacityRequestOpen(false)
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
          historyHref="/corretor/notificacoes"
          relatedActionHref="/corretor/plano"
          tone="light"
        />
      )}
    >
      <div className="grid gap-3">
        {hasReachedPropertyLimit ? (
          <div className="rounded-[1.2rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            Você atingiu o limite de imóveis do seu plano. Faça upgrade ou solicite um pacote adicional para continuar publicando.
          </div>
        ) : null}

        <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-[34rem]">
                  <div className="inline-flex rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                    Plano ativo
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <h2 className="text-[1.65rem] font-semibold tracking-tight text-[#050505]">{planDisplayName}</h2>
                    <span className="rounded-full border border-[#009b3a]/16 bg-[#eef9f1] px-3 py-1 text-sm font-medium text-[#009b3a]">
                      {planStatus}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-5 text-[#6B7280]">{planDescription}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
                  <div className="rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-3.5 py-2.5 text-left lg:min-w-[170px]">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7B8491]">Plano</p>
                    <p className="mt-2 text-2xl font-semibold text-[#050505]">{planPrice}</p>
                  </div>
                  <Button
                    type="button"
                    disabled={!currentPlan || !nextPlanKey}
                    onClick={nextPlanKey ? () => void handlePlanCheckout(nextPlanKey) : undefined}
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:bg-[#e7e9e5] disabled:text-[#667085] disabled:shadow-none"
                  >
                    {currentPlan?.key === "scale" ? "Plano máximo ativo" : "Fazer upgrade"}
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[var(--broker-shadow)]">
            <CardContent className="p-3.5">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">Upgrade EME</p>
              <h3 className="mt-1.5 text-base font-semibold leading-5 tracking-tight text-[#050505]">
                Mais velocidade para vender, publicar e analisar.
              </h3>
              <p className="mt-2 text-xs leading-5 text-[#667085]">
                Amplie Créditos IA e capacidade de carteira sem interromper sua operação.
              </p>
              <Button
                type="button"
                onClick={handleEvolvePlan}
                className="mt-3 h-9 w-full rounded-xl bg-[#009b3a] text-xs font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                Quero evoluir meu plano
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3">
              <CardTitle className="text-lg text-[#050505]">Uso atual</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5 p-3 md:grid-cols-2">
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
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3">
              <CardTitle className="text-lg text-[#050505]">O que está incluso</CardTitle>
            </CardHeader>
            <CardContent data-testid="included-plan-features" className="grid gap-1.5 p-3 sm:grid-cols-2">
              {includedFeatures.map((feature) => {
                const Icon = featureIcons[feature] ?? CheckCircle2
                return (
                  <div
                    key={feature}
                    className="flex items-center gap-2 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-2.5 py-2"
                  >
                    <div className="flex size-8 items-center justify-center rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                      <Icon className="size-4" />
                    </div>
                    <p className="text-sm text-[#4B5563]">{featureLabels[feature] ?? feature}</p>
                  </div>
                )
              })}
              {currentPlan?.key === "free" ? (
                <div className="flex items-center gap-2 rounded-[var(--broker-radius-md)] border border-black/[0.06] bg-[#f6f6f3] px-2.5 py-2">
                  <div className="flex size-8 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-[#7B8491]">
                    <XCircle className="size-4" />
                  </div>
                  <p className="text-sm text-[#667085]">Marketplace não incluso no plano Free</p>
                </div>
              ) : null}
              {currentPlan ? (
                <div className="flex items-center gap-2 rounded-[var(--broker-radius-md)] border border-[var(--broker-border)] bg-[var(--broker-surface-muted)] px-2.5 py-2">
                  <div className="flex size-8 items-center justify-center rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                    <Sparkles className="size-4" />
                  </div>
                  <p className="text-sm text-[#4B5563]">{currentPlan.monthlyAiCredits} Créditos IA por mês</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <ResponsiveCollapsibleSection title="Planos disponíveis" defaultMobileOpen variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader id="planos-disponiveis" className="border-b border-[var(--broker-border)] px-4 py-3">
              <CardTitle className="text-lg text-[#050505]">Planos disponíveis</CardTitle>
              <p className="text-sm text-[#6B7280]">Escolha a capacidade operacional ideal para o ritmo da sua carteira.</p>
            </CardHeader>
            <CardContent className="grid gap-2.5 p-3 lg:grid-cols-3">
              {visiblePlans.map((plan) => {
                const isCurrent = plan.key === currentPlan?.key
                const canSelectPlan = Boolean(currentPlan && isEmePlanUpgrade(currentPlan.key, plan.key))
                const isRecommended = plan.key === "pro"
                const commercialCopy = getCommercialPlanCopy(plan.key)

                return (
                  <div
                    key={plan.key}
                    className={`flex min-h-[230px] flex-col justify-between rounded-[var(--broker-radius-md)] border p-3.5 transition-all ${
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
                      <h3 className="mt-2.5 text-base font-semibold text-[#050505]">{commercialCopy?.name ?? plan.name}</h3>
                      <p className="mt-1.5 text-[1.6rem] font-semibold text-[#009b3a]">{commercialCopy?.price ?? plan.price}</p>
                      <p className="mt-1.5 text-xs leading-[1.15rem] text-[#5F6B7A]">{getPlanAudience(plan.key)}</p>

                      <div className="mt-3 grid gap-1.5">
                        {buildPlanHighlights(plan).map((highlight) => {
                          const isExcluded = highlight === "Marketplace não incluso"
                          const HighlightIcon = isExcluded ? XCircle : CheckCircle2
                          return (
                          <div key={highlight} className={`flex items-start gap-2 text-xs leading-[1.15rem] ${isExcluded ? "text-[#7B8491]" : "text-[#5F6B7A]"}`}>
                            <HighlightIcon className={`mt-0.5 size-4 shrink-0 ${isExcluded ? "text-[#98A2B3]" : "text-[#009b3a]"}`} />
                            <span>{highlight}</span>
                          </div>
                          )
                        })}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={isCurrent || !canSelectPlan ? "ghost" : "default"}
                      disabled={isCurrent || !canSelectPlan}
                      onClick={canSelectPlan ? () => void handlePlanCheckout(plan.key === "scale" ? "scale" : "pro") : undefined}
                      className={
                        isCurrent || !canSelectPlan
                          ? "mt-4 h-9 w-full rounded-xl border border-black/[0.06] bg-white/80 text-xs text-[#4B5563] hover:bg-white hover:text-[#050505]"
                          : "mt-4 h-9 w-full rounded-xl bg-[#009b3a] text-xs font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
                      }
                    >
                      {isCurrent ? "Plano atual" : !canSelectPlan ? "Plano inferior" : plan.key === "pro" ? "Assinar Pro" : "Assinar Scale"}
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
          <CardContent className="p-3">
            <p className="text-xs leading-5 text-[#4B5563]">
              <span className="font-semibold text-[#050505]">Todos os planos incluem:</span>{" "}
              COS, Cadastro Inteligente, Carteira, Catálogo Público, Studio IA, Propostas, Contratos, Agenda, Financeiro,
              Desempenho, Histórico e Login com PIN e Face ID. Marketplace está disponível nos planos Pro e Scale.
            </p>
          </CardContent>
        </Card>

        <div id="pacotes-extras" ref={packagesSectionRef} tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <ResponsiveCollapsibleSection title="Pacotes extras" defaultMobileOpen variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3">
              <CardTitle className="text-lg text-[#050505]">Pacotes extras</CardTitle>
              <p className="text-sm text-[#6B7280]">
                Amplie a operação sem trocar de plano quando precisar de mais capacidade.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-3 xl:grid-cols-2">
              <PackageCategory
                title="Pacotes de Créditos IA"
                description="Adicione mais Créditos IA sempre que precisar. Os créditos extras ficam acumulados na conta e são utilizados somente após o consumo dos créditos mensais do plano."
                items={creditPackages}
                onRequest={handlePackageCheckout}
                isLocked={isFreePlan}
                lockedMessage="Faça upgrade para adquirir créditos IA e utilizar todos os recursos inteligentes do EME."
              />
              <PackageCategory
                title="Capacidade adicional"
                description="Amplie o limite de imóveis do seu plano quando precisar. A capacidade adicional é cobrada mensalmente e permanece ativa enquanto você utilizar o complemento."
                items={propertyPackages}
                onRequest={handlePackageCheckout}
                isLocked={isFreePlan}
                lockedMessage="Faça upgrade para expandir o limite da sua carteira de imóveis."
                actionLabel="Adicionar capacidade"
                note="Disponível nos planos Pro e Scale. O complemento pode ser cancelado separadamente da assinatura principal."
                customCard={{
                  title: "Preciso de mais",
                  description: "Fale com a EME para montar uma capacidade personalizada para sua operação.",
                  actionLabel: "Solicitar capacidade",
                  onRequest: () => setIsCapacityRequestOpen(true),
                }}
              />
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>
        </div>

        <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbf8_100%)] py-0 shadow-[var(--broker-shadow)]">
          <CardContent className="flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-[40rem]">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">Subir de nível</p>
              <h3 className="mt-1.5 text-[1.15rem] font-semibold text-[#050505]">
                Destrave mais capacidade operacional para publicar, atender e executar sem interrupção.
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-[#5F6B7A]">
                Se sua carteira está crescendo ou o limite está próximo, o upgrade ajuda a manter publicação, atendimento e geração de conteúdo no mesmo ritmo da operação.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={handleEvolvePlan}
                className="h-10 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                {currentPlan?.key === "scale" ? "Ver pacotes extras" : "Fazer upgrade do plano"}
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

        <section className="grid items-start gap-3 xl:grid-cols-2">
        <ResponsiveCollapsibleSection title="Histórico de Créditos IA" variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3">
              <CardTitle className="text-lg text-[#050505]">Histórico de Créditos IA</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--broker-border)] p-3">
              {creditHistory.length ? (
                visibleCreditHistory.map((item) => (
                  <div key={item.id} data-testid="credit-history-item" className="py-3 first:pt-0 last:pb-0">
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
                <div className="rounded-[var(--broker-radius-md)] border border-black/[0.06] bg-[#fbfbf8] p-3">
                  <p className="text-sm text-[#6B7280]">Nenhuma movimentação de Créditos IA registrada ainda.</p>
                </div>
              )}
              {creditHistory.length > 3 ? (
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="credit-history-toggle"
                  aria-expanded={isCreditHistoryExpanded}
                  onClick={() => setIsCreditHistoryExpanded((expanded) => !expanded)}
                  className="mt-2 h-9 w-full rounded-xl text-xs font-semibold text-[#4B5563] hover:bg-[#f5f6f3] hover:text-[#050505]"
                >
                  {isCreditHistoryExpanded ? "Recolher histórico" : "Mostrar mais"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>

        <ResponsiveCollapsibleSection title="Histórico de Capacidade de Carteira" variant="broker">
          <Card className="rounded-[var(--broker-radius-lg)] border-[var(--broker-border)] bg-[var(--broker-surface)] py-0 shadow-[var(--broker-shadow)]">
            <CardHeader className="border-b border-[var(--broker-border)] px-4 py-3">
              <CardTitle className="text-lg text-[#050505]">Histórico de Capacidade de Carteira</CardTitle>
              <p className="text-xs text-[#6B7280]">Compras de imóveis extras aplicadas ao limite da sua carteira.</p>
            </CardHeader>
            <CardContent className="divide-y divide-[var(--broker-border)] p-3">
              {propertyPackageHistory.length ? (
                visiblePropertyHistory.map((item) => (
                  <div key={item.id} data-testid="property-history-item" className="py-3 first:pt-0 last:pb-0">
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
                <div className="rounded-[var(--broker-radius-md)] border border-black/[0.06] bg-[#fbfbf8] p-3">
                  <p className="text-sm text-[#6B7280]">Nenhuma compra de capacidade de imóveis registrada ainda.</p>
                </div>
              )}
              {propertyPackageHistory.length > 3 ? (
                <Button
                  type="button"
                  variant="ghost"
                  data-testid="property-history-toggle"
                  aria-expanded={isPropertyHistoryExpanded}
                  onClick={() => setIsPropertyHistoryExpanded((expanded) => !expanded)}
                  className="mt-2 h-9 w-full rounded-xl text-xs font-semibold text-[#4B5563] hover:bg-[#f5f6f3] hover:text-[#050505]"
                >
                  {isPropertyHistoryExpanded ? "Recolher histórico" : "Mostrar mais"}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </ResponsiveCollapsibleSection>
        </section>

        <Dialog open={isCapacityRequestOpen} onOpenChange={setIsCapacityRequestOpen}>
          <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-black/[0.06] bg-white/95 p-0 text-[#050505] shadow-[0_30px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl sm:max-w-lg">
            <DialogHeader className="border-b border-black/[0.06] px-6 py-5 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight">Solicitar capacidade personalizada</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-6 text-[#6B7280]">
                Conte o volume necessário para sua operação e fale diretamente com a equipe EME.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-5">
              <label className="grid gap-2 text-sm font-medium text-[#374151]">
                Necessidade aproximada
                <select
                  value={capacityPreset}
                  onChange={(event) => handleCapacityPresetChange(event.target.value)}
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#050505] outline-none transition focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/10"
                >
                  <option value="750">+750 imóveis</option>
                  <option value="1000">+1.000 imóveis</option>
                  <option value="2000">+2.000 imóveis</option>
                  <option value="other">Outro</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#374151]">
                Quantos imóveis adicionais você precisa?
                <input
                  type="text"
                  inputMode="numeric"
                  value={capacityAmount}
                  onChange={(event) => {
                    setCapacityAmount(event.target.value.replace(/\D/g, ""))
                    setCapacityPreset("other")
                  }}
                  placeholder="Ex.: 1500"
                  className="h-11 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#050505] outline-none transition placeholder:text-[#98A2B3] focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/10"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#374151]">
                Conte um pouco sobre sua operação <span className="font-normal text-[#98A2B3]">(opcional)</span>
                <textarea
                  value={capacityNotes}
                  onChange={(event) => setCapacityNotes(event.target.value)}
                  rows={4}
                  placeholder="Ex.: equipe, volume atual e previsão de crescimento."
                  className="w-full resize-none rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm leading-6 text-[#050505] outline-none transition placeholder:text-[#98A2B3] focus:border-[#009b3a]/45 focus:ring-2 focus:ring-[#009b3a]/10"
                />
              </label>

              <Button
                type="button"
                onClick={openCapacityWhatsApp}
                disabled={!capacityAmount || Number(capacityAmount) <= 0}
                className="mt-1 h-11 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 hover:bg-[#008633] disabled:bg-[#e7e9e5] disabled:text-[#98A2B3] disabled:shadow-none"
              >
                Falar com a EME
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </BrokerPageShell>
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
    <div className="rounded-[var(--broker-radius-md)] border border-black/[0.06] bg-[#fbfbf8] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#5F6B7A]">{label}</p>
        {alert ? <TriangleAlert className="size-4 text-[#d97706]" /> : null}
      </div>
      <p className="mt-1.5 text-xl font-semibold text-[#050505]">{value}</p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#eef1ec]">
        <div className={`h-full rounded-full ${progressTone}`} style={{ width: progressWidth }} />
      </div>
      <p className={`mt-2 text-xs leading-5 ${alert ? "text-[#b45309]" : "text-[#6B7280]"}`}>{helper}</p>
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
  actionLabel = "Comprar",
  note,
  customCard,
}: {
  title: string
  description: string
  items: PlanPackage[]
  onRequest: (packageKey: string) => Promise<void>
  isLocked?: boolean
  lockedMessage?: string
  actionLabel?: string
  note?: string
  customCard?: PackageCustomCard
}) {
  return (
    <div
      className={`rounded-[1.25rem] border p-3 transition-opacity ${
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
      <p className="mt-1.5 text-xs leading-5 text-[#6B7280]">{description}</p>
      {isLocked ? (
        <div className="mt-3 rounded-[1rem] border border-[#009b3a]/14 bg-white/85 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#009b3a]">
            Disponível a partir do plano Pro
          </p>
          <p className="mt-1.5 text-xs leading-5 text-[#5F6B7A]">{lockedMessage}</p>
          <Button
            asChild
            type="button"
            variant="ghost"
            className="mt-2.5 h-8 rounded-xl border border-black/[0.06] bg-white/90 px-3 text-xs text-[#4B5563] hover:bg-white hover:text-[#050505]"
          >
            <Link href="/corretor/plano#planos-disponiveis">Conhecer planos</Link>
          </Button>
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.type === "credit" ? Sparkles : PackagePlus

          return (
            <div
              key={item.key}
              className={`rounded-[1.1rem] border p-3 ${
                isLocked ? "border-black/[0.05] bg-white/75" : "border-black/[0.06] bg-white/90"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                  <Icon className="size-4" />
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
                className="mt-2.5 h-8 w-full rounded-xl border border-black/[0.06] bg-white/80 text-xs text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:cursor-not-allowed disabled:border-black/[0.05] disabled:bg-[#f3f4f1] disabled:text-[#9CA3AF]"
              >
                {isLocked ? "Disponível no Pro+" : actionLabel}
              </Button>
            </div>
          )
        })}
        {customCard ? (
          <div className={`flex flex-col justify-between rounded-[1.1rem] border p-3 ${isLocked ? "border-black/[0.05] bg-white/75" : "border-black/[0.06] bg-white/90"}`}>
            <div>
              <div className="flex size-8 items-center justify-center rounded-xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <Headphones className="size-4" />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-[#050505]">{customCard.title}</h4>
              <p className="mt-1 text-xs leading-5 text-[#6B7280]">{customCard.description}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={customCard.onRequest}
              disabled={isLocked}
              className="mt-2.5 h-8 w-full rounded-xl border border-black/[0.06] bg-white/80 text-xs text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:cursor-not-allowed disabled:border-black/[0.05] disabled:bg-[#f3f4f1] disabled:text-[#9CA3AF]"
            >
              {isLocked ? "Disponível no Pro+" : customCard.actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
      {note ? <p className="mt-3 text-[11px] leading-5 text-[#7B8491]">{note}</p> : null}
    </div>
  )
}
