"use client"

import type { ReactNode } from "react"

import type { AdminUserDetails } from "@/lib/admin-user-details-contract"

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function Section({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Definition({ label, value, emphasized = false }: { label: string; value: string | number | null; emphasized?: boolean }) {
  return (
    <div className={`min-w-0 rounded-xl p-3.5 ${emphasized ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-slate-50"}`}>
      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <strong className={`mt-1.5 block [overflow-wrap:anywhere] text-sm ${emphasized ? "text-emerald-800" : "text-slate-900"}`}>{value ?? "Não informado"}</strong>
    </div>
  )
}

export function AdminUserDetailsPanel({ data, loading, error }: { data: AdminUserDetails | null; loading: boolean; error: string | null }) {
  if (loading) return <div className="rounded-2xl bg-slate-50 p-10 text-center text-sm text-slate-500">Carregando dados operacionais reais...</div>
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-5 pb-1">
      {data.unavailableBlocks.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Alguns dados estão temporariamente indisponíveis: {data.unavailableBlocks.join(", ")}.
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <Section title="Conta e plano" description="Identificação, assinatura, CRECI e último acesso da conta.">
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <Definition label="E-mail" value={data.user.email} />
            <Definition label="Plano / status" value={`${data.account.plan} · ${data.billing.subscriptionStatus}`} emphasized />
            <Definition label="Último acesso" value={data.user.lastAccessAt ? new Date(data.user.lastAccessAt).toLocaleString("pt-BR") : "Sem registro"} />
            <Definition label="CRECI" value={`${data.account.creci ?? "Não informado"} · ${data.account.creciStatus ?? "Sem status"}`} />
            <Definition label="Status do corretor" value={data.account.brokerStatus} />
            <Definition label="Créditos disponíveis" value={data.account.creditsBalance} />
            <Definition label="Créditos usados" value={data.account.creditsUsed} />
            <Definition label="Stripe" value={data.billing.stripeLinked ? "Conta vinculada" : "Sem vínculo"} />
          </div>
        </Section>

        <Section title="Acessos e dispositivos" description={`${data.devices.length} dispositivo(s) registrado(s).`}>
          <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {data.devices.map((device) => (
              <div key={device.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-sm">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <strong className="min-w-0 [overflow-wrap:anywhere] text-slate-900">{device.label}</strong>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${device.status === "Confiável" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{device.status}</span>
                </div>
                <span className="mt-1.5 block [overflow-wrap:anywhere] text-xs text-slate-500">{[device.browser, device.platform].filter(Boolean).join(" · ") || "Detalhes não informados"}</span>
                <span className="mt-2 block text-xs text-slate-600">{device.lastAccessAt ? new Date(device.lastAccessAt).toLocaleString("pt-BR") : "Sem acesso registrado"}</span>
              </div>
            ))}
            {!data.devices.length ? <p className="text-sm text-slate-500">Nenhum dispositivo confiável registrado.</p> : null}
          </div>
        </Section>
      </div>

      <Section title="Atividade operacional" description="Visão consolidada da carteira, atendimento e uso das ferramentas EME.">
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Clientes e imóveis</h4>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
              <Definition label="Imóveis" value={data.operation.properties} />
              <Definition label="Publicados" value={data.operation.publishedProperties} />
              <Definition label="Clientes" value={data.operation.clients} />
              <Definition label="Propostas" value={data.operation.proposals} />
              <Definition label="Contratos" value={data.operation.contracts} />
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">COS e Inteligência Artificial</h4>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
              <Definition label="Interações COS" value={data.operation.cosInteractions} />
              <Definition label="Operações IA" value={data.operation.aiOperations} />
              <Definition label="Créditos IA" value={data.operation.aiCredits} />
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Studio IA</h4>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
              <Definition label="Campanhas" value={data.operation.studioCampaigns} />
              <Definition label="Assets" value={data.operation.studioAssets} />
              <Definition label="Custo registrado" value={money(data.operation.aiCostBrl)} />
            </div>
          </div>
        </div>
      </Section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Section title="Catálogo" description={data.catalog.status}>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Definition label="Endereço" value={data.catalog.slug ? `/catalogo/${data.catalog.slug}` : null} />
            <Definition label="Imóveis publicados" value={data.catalog.publishedProperties} />
            <Definition label="Acessos" value={data.catalog.views} />
            <Definition label="Contatos" value={data.catalog.contacts} />
            <Definition label="Compartilhamentos" value={data.catalog.shares} />
          </div>
        </Section>
        <Section title="Marketplace" description={`Perfil ${data.marketplace.profileStatus.toLowerCase()}`}>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Definition label="Imóveis publicados" value={data.marketplace.publishedProperties} />
            <Definition label="Acessos" value={data.marketplace.views} />
            <Definition label="Leads" value={data.marketplace.leads} />
            <Definition label="Conversas" value={data.marketplace.conversations} />
          </div>
        </Section>
      </div>

      <Section title={`Clientes cadastrados (${data.clients.length})`} description="Status comercial, origem e imóvel vinculado de cada cliente.">
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr><th className="px-4 py-3.5">Cliente</th><th className="px-4 py-3.5">Status</th><th className="px-4 py-3.5">Origem</th><th className="px-4 py-3.5">Data</th><th className="px-4 py-3.5">Imóvel vinculado</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.clients.map((client) => (
                <tr key={client.id} className="align-top">
                  <td className="max-w-[280px] px-4 py-3.5 font-medium [overflow-wrap:anywhere]">{client.name ?? "Não informado"}</td>
                  <td className="px-4 py-3.5">{client.status}</td>
                  <td className="max-w-[220px] px-4 py-3.5 [overflow-wrap:anywhere]">{client.source}</td>
                  <td className="whitespace-nowrap px-4 py-3.5">{new Date(client.createdAt).toLocaleDateString("pt-BR")}</td>
                  <td className="max-w-[320px] px-4 py-3.5 [overflow-wrap:anywhere]">{client.property ?? "Sem imóvel vinculado"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.clients.length ? <p className="p-8 text-center text-sm text-slate-500">Nenhum cliente cadastrado para este usuário.</p> : null}
        </div>
      </Section>

      <Section title="Créditos, assinatura e cobranças" description={`Assinatura local: ${data.billing.localSubscriptionStatus ?? "sem assinatura"}.`}>
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Definition label="Plano" value={data.account.plan} />
          <Definition label="Status da assinatura" value={data.billing.subscriptionStatus} />
          <Definition label="Créditos disponíveis" value={data.account.creditsBalance} emphasized />
          <Definition label="Compras registradas" value={data.billing.recentPurchases.length} />
        </div>
        {data.billing.recentPurchases.length ? (
          <div className="grid min-w-0 gap-2.5 lg:grid-cols-2">
            {data.billing.recentPurchases.map((purchase) => (
              <div key={purchase.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 [overflow-wrap:anywhere]">{purchase.type} · {purchase.quantity} unidade(s)</span>
                <span className="shrink-0 text-xs text-slate-500">{money(purchase.amountCents / 100)} · {purchase.status} · {new Date(purchase.createdAt).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">Nenhuma compra adicional registrada.</p>}
      </Section>
    </div>
  )
}
