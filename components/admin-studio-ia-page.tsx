"use client"

import { ImageIcon, Megaphone, Sparkles, Video, Wand2 } from "lucide-react"

import {
  AdminDefinitionGrid,
  AdminKpiList,
  AdminMetricCard,
  AdminMetricGrid,
  AdminMiniChart,
  AdminSurface,
} from "@/components/admin-insights-ui"
import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminInsights } from "@/components/use-admin-insights"
import { EmeLoading } from "@/components/ui/eme-loading"

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AdminStudioIaPage() {
  const { insights, isLoading, error } = useAdminInsights()

  return (
    <AdminPageShell title="Studio IA" subtitle="Dashboard completo do estúdio criativo com foco em geração, consumo e valor entregue">
      {isLoading && !insights ? <EmeLoading message="Carregando Studio IA..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Imagens criadas" value={String(insights.studioIa.imagesCreated)} icon={<ImageIcon className="size-5" />} />
            <AdminMetricCard label="Videos criados" value={String(insights.studioIa.videosCreated)} icon={<Video className="size-5" />} />
            <AdminMetricCard label="Creditos usados" value={String(insights.studioIa.creditsUsed)} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Economia estimada" value={formatCurrency(insights.studioIa.estimatedSavings)} icon={<Wand2 className="size-5" />} tone="success" />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Painel de geracao" subtitle="Tudo que o Studio IA já gerou ou apoiou dentro da plataforma.">
              <AdminDefinitionGrid
                columns={3}
                items={[
                  { label: "Home staging", value: String(insights.studioIa.homeStaging) },
                  { label: "Anuncios", value: String(insights.studioIa.anuncios) },
                  { label: "Posts Instagram", value: String(insights.studioIa.postsInstagram) },
                  { label: "Descricoes", value: String(insights.studioIa.descriptions) },
                  { label: "Captacoes", value: String(insights.studioIa.captacoes) },
                  { label: "Consumo IA", value: String(insights.studioIa.aiConsumption) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Ranking de funcionalidades" subtitle="Onde o uso do Studio IA está mais concentrado.">
              <AdminKpiList rows={insights.studioIa.consumptionByFeature} />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Geracao por dia" subtitle="Últimos 7 dias." points={insights.studioIa.generationByDay} />
            <AdminMiniChart title="Uso mensal" subtitle="Últimos 6 meses." points={insights.studioIa.usageByMonth} />
            <AdminMiniChart
              title="Ranking de uso"
              subtitle="Corretores com maior profundidade de consumo."
              points={insights.studioIa.ranking.map((row) => ({ label: row.label.split(" ")[0] || row.label, value: row.value }))}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AdminSurface title="Recursos mais utilizados" subtitle="Créditos consumidos por frente criativa.">
              <AdminKpiList rows={insights.studioIa.consumptionByFeature} />
            </AdminSurface>

            <AdminSurface title="Corretores com maior uso" subtitle="Quem mais usa o Studio IA para acelerar operação.">
              <AdminKpiList rows={insights.studioIa.ranking} />
            </AdminSurface>
          </section>

          <AdminMetricGrid>
            <AdminMetricCard label="Instagram" value={`${insights.studioIa.postsInstagram} campanhas`} icon={<Megaphone className="size-5" />} />
            <AdminMetricCard label="Video" value={`${insights.studioIa.videosCreated} entregas`} icon={<Video className="size-5" />} tone="success" />
            <AdminMetricCard label="Imagem" value={`${insights.studioIa.imagesCreated} geracoes`} icon={<ImageIcon className="size-5" />} />
            <AdminMetricCard label="Economia" value={formatCurrency(insights.studioIa.estimatedSavings)} icon={<Wand2 className="size-5" />} tone="success" />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
