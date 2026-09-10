"use client"

import { useEffect, useState } from "react"
import { AlertCircle, ArrowDown, RefreshCw } from "lucide-react"
import { AdminPageShell } from "@/components/admin-page-shell"
import { OverviewBadge, OverviewEmpty, OverviewMetric, OverviewRanking, OverviewSection, OverviewTrafficChart, overviewNumber } from "@/components/admin-journey-overview-ui"
import { OVERVIEW_EVENT_LABELS, OVERVIEW_MODULE_LABELS, OVERVIEW_TIME_ZONE, overviewLocalDay, overviewRate, type AdminJourneyOverview as OverviewResponse, type OverviewPeriodKey } from "@/lib/admin-journey-contract"

const periods = [{ key: "today", label: "Hoje" }, { key: "7d", label: "7 dias" }, { key: "30d", label: "30 dias" }, { key: "custom", label: "Personalizado" }] as const
const deviceLabels = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet", unknown: "Não identificado" }
function displayDate(value: string | null | undefined, time = false) { return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: OVERVIEW_TIME_ZONE, dateStyle: "short", ...(time ? { timeStyle: "short" as const } : {}) }).format(new Date(value)) : "Sem ocorrência" }
function dateOnly(value: string) { return value.split("-").reverse().join("/") }
const rateLabel = (value: number | null | undefined) => value == null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`

export function AdminJourneyOverview() {
  const [period, setPeriod] = useState<OverviewPeriodKey>("7d")
  const [dates, setDates] = useState({ from: "", to: "" })
  const [custom, setCustom] = useState({ from: "", to: "" })
  const [revision, setRevision] = useState(0)
  const [chartMetric, setChartMetric] = useState<"views" | "visitors" | "sessions">("views")
  const [result, setResult] = useState<{ key: string; data: OverviewResponse | null; error: string }>({ key: "", data: null, error: "" })
  const query = new URLSearchParams({ period, ...(period === "custom" ? custom : {}) }).toString()
  const requestKey = `${query}:${revision}`
  const waitingForDates = period === "custom" && (!custom.from || !custom.to)
  const loading = !waitingForDates && result.key !== requestKey
  const data = result.key === requestKey ? result.data : null
  const error = result.key === requestKey ? result.error : ""
  useEffect(() => {
    if (waitingForDates) return
    const controller = new AbortController()
    void fetch(`/api/admin/journey-overview?${query}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok || !body.overview) throw new Error(body.error || "Não foi possível carregar a visão geral."); return body.overview as OverviewResponse })
      .then(overview => { if (!controller.signal.aborted) setResult({ key: requestKey, data: overview, error: "" }) })
      .catch(error => { if (!controller.signal.aborted) setResult({ key: requestKey, data: null, error: error instanceof Error ? error.message : "Fonte indisponível." }) })
    return () => controller.abort()
  }, [query, requestKey, waitingForDates])
  const journey = data?.journey.data
  const totals = journey?.totals
  const trafficStatus = !data ? "" : !journey ? "Indisponível" : data.journey.state.status === "partial" ? "Parcial • eventos recebidos" : "No período"
  const conversion = journey ? overviewRate(journey.funnel[2].count, journey.funnel[0].count) : null
  const unavailable = !journey
  const tableHead = "px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#849087]"
  const tableCell = "px-2 py-2.5 text-xs tabular-nums text-[#526158]"

  return <AdminPageShell title="Visão geral" subtitle="Negócio, aquisição e uso do EME">
    <div className="space-y-4" aria-busy={loading} data-testid="journey-overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-medium text-[#314d3c]">{data ? `${dateOnly(data.period.from)} — ${dateOnly(data.period.to)}` : "Visão do período"}</p><p className="mt-1 text-[10px] text-[#849087]">America/Sao_Paulo{data ? ` · Atualizado ${displayDate(data.generatedAt, true)}` : ""}</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="flex rounded-xl border border-[#e0e7e1] bg-[#f6f8f6] p-1" role="group" aria-label="Período">{periods.map(item => <button key={item.key} type="button" aria-pressed={period === item.key} onClick={() => setPeriod(item.key)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${period === item.key ? "bg-white text-[#176a3d] shadow-sm" : "text-[#7b877e] hover:text-[#314d3c]"}`}>{item.label}</button>)}</div>
          <button type="button" aria-label="Atualizar visão geral" disabled={loading || waitingForDates} onClick={() => setRevision(value => value + 1)} className="rounded-xl border border-[#e0e7e1] p-2.5 text-[#617569] disabled:opacity-40"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      </div>
      {period === "custom" && <form className="flex flex-wrap items-end gap-3 rounded-xl border border-[#e4e9e5] bg-[#f8faf8] p-3" onSubmit={event => { event.preventDefault(); setCustom(dates); setRevision(value => value + 1) }}>
        <label className="grid gap-1 text-xs text-[#617569]">De<input aria-label="Data inicial" type="date" required max={overviewLocalDay(new Date())} value={dates.from} onChange={event => setDates({ ...dates, from: event.target.value })} className="rounded-lg border border-[#dce5dd] bg-white p-2 text-[#314d3c]" /></label>
        <label className="grid gap-1 text-xs text-[#617569]">Até<input aria-label="Data final" type="date" required min={dates.from} max={overviewLocalDay(new Date())} value={dates.to} onChange={event => setDates({ ...dates, to: event.target.value })} className="rounded-lg border border-[#dce5dd] bg-white p-2 text-[#314d3c]" /></label>
        <button className="rounded-lg bg-[#176a3d] px-4 py-2.5 text-xs font-medium text-white" type="submit">Aplicar intervalo</button><span className="pb-2 text-[10px] text-[#849087]">Até 366 dias</span>
      </form>}
      {waitingForDates && <p className="py-12 text-center text-sm text-[#78827b]">Escolha as datas e aplique o intervalo.</p>}
      {loading && <div role="status" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-[104px] animate-pulse rounded-xl bg-[#f0f4f0]" />)}<span className="sr-only">Consultando as fontes da visão geral...</span></div>}
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle className="size-4 shrink-0" /><span>{error} Os totais estão indisponíveis. Use Atualizar para tentar novamente.</span></div>}
      {data && <>
        {data.journey.state.status !== "available" && <div role="status" className="flex items-start gap-2 rounded-xl border border-[#eadfc3] bg-[#fffcf4] px-3 py-2.5 text-xs leading-5 text-[#8b703e]"><AlertCircle className="mt-0.5 size-3.5 shrink-0" /><span><strong>{journey ? "Dados parciais. " : "Fonte indisponível. "}</strong>{data.journey.state.note}</span></div>}
        <section aria-label="Métricas principais" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <OverviewMetric id="visitors" label="Visitantes únicos" value={overviewNumber(totals?.visitors)} detail="Identidades anônimas distintas em page_view no período inteiro. Estimativa por navegador; não representa pessoas físicas exatas." status={journey ? "Estimado por navegador" : "Indisponível"} />
          <OverviewMetric id="sessions" label="Sessões" value={overviewNumber(totals?.sessions)} detail="SessionId distintos em page_view no período inteiro." status={trafficStatus} />
          <OverviewMetric id="pageViews" label="Page views" value={overviewNumber(totals?.pageViews)} detail="Eventos page_view recebidos; não soma landing_view ou visitas específicas de módulos." status={trafficStatus} />
          <OverviewMetric id="registrations" label="Novos cadastros" value={overviewNumber(data.registrations.count)} detail={data.registrations.state.note} status={data.registrations.count == null ? "Indisponível" : "Contas criadas • banco"} />
          <OverviewMetric id="signupStarted" label="Cadastros iniciados" value={overviewNumber(totals?.signupStarted)} detail="Sessões distintas com signup_started no período." status={trafficStatus} />
          <OverviewMetric id="signupCompleted" label="Cadastros concluídos" value={overviewNumber(totals?.signupCompleted)} detail="Usuários distintos com signup_completed confirmado pelo servidor. Pode diferir de contas criadas quando há lacunas na coleta." status={trafficStatus} />
          <OverviewMetric id="conversion" label="Landing → cadastro" value={rateLabel(conversion)} detail="Sessões da coorte que chegaram a signup_completed após landing_view e signup_started, divididas por sessões com landing_view. Mesma sessão e período." status={journey ? conversion == null ? "Sem base de conversão" : "Coorte por sessão" : "Indisponível"} />
          <OverviewMetric id="subscribers" label="Assinantes ativos" value={overviewNumber(data.subscribers.count)} detail={data.subscribers.state.note} status={data.subscribers.count == null ? "Indisponível" : `Estimado • atual${data.subscribers.pending ? ` · ${data.subscribers.pending} pendentes` : ""}`} />
          <OverviewMetric id="marketplaceViews" label="Marketplace views" value={overviewNumber(totals?.marketplaceViews)} detail="Eventos marketplace_view no período; não são visitantes únicos." status={trafficStatus} />
          <OverviewMetric id="catalogViews" label="Catálogo views" value={overviewNumber(totals?.catalogViews)} detail="Eventos catalog_view no período; não soma CatalogEvent legado." status={trafficStatus} />
          <OverviewMetric id="leads" label="Leads gerados" value={overviewNumber(totals?.leads)} detail="Eventos lead_created confirmados pelo servidor após a criação real." status={trafficStatus} />
          <OverviewMetric id="errors" label="Erros registrados" value={overviewNumber(totals?.errors)} detail="Apenas error_occurred. Não soma os eventos de falha específicos de cada etapa." status={trafficStatus} warning={Boolean(totals?.errors)} />
        </section>
        <OverviewSection title="Tráfego no período" description={data.period.key === "today" ? "Distribuição por hora, até a atualização atual." : "Distribuição diária. Hoje é um dia em andamento."} aside={<div className="flex gap-1">{([{ key: "views", label: "Views" }, { key: "visitors", label: "Únicos" }, { key: "sessions", label: "Sessões" }] as const).map(item => <button type="button" key={item.key} onClick={() => setChartMetric(item.key)} aria-pressed={chartMetric === item.key} className={`rounded-md px-2 py-1 text-[10px] ${chartMetric === item.key ? "bg-[#eaf5ef] text-[#176a3d]" : "text-[#849087]"}`}>{item.label}</button>)}</div>}>
          {journey ? <OverviewTrafficChart data={journey} hourly={data.period.key === "today"} metric={chartMetric} /> : <OverviewEmpty unavailable />}
        </OverviewSection>
        <div className="grid gap-4 xl:grid-cols-2">
          <OverviewSection title="Aquisição" description="Origens e dispositivos da primeira página de cada sessão no período.">
            <dl className="mb-5 grid grid-cols-3 gap-2 border-b border-[#edf1ed] pb-4">{[{ label: "Landing views", value: totals?.landingViews }, { label: "Sessões", value: totals?.sessions }, { label: "Visitantes únicos", value: totals?.visitors }].map(item => <div key={item.label}><dt className="text-[10px] text-[#849087]">{item.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[#254833]">{overviewNumber(item.value)}</dd></div>)}</dl>
            <div className="grid gap-5 sm:grid-cols-2"><div><h3 className="mb-3 text-xs font-medium text-[#314d3c]">Principais origens / referrers</h3><OverviewRanking rows={journey?.sources ?? []} unavailable={unavailable} unit="sessões" /></div><div><h3 className="mb-3 text-xs font-medium text-[#314d3c]">Dispositivos</h3><OverviewRanking rows={journey?.devices ?? []} labels={deviceLabels} unavailable={unavailable} unit="sessões" /></div></div>
          </OverviewSection>
          <OverviewSection title="Conversão" description="Sessões que começaram na landing e avançaram em ordem, dentro do período." aside={<OverviewBadge>Coorte por sessão</OverviewBadge>}>
            {journey ? <ol className="space-y-2">{journey.funnel.map((row, index) => {
              const rate = index ? overviewRate(row.count, journey.funnel[index - 1].count) : null
              return <li key={row.event} data-testid={`funnel-${row.event}`}><div className="flex items-center justify-between gap-3 rounded-lg bg-[#f7faf7] px-3 py-2"><span className="text-xs text-[#526158]"><span className="mr-2 text-[10px] text-[#a0aca3]">0{index + 1}</span>{OVERVIEW_EVENT_LABELS[row.event]}</span><div className="flex items-center gap-3"><span className="text-[10px] text-[#849087]" title="Eventos totais fora e dentro da coorte">{overviewNumber(row.total)} eventos</span><strong data-testid="funnel-count" className="min-w-6 text-right text-sm font-semibold tabular-nums text-[#254833]">{overviewNumber(row.count)}</strong></div></div>{index > 0 && <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-[#849087]"><ArrowDown className="size-3" />{rate == null ? "Sem base na etapa anterior" : `${rateLabel(rate)} da etapa anterior · ${overviewNumber(journey.funnel[index - 1].count - row.count)} sem avanço`}</div>}</li>
            })}</ol> : <OverviewEmpty unavailable />}
            <p className="mt-3 text-[10px] leading-relaxed text-[#8a958d]">Os números em destaque são sessões, não eventos. Retornos em outra sessão e conversões sem vínculo ficam fora desta coorte; “sem avanço” pode incluir jornadas ainda em andamento.</p>
          </OverviewSection>
          <OverviewSection title="Uso do produto" description="Navegação no portal e ações concluídas com ator autenticado. Visitas públicas não contam como uso do proprietário.">
            {journey?.modules.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={tableHead}>Módulo</th><th className={`${tableHead} text-right`}>Eventos de uso</th><th className={`${tableHead} text-right`}>Usuários únicos</th></tr></thead><tbody>{journey.modules.map(row => <tr key={row.label} className="border-t border-[#f0f3f0]"><td className={tableCell}>{OVERVIEW_MODULE_LABELS[row.label] ?? row.label}</td><td className={`${tableCell} text-right`}>{overviewNumber(row.count)}</td><td className={`${tableCell} text-right font-medium`}>{overviewNumber(row.users)}</td></tr>)}</tbody></table></div> : <OverviewEmpty unavailable={unavailable} />}
            <h3 className="mb-3 mt-5 text-xs font-medium text-[#314d3c]">Principais ações concluídas</h3><OverviewRanking rows={journey?.actions ?? []} labels={OVERVIEW_EVENT_LABELS} unavailable={unavailable} unit="ações" />
          </OverviewSection>
          <OverviewSection title="Marketplace / Catálogo" description="Eventos específicos de descoberta e interesse, sem somar as fontes legadas.">
            {journey ? <dl className="divide-y divide-[#edf1ed]">{journey.commerce.map(row => <div className="flex items-center justify-between gap-3 py-3" key={row.label}><dt className="text-xs text-[#66736b]">{OVERVIEW_EVENT_LABELS[row.label]}</dt><dd className="text-lg font-semibold tabular-nums text-[#254833]">{overviewNumber(row.count)}</dd></div>)}</dl> : <OverviewEmpty unavailable />}
            <p className="mt-3 text-[10px] leading-relaxed text-[#8a958d]">Leads incluem todos os canais instrumentados, inclusive CRM e COS. Aberturas e buscas medem ações; não equivalem a visitantes distintos.</p>
          </OverviewSection>
          <OverviewSection title="Erros e operação" description="Ocorrências recebidas, sem duplicar os eventos específicos de falha." aside={journey ? <OverviewBadge tone={totals?.errors ? "warning" : "neutral"}>{overviewNumber(totals?.errors)} erros</OverviewBadge> : undefined}>
            <dl className="mb-5 grid grid-cols-2 gap-3 border-b border-[#edf1ed] pb-4"><div><dt className="text-[10px] text-[#849087]">Usuários afetados</dt><dd className="text-xl font-semibold text-[#254833]">{overviewNumber(journey?.errors.users)}</dd></div><div><dt className="text-[10px] text-[#849087]">Sessões afetadas</dt><dd className="text-xl font-semibold text-[#254833]">{overviewNumber(journey?.errors.sessions)}</dd></div></dl>
            <div className="grid gap-5 sm:grid-cols-2"><div><h3 className="mb-3 text-xs font-medium text-[#314d3c]">Principais códigos</h3><OverviewRanking rows={journey?.errors.codes ?? []} unavailable={unavailable} /></div><div><h3 className="mb-3 text-xs font-medium text-[#314d3c]">Rotas mais afetadas</h3><OverviewRanking rows={journey?.errors.routes ?? []} unavailable={unavailable} /></div></div>
            <p className="mt-5 text-[10px] text-[#849087]">Última ocorrência: {journey ? displayDate(journey.errors.latest, true) : "Indisponível"}. Usuários e sessões podem se sobrepor.</p>
          </OverviewSection>
          <OverviewSection title="Rotas mais acessadas" description="Totais por pathname normalizado. IDs e slugs são ocultados pela coleta.">
            {journey?.routes.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className={tableHead}>Página</th><th className={`${tableHead} text-right`}>Views</th><th className={`${tableHead} text-right`}>Únicos</th><th className={`${tableHead} text-right`}>Sessões</th></tr></thead><tbody>{journey.routes.map(row => <tr key={row.label} className="border-t border-[#f0f3f0]"><td className={`${tableCell} max-w-40 break-words font-mono text-[10px]`}>{row.label}</td><td className={`${tableCell} text-right`}>{overviewNumber(row.count)}</td><td className={`${tableCell} text-right`}>{overviewNumber(row.visitors)}</td><td className={`${tableCell} text-right`}>{overviewNumber(row.sessions)}</td></tr>)}</tbody></table></div> : <OverviewEmpty unavailable={unavailable} />}
          </OverviewSection>
        </div>
        <details className="rounded-xl border border-[#e4e9e5] bg-[#f8faf8] px-4 py-3 text-xs text-[#738078]"><summary className="cursor-pointer font-medium text-[#526158]">Fontes, cobertura e critérios</summary><div className="mt-3 space-y-2 leading-5"><p>Tráfego e jornada usam somente Journey Analytics, sem somar CatalogEvent, SearchEvent ou AiOperationTelemetry. Bots identificados e rotas administrativas são excluídos. Cookies bloqueados, dispositivos compartilhados e falhas de coleta limitam a precisão.</p><p>{data.journey.state.note}</p><p>Primeiro evento recebido: {journey ? displayDate(journey.quality.firstReceivedAt, true) : "Indisponível"}. Último recebido: {journey ? displayDate(journey.quality.lastReceivedAt, true) : "Indisponível"}.</p><p>Cadastros: {data.registrations.state.note}</p><p>Assinantes (fotografia em {displayDate(data.subscribers.asOf, true)}): {data.subscribers.state.note}</p><p>Os dados de ativação incluem acessos de teste. Períodos sem cobertura anterior à ativação não representam ausência de tráfego.</p></div></details>
      </>}
    </div>
  </AdminPageShell>
}
