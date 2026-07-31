"use client"

import { BarChart3, CreditCard, DollarSign, Layers3, Sparkles, TrendingUp } from "lucide-react"

import { AdminEmptyState, AdminStructureCards } from "@/components/admin-empty-state"
import { AdminPageShell } from "@/components/admin-page-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAdminMonetization } from "@/components/use-admin-monetization"

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value)
}

export function AdminAiConsumptionPage() {
  const { report, isLoading, error } = useAdminMonetization()

  if (isLoading) {
    return (
      <AdminPageShell title="Monetização" subtitle="Inventário operacional, custos reais e estratégia de planos do EME">
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardContent className="px-6 py-6 text-sm text-[#6B7280]">Carregando estudo completo de monetização...</CardContent>
        </Card>
      </AdminPageShell>
    )
  }

  if (error || !report) {
    return (
      <AdminPageShell title="Monetização" subtitle="Inventário operacional, custos reais e estratégia de planos do EME">
        <AdminEmptyState
          icon={DollarSign}
          title="Não foi possível carregar o estudo"
          description={error || "O dashboard de monetização não retornou dados neste momento."}
        >
          <AdminStructureCards
            items={[
              "Inventário de operações com custo real ou estimado",
              "Planos sugeridos com margem por perfil",
              "Ranking de módulos, operações e contas mais caras",
            ]}
          />
        </AdminEmptyState>
      </AdminPageShell>
    )
  }

  const topInventory = report.inventory.slice().sort((first, second) => second.monthlyCostBrl - first.monthlyCostBrl).slice(0, 12)

  return (
    <AdminPageShell
      title="Monetização"
      subtitle={`Baseado no código atual do EME e na telemetria operacional registrada até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(report.generatedAt))}`}
    >
      <div className="grid gap-5">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {report.overview.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} value={metric.value} helper={metric.helper} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Operações mais caras</CardTitle>
              <p className="text-sm leading-6 text-[#6B7280]">
                Custos por operação calculados a partir da telemetria recente ou, na ausência de uso, pela estimativa do catálogo.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 px-6 pb-6 pt-0">
              {topInventory.map((item) => (
                <div key={item.operationKey} className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#050505]">{item.feature}</p>
                      <p className="mt-1 text-sm text-[#6B7280]">{item.module} · {item.provider} · {item.model}</p>
                    </div>
                    <span className="rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs text-[#4B5563]">
                      {formatBRL(item.monthlyCostBrl)}/mês
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[#4B5563] sm:grid-cols-2 xl:grid-cols-4">
                    <Info label="Operação" value={item.operationKey} />
                    <Info label="Capacidade" value={item.capability} />
                    <Info label="Média" value={formatBRL(item.avgCostBrl)} />
                    <Info label="Créditos" value={String(item.suggestedCredits)} />
                    <Info label="Requests" value={formatNumber(item.requestCount)} />
                    <Info label="Input" value={formatNumber(item.avgInputTokens)} />
                    <Info label="Output" value={formatNumber(item.avgOutputTokens)} />
                    <Info label="Cache" value={item.cacheable ? "Sim" : "Não"} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-5">
            <InsightCard
              icon={TrendingUp}
              title="Rankings"
              items={[
                `Operação líder: ${report.ranking.expensiveOperations[0]?.label || "-"}`,
                `Módulo líder: ${report.ranking.expensiveModules[0]?.label || "-"}`,
                `Plano mais custoso: ${report.ranking.expensivePlans[0]?.helper || report.ranking.expensivePlans[0]?.label || "-"}`,
              ]}
            />
            <InsightCard
              icon={Layers3}
              title="Distribuição"
              items={[
                `Top modelo: ${report.distribution.costByModel[0]?.label || "-"}`,
                `Top capability: ${report.distribution.costByCapability[0]?.label || "-"}`,
                `Workflows mapeados: ${report.distribution.costByWorkflow.length}`,
              ]}
            />
            <InsightCard
              icon={Sparkles}
              title="Referência de pricing"
              items={[
                `Câmbio USD/BRL: ${report.pricingReference.usdToBrlRate.toFixed(4)}`,
                `Data de referência: ${report.pricingReference.usdToBrlDate}`,
                "OpenAI e Luma baseados em preços oficiais consultados nesta sprint.",
              ]}
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TableCard
            icon={BarChart3}
            title="Distribuição por capability"
            rows={report.distribution.costByCapability.slice(0, 8).map((item) => ({
              label: item.label,
              value: formatBRL(item.value),
              helper: item.helper || "Capability registrada no catálogo do COS/Studio",
            }))}
          />
          <TableCard
            icon={DollarSign}
            title="Distribuição por modelo"
            rows={report.distribution.costByModel.slice(0, 8).map((item) => ({
              label: item.label,
              value: formatBRL(item.value),
              helper: item.helper || "Custo agregado por modelo/provedor",
            }))}
          />
        </section>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-[#050505]">Planos sugeridos</CardTitle>
            <p className="text-sm leading-6 text-[#6B7280]">
              Estratégia de monetização baseada no custo operacional real do EME, buscando simplicidade, margem alta e espaço para escala.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 px-6 pb-6 pt-0 xl:grid-cols-4">
            {report.plans.map((plan) => (
              <div key={plan.key} className="rounded-[1.3rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#98A2B3]">{plan.key}</p>
                    <h3 className="mt-2 text-lg font-semibold text-[#050505]">{plan.name}</h3>
                  </div>
                  <span className="rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium text-[#009b3a]">
                    {plan.price}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-[#4B5563]">
                  <Info label="Imóveis" value={formatNumber(plan.propertyLimit)} />
                  <Info label="Créditos" value={formatNumber(plan.monthlyCredits)} />
                  <Info label="Custo estimado" value={formatBRL(plan.estimatedMonthlyCostBrl)} />
                  <Info label="Margem" value={`${formatBRL(plan.estimatedMarginBrl)} · ${plan.estimatedMarginPercent}%`} />
                </div>
                <p className="mt-4 text-sm leading-6 text-[#6B7280]">{plan.targetProfile}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Sistema de créditos sugerido</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 px-6 pb-6 pt-0">
              {report.creditSystem.map((item) => (
                <div key={item.operationKey} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                  <div>
                    <p className="font-medium text-[#050505]">{item.feature}</p>
                    <p className="text-sm text-[#6B7280]">{item.module} · {item.operationKey}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#050505]">{item.suggestedCredits} créditos</p>
                    <p className="text-xs text-[#6B7280]">{formatBRL(item.estimatedCostBrl)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">Pacotes extras sugeridos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 px-6 pb-6 pt-0">
              {report.extraPackages.map((pack) => (
                <div key={pack.key} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
                  <div>
                    <p className="font-medium text-[#050505]">{pack.label}</p>
                    <p className="text-sm text-[#6B7280]">{pack.credits ? `${pack.credits} créditos adicionais` : `${pack.properties} imóveis adicionais`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#050505]">{pack.price}</p>
                    <p className="text-xs text-[#6B7280]">{pack.estimatedMarginPercent}% de margem estimada</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <SeriesCard title="Relatório diário" points={report.reports.dailyCostBrl} />
          <SeriesCard title="Relatório semanal" points={report.reports.weeklyCostBrl} />
          <SeriesCard title="Relatório mensal" points={report.reports.monthlyCostBrl} />
        </section>
      </div>
    </AdminPageShell>
  )
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card className="rounded-[1.5rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardContent className="p-4">
        <p className="text-sm text-[#6B7280]">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-[#050505]">{value}</p>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">{helper}</p>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#98A2B3]">{label}</p>
      <p className="mt-1 text-sm text-[#111111]">{value}</p>
    </div>
  )
}

function InsightCard({ icon: Icon, title, items }: { icon: typeof CreditCard; title: string; items: string[] }) {
  return (
    <Card className="rounded-[1.5rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
            <Icon className="size-5" />
          </div>
          <h3 className="text-lg font-semibold text-[#050505]">{title}</h3>
        </div>
        <div className="mt-4 grid gap-2 text-sm leading-6 text-[#4B5563]">
          {items.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TableCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: typeof CreditCard
  title: string
  rows: Array<{ label: string; value: string; helper: string }>
}) {
  return (
    <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
            <Icon className="size-5" />
          </div>
          <CardTitle className="text-xl text-[#050505]">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 pb-6 pt-0">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3">
            <div>
              <p className="font-medium text-[#050505]">{row.label}</p>
              <p className="text-sm text-[#6B7280]">{row.helper}</p>
            </div>
            <span className="text-sm font-semibold text-[#050505]">{row.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SeriesCard({ title, points }: { title: string; points: Array<{ label: string; value: number }> }) {
  const maxValue = Math.max(...points.map((point) => point.value), 1)
  return (
    <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <CardHeader className="px-6 py-5">
        <CardTitle className="text-xl text-[#050505]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 pb-6 pt-0">
        {points.map((point) => (
          <div key={point.label} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm text-[#4B5563]">
              <span>{point.label}</span>
              <span>{formatBRL(point.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#eef1ec]">
              <div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${Math.max(4, (point.value / maxValue) * 100)}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
