"use client"

import { BookImage, FileText, ImageIcon, Megaphone, Sparkles, Video, Wand2 } from "lucide-react"

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
    <AdminPageShell title="Studio IA" subtitle="Visão real da produção criativa, biblioteca e consumo operacional">
      {isLoading && !insights ? <EmeLoading message="Carregando Studio IA..." /> : null}
      {error ? <div className="mb-5 rounded-[1.25rem] border border-[#f3d4d4] bg-[#fff3f3] px-4 py-3 text-sm text-[#b42318]">{error}</div> : null}

      {insights ? (
        <div className="grid gap-5">
          <AdminMetricGrid>
            <AdminMetricCard label="Campanhas" value={String(insights.studioIa.campaigns)} icon={<Megaphone className="size-5" />} />
            <AdminMetricCard label="Assets na biblioteca" value={String(insights.studioIa.libraryAssets)} icon={<BookImage className="size-5" />} />
            <AdminMetricCard label="Créditos IA usados" value={String(insights.studioIa.creditsUsed)} icon={<Sparkles className="size-5" />} />
            <AdminMetricCard label="Economia estimada" value={formatCurrency(insights.studioIa.estimatedSavings)} icon={<Wand2 className="size-5" />} tone="success" />
          </AdminMetricGrid>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <AdminSurface title="Produção do Studio IA" subtitle="Tudo o que já foi gerado com base nos dados reais dos corretores.">
              <AdminDefinitionGrid
                columns={4}
                items={[
                  { label: "Imagens", value: String(insights.studioIa.imagesCreated) },
                  { label: "Posts", value: String(insights.studioIa.postsCreated) },
                  { label: "Stories", value: String(insights.studioIa.storiesCreated) },
                  { label: "Vídeos", value: String(insights.studioIa.videosCreated) },
                  { label: "Campanhas", value: String(insights.studioIa.campaigns) },
                  { label: "Anúncios", value: String(insights.studioIa.anuncios) },
                  { label: "Descrições", value: String(insights.studioIa.descriptions) },
                  { label: "Biblioteca", value: String(insights.studioIa.libraryItems) },
                ]}
              />
            </AdminSurface>

            <AdminSurface title="Leitura executiva" subtitle="Onde o uso do Studio IA está concentrado agora.">
              <AdminDefinitionGrid
                items={[
                  { label: "Instagram", value: `${insights.studioIa.postsInstagram} campanhas` },
                  { label: "Captação", value: `${insights.studioIa.captacoes} campanhas` },
                  { label: "Transformação", value: `${insights.studioIa.homeStaging} campanhas` },
                  { label: "Custo OpenAI", value: formatCurrency(insights.aiConsumption.openAiCost) },
                ]}
              />
            </AdminSurface>
          </section>

          <section className="grid gap-5 xl:grid-cols-3">
            <AdminMiniChart title="Geração por dia" subtitle="Últimos 7 dias" points={insights.studioIa.generationByDay} />
            <AdminMiniChart title="Uso mensal" subtitle="Últimos 6 meses" points={insights.studioIa.usageByMonth} />
            <AdminMiniChart
              title="Ranking por corretor"
              subtitle="Quem mais alimenta o Studio IA"
              points={insights.studioIa.ranking.map((row) => ({ label: row.label.split(" ")[0] || row.label, value: row.value }))}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <AdminSurface title="Recursos mais usados" subtitle="Distribuição por tipo de entrega criativa.">
              <AdminKpiList rows={insights.studioIa.consumptionByFeature} />
            </AdminSurface>

            <AdminSurface title="Corretores com maior uso" subtitle="Adoção real do Studio IA pela operação.">
              <AdminKpiList rows={insights.studioIa.ranking} />
            </AdminSurface>
          </section>

          <AdminMetricGrid>
            <AdminMetricCard label="Posts" value={`${insights.studioIa.postsCreated}`} icon={<Megaphone className="size-5" />} />
            <AdminMetricCard label="Stories" value={`${insights.studioIa.storiesCreated}`} icon={<ImageIcon className="size-5" />} />
            <AdminMetricCard label="Vídeos" value={`${insights.studioIa.videosCreated}`} icon={<Video className="size-5" />} />
            <AdminMetricCard label="Descrições" value={`${insights.studioIa.descriptions}`} icon={<FileText className="size-5" />} />
          </AdminMetricGrid>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
