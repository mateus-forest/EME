"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Building2, ExternalLink, Eye, MapPinned, MessageSquareText, MessagesSquare, ShieldCheck, Store, Users } from "lucide-react"

import { AdminBadge, AdminDataTable, AdminDefinitionGrid, AdminEmpty, AdminKpiList, AdminMetricCard, AdminMetricGrid, AdminSurface } from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminMarketplace } from "@/components/use-admin-marketplace"
import { Button } from "@/components/ui/button"
import { EmeLoading } from "@/components/ui/eme-loading"
import { cn } from "@/lib/utils"

type MarketplaceTab = "overview" | "ads" | "brokers" | "reviews" | "regions" | "conversations" | "quality" | "performance"

const tabs: Array<{ id: MarketplaceTab; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "ads", label: "Anúncios" },
  { id: "brokers", label: "Corretores" },
  { id: "reviews", label: "Avaliações" },
  { id: "regions", label: "Regiões" },
  { id: "conversations", label: "Conversas/Leads" },
  { id: "quality", label: "Qualidade" },
  { id: "performance", label: "Performance" },
]

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não informado"
}

export function AdminMarketplacePage() {
  const { report, isLoading, error, refresh } = useAdminMarketplace()
  const [tab, setTab] = useState<MarketplaceTab>("overview")
  const [actionKey, setActionKey] = useState("")
  const [feedback, setFeedback] = useState("")
  const topProperties = useMemo(() => [...(report?.ads ?? [])].sort((first, second) => second.views - first.views).slice(0, 8), [report])

  async function runAction(targetType: "property" | "broker", targetId: string, action: "notify" | "withdraw") {
    if (action === "withdraw" && !window.confirm("Retirar este anúncio do Marketplace e notificar o corretor?")) return
    const key = `${targetType}:${targetId}:${action}`
    setActionKey(key)
    setFeedback("")
    try {
      const response = await fetch("/api/admin/marketplace", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, action }),
      })
      const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null
      if (!response.ok) throw new Error(data?.error || "Não foi possível concluir a ação.")
      setFeedback(data?.message || "Ação concluída.")
      await refresh()
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível concluir a ação.")
    } finally {
      setActionKey("")
    }
  }

  return (
    <AdminPageShell title="Marketplace" subtitle="Gestão operacional de anúncios, corretores, atendimento, qualidade e performance">
      <div className="grid min-w-0 gap-5">
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={cn("shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition", tab === item.id ? "border-[#009b3a]/20 bg-[#eef9f1] text-[#087b32]" : "border-black/[0.06] bg-white text-[#667085] hover:text-[#111827]")}>{item.label}</button>)}
        </div>

        {isLoading && !report ? <EmeLoading message="Carregando operação do Marketplace..." /> : null}
        {error ? <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318] sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><Button variant="outline" onClick={() => void refresh()}>Tentar novamente</Button></div> : null}
        {feedback ? <div role="status" className="rounded-[1.15rem] border border-[#d7ebdd] bg-[#eef9f1] px-4 py-3 text-sm text-[#087b32]">{feedback}</div> : null}

        {report && tab === "overview" ? (
          <>
            <AdminMetricGrid>
              <AdminMetricCard label="Imóveis publicados" value={String(report.overview.publishedProperties)} icon={<Store className="size-5" />} />
              <AdminMetricCard label="Novos anúncios no mês" value={String(report.overview.newAdvertisements)} icon={<Building2 className="size-5" />} />
              <AdminMetricCard label="Acessos" value={String(report.overview.views)} icon={<Eye className="size-5" />} />
              <AdminMetricCard label="Leads" value={String(report.overview.leads)} icon={<Users className="size-5" />} />
              <AdminMetricCard label="Conversas" value={String(report.overview.conversations)} icon={<MessagesSquare className="size-5" />} />
              <AdminMetricCard label="Avaliações pendentes" value={String(report.overview.pendingReviews)} icon={<MessageSquareText className="size-5" />} tone={report.overview.pendingReviews ? "warning" : "success"} />
              <AdminMetricCard label="Anúncios com pendências" value={String(report.overview.lowQualityAdvertisements)} icon={<AlertTriangle className="size-5" />} tone={report.overview.lowQualityAdvertisements ? "warning" : "success"} />
              <AdminMetricCard label="Corretores ativos" value={String(report.overview.activeBrokers)} icon={<ShieldCheck className="size-5" />} />
            </AdminMetricGrid>
            <section className="grid gap-5 xl:grid-cols-2">
              <AdminSurface title="Regiões com melhor desempenho" subtitle="Ordenadas por acessos e geração de leads."><AdminKpiList rows={report.regions.slice(0, 8).map((region) => ({ label: region.name, value: region.views + region.leads * 5, detail: `${region.properties} anúncios · ${region.views} acessos · ${region.leads} leads` }))} /></AdminSurface>
              <AdminSurface title="Corretores com melhor desempenho" subtitle="Score derivado de acessos, leads, conversas e avaliações."><AdminKpiList rows={report.brokers.slice(0, 8).map((broker) => ({ label: broker.name, value: broker.performanceScore, detail: `${broker.publishedProperties} anúncios · ${broker.leads} leads · ${broker.views} acessos` }))} /></AdminSurface>
            </section>
            <AdminSurface title="Imóveis mais vistos" subtitle="Ranking dos anúncios atualmente publicados."><AdminKpiList rows={topProperties.map((ad) => ({ label: ad.title, value: ad.views, detail: `${ad.brokerName} · ${ad.region} · ${ad.leads} leads` }))} /></AdminSurface>
          </>
        ) : null}

        {report && tab === "ads" ? (
          <AdminSurface title="Anúncios publicados" subtitle="Gestão dos imóveis disponíveis no Marketplace.">
            {report.ads.length ? <AdminDataTable columns={["Imóvel", "Corretor / região", "Status", "Performance", "Publicação", "Ações"]} rows={report.ads.map((ad) => [
              <div key="property" className="min-w-52"><p className="font-semibold text-[#111827]">{ad.title}</p><p className="mt-1 text-xs text-[#7b8491]">Qualidade {ad.qualityScore}%</p></div>,
              <div key="broker" className="min-w-44"><p>{ad.brokerName}</p><p className="mt-1 text-xs text-[#7b8491]">{ad.region}</p></div>,
              <div key="status" className="flex flex-wrap gap-1.5"><AdminBadge tone="success">{ad.status}</AdminBadge><AdminBadge tone={ad.readiness === "Pronto" ? "success" : "warning"}>{ad.readiness}</AdminBadge></div>,
              <div key="performance" className="whitespace-nowrap">{ad.views} acessos<br />{ad.leads} leads</div>,
              <span key="date" className="whitespace-nowrap">{formatDate(ad.publishedAt)}</span>,
              <div key="actions" className="flex min-w-64 flex-wrap gap-2">{ad.publicPath ? <Button asChild size="sm" variant="outline"><Link href={ad.publicPath} target="_blank"><ExternalLink className="size-3.5" />Abrir</Link></Button> : null}<Button size="sm" variant="outline" disabled={Boolean(actionKey)} onClick={() => void runAction("property", ad.id, "notify")}>Notificar</Button><Button size="sm" variant="outline" disabled={Boolean(actionKey)} className="border-[#f1c7c7] text-[#a62b24]" onClick={() => void runAction("property", ad.id, "withdraw")}>Retirar</Button></div>,
            ])} /> : <AdminEmpty title="Nenhum anúncio publicado" description="Os imóveis publicados no Marketplace aparecerão aqui." />}
          </AdminSurface>
        ) : null}

        {report && tab === "brokers" ? (
          <AdminSurface title="Corretores do Marketplace" subtitle="Perfil, verificação e desempenho público.">
            {report.brokers.length ? <AdminDataTable columns={["Corretor", "CRECI", "Atuação", "Publicações", "Performance", "Ação"]} rows={report.brokers.map((broker) => [
              <div key="broker" className="min-w-48"><p className="font-semibold text-[#111827]">{broker.name}</p><p className="mt-1 text-xs text-[#7b8491]">{broker.email}</p></div>,
              <div key="creci" className="min-w-36"><p>{broker.creci || "Não informado"}</p><div className="mt-1"><AdminBadge tone={broker.creciStatus === "VERIFIED" ? "success" : "warning"}>{broker.creciStatus === "VERIFIED" ? "Verificado" : "Revisar"}</AdminBadge></div></div>,
              <div key="region" className="min-w-44"><p>{broker.region}</p><p className="mt-1 text-xs text-[#7b8491]">{broker.specialties.slice(0, 2).join(" · ") || "Sem especialidade"}</p></div>,
              <span key="properties">{broker.publishedProperties} imóveis<br />{broker.reviews} avaliações</span>,
              <span key="performance">{broker.views} acessos<br />{broker.leads} leads</span>,
              <Button key="action" size="sm" variant="outline" disabled={Boolean(actionKey)} onClick={() => void runAction("broker", broker.id, "notify")}>Notificar</Button>,
            ])} /> : <AdminEmpty title="Nenhum corretor ativo" description="Corretores com anúncios publicados aparecerão aqui." />}
          </AdminSurface>
        ) : null}

        {report && tab === "reviews" ? <AdminSurface title="Avaliações" subtitle="Moderação das avaliações reais do Marketplace."><AdminDefinitionGrid items={[{ label: "Total", value: String(report.reviewSummary.total) }, { label: "Pendentes", value: String(report.reviewSummary.pending) }]} /><Button asChild className="mt-4 bg-[#009b3a] text-white hover:bg-[#008633]"><Link href="/admin/avaliacoes-marketplace">Abrir gestão de avaliações</Link></Button></AdminSurface> : null}

        {report && tab === "regions" ? <AdminSurface title="Regiões" subtitle="Desempenho e gestão das regiões públicas."><AdminDefinitionGrid items={[{ label: "Regiões ativas", value: String(report.regionSummary.total) }, { label: "Região líder", value: report.regions[0]?.name || "Sem base" }]} /><div className="mt-4"><AdminKpiList rows={report.regions.map((region) => ({ label: region.name, value: region.views, detail: `${region.properties} anúncios · ${region.leads} leads` }))} /></div><Button asChild className="mt-4 bg-[#009b3a] text-white hover:bg-[#008633]"><Link href="/admin/regioes-marketplace"><MapPinned className="size-4" />Abrir gestão de regiões</Link></Button></AdminSurface> : null}

        {report && tab === "conversations" ? <section className="grid gap-5 xl:grid-cols-2"><AdminSurface title="Conversas recentes" subtitle="Atendimentos iniciados no Marketplace.">{report.conversations.length ? <AdminDataTable columns={["Contato", "Corretor", "Imóvel", "Status", "Última mensagem"]} rows={report.conversations.slice(0, 50).map((item) => [item.customerName, item.brokerName, item.propertyTitle, item.status, formatDate(item.lastMessageAt)])} /> : <AdminEmpty title="Sem conversas" description="Nenhuma conversa foi registrada no Marketplace." />}</AdminSurface><AdminSurface title="Leads recentes" subtitle="Contatos registrados pelas superfícies públicas.">{report.leads.length ? <AdminDataTable columns={["Lead", "Corretor", "Imóvel", "Origem", "Data"]} rows={report.leads.slice(0, 50).map((item) => [item.name, item.brokerName, item.propertyTitle, item.source, formatDate(item.createdAt)])} /> : <AdminEmpty title="Sem leads" description="Nenhum lead do Marketplace foi registrado." />}</AdminSurface></section> : null}

        {report && tab === "quality" ? <AdminSurface title="Qualidade dos anúncios" subtitle="Pendências derivadas dos dados atuais de publicação, mídia e CRECI.">{report.ads.some((ad) => ad.qualityIssues.length) ? <AdminDataTable columns={["Imóvel", "Corretor", "Qualidade", "Pendências", "Ação"]} rows={report.ads.filter((ad) => ad.qualityIssues.length).map((ad) => [ad.title, ad.brokerName, `${ad.qualityScore}%`, ad.qualityIssues.join(" · "), <Button key="notify" size="sm" variant="outline" disabled={Boolean(actionKey)} onClick={() => void runAction("property", ad.id, "notify")}>Notificar</Button>])} /> : <AdminEmpty title="Anúncios em conformidade" description="Nenhuma pendência estrutural foi encontrada nos anúncios publicados." />}</AdminSurface> : null}

        {report && tab === "performance" ? <section className="grid gap-5 xl:grid-cols-3"><AdminSurface title="Corretores" subtitle="Performance operacional."><AdminKpiList rows={report.brokers.map((broker) => ({ label: broker.name, value: broker.performanceScore, detail: `${broker.views} acessos · ${broker.leads} leads` }))} /></AdminSurface><AdminSurface title="Regiões" subtitle="Alcance e conversão."><AdminKpiList rows={report.regions.map((region) => ({ label: region.name, value: region.views + region.leads * 5, detail: `${region.views} acessos · ${region.leads} leads` }))} /></AdminSurface><AdminSurface title="Imóveis" subtitle="Anúncios mais vistos."><AdminKpiList rows={topProperties.map((ad) => ({ label: ad.title, value: ad.views, detail: `${ad.leads} leads · ${ad.conversations} conversas` }))} /></AdminSurface></section> : null}
      </div>
    </AdminPageShell>
  )
}
