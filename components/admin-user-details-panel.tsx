"use client"

import type { AdminUserDetails } from "@/lib/admin-user-details-contract"

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

function Definition({ label, value }: { label: string; value: string | number | null }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><span className="block text-[11px] uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-1 block break-words text-sm text-slate-900">{value ?? "Não informado"}</strong></div>
}

export function AdminUserDetailsPanel({ data, loading, error }: { data: AdminUserDetails | null; loading: boolean; error: string | null }) {
  if (loading) return <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">Carregando dados operacionais reais...</div>
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Conta e acesso</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Definition label="E-mail" value={data.user.email} />
          <Definition label="Plano / status" value={`${data.account.plan} · ${data.billing.subscriptionStatus}`} />
          <Definition label="Último acesso" value={data.user.lastLoginAt ? new Date(data.user.lastLoginAt).toLocaleString("pt-BR") : "Sem registro"} />
          <Definition label="CRECI" value={`${data.account.creci ?? "Não informado"} · ${data.account.creciStatus ?? "Sem status"}`} />
          <Definition label="Créditos disponíveis" value={data.account.creditsBalance} />
          <Definition label="Créditos usados" value={data.account.creditsUsed} />
          <Definition label="Dispositivos" value={data.devices.length} />
          <Definition label="Stripe" value={data.billing.stripeLinked ? "Conta vinculada" : "Sem vínculo"} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Operação do corretor</h3>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Definition label="Imóveis" value={data.operation.properties} /><Definition label="Clientes" value={data.operation.clients} />
          <Definition label="Propostas" value={data.operation.proposals} /><Definition label="Contratos" value={data.operation.contracts} />
          <Definition label="Interações COS" value={data.operation.cosInteractions} /><Definition label="Campanhas Studio" value={data.operation.studioCampaigns} />
          <Definition label="Assets Studio" value={data.operation.studioAssets} /><Definition label="Operações IA" value={data.operation.aiOperations} />
          <Definition label="Créditos IA" value={data.operation.aiCredits} /><Definition label="Custo IA registrado" value={money(data.operation.aiCostBrl)} />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Catálogo</h3><p className="mt-1 text-xs text-slate-500">{data.catalog.status} · {data.catalog.slug ?? "sem slug"}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><span><strong className="block text-base">{data.catalog.publishedProperties}</strong>imóveis</span><span><strong className="block text-base">{data.catalog.views}</strong>acessos</span><span><strong className="block text-base">{data.catalog.contacts}</strong>contatos</span><span><strong className="block text-base">{data.catalog.shares}</strong>shares</span></div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Marketplace</h3><p className="mt-1 text-xs text-slate-500">Perfil {data.marketplace.profileStatus.toLowerCase()}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><span><strong className="block text-base">{data.marketplace.publishedProperties}</strong>imóveis</span><span><strong className="block text-base">{data.marketplace.views}</strong>acessos</span><span><strong className="block text-base">{data.marketplace.leads}</strong>leads</span><span><strong className="block text-base">{data.marketplace.conversations}</strong>conversas</span></div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Clientes cadastrados ({data.clients.length})</h3>
        <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Imóvel vinculado</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.clients.map((client) => <tr key={client.id}><td className="px-4 py-3 font-medium">{client.name}</td><td className="px-4 py-3">{client.status}</td><td className="px-4 py-3">{client.source}</td><td className="whitespace-nowrap px-4 py-3">{new Date(client.createdAt).toLocaleDateString("pt-BR")}</td><td className="max-w-[240px] break-words px-4 py-3">{client.property ?? "Sem imóvel vinculado"}</td></tr>)}</tbody>
          </table>
          {!data.clients.length ? <p className="p-6 text-center text-sm text-slate-500">Nenhum cliente cadastrado para este usuário.</p> : null}
        </div>
      </section>

      <section><h3 className="mb-2 text-sm font-semibold text-slate-900">Cobrança e pacotes</h3><p className="text-sm text-slate-600">Assinatura local: {data.billing.localSubscriptionStatus ?? "sem assinatura"}. Compras reais registradas: {data.billing.recentPurchases.length}.</p></section>
    </div>
  )
}
