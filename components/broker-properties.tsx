"use client"

import { PropertyCard } from "@/components/property-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { BrokerProperty } from "@/components/use-broker-properties"

type BrokerPropertiesProps = {
  properties: BrokerProperty[]
  onUpgradeClick: () => void
}

export function BrokerProperties({ properties, onUpgradeClick }: BrokerPropertiesProps) {
  const featuredProperties = properties.slice(0, 3)

  return (
    <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <CardHeader className="border-b border-black/[0.06] px-6 py-5">
          <div>
            <CardTitle className="text-xl text-[#050505]">Imóveis em destaque</CardTitle>
            <p className="mt-1 text-sm text-[#6B7280]">
              Um preview visual dos imóveis que estão puxando sua vitrine agora.
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
          {featuredProperties.length > 0 ? (
            featuredProperties.map((property, index) => {
              const badge =
                index === 0 ? "Mais acessado" : index === 1 ? "Mais visualizado" : "Mais recente"

              return (
                <PropertyCard
                  key={property.id}
                  title={property.title}
                  location={property.location}
                  price={property.price}
                  bedrooms={property.bedrooms}
                  bathrooms={property.bathrooms}
                  parking={property.parking}
                  image={property.images[0]}
                  imageSeed={property.id}
                  contentClassName="gap-3"
                  badges={
                    <span className="inline-flex items-center rounded-full border border-[#009b3a]/20 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-[#009b3a] backdrop-blur-md">
                      {badge}
                    </span>
                  }
                />
              )
            })
          ) : (
            <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-8 text-center text-sm text-[#6B7280] lg:col-span-2 2xl:col-span-3">
              Nenhum imóvel disponível para destaque.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6">
        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardContent className="p-5 sm:p-6">
            <div className="inline-flex rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-[#009b3a]">
              Próxima ação
            </div>
            <h3 className="mt-5 text-xl font-semibold text-[#050505]">
              Configure seu plano quando estiver pronto para escalar.
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Limites, assinatura, COS e créditos IA ficam organizados na tela Plano.
            </p>
            <Button
              type="button"
              onClick={onUpgradeClick}
              className="mt-6 h-11 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
            >
              Ver plano e pacotes
            </Button>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-lg text-[#050505]">Resumo rápido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0 sm:p-6 sm:pt-0">
            <div className="min-w-0 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4">
              <p className="text-sm text-[#6B7280]">Imóvel em destaque</p>
              <p className="mt-2 truncate text-lg font-semibold text-[#050505]">
                {featuredProperties[0]?.title ?? "Sem destaque"}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4">
              <p className="text-sm text-[#6B7280]">Imóveis publicados</p>
              <p className="mt-2 text-lg font-semibold text-[#050505]">
                {featuredProperties.filter((property) => property.status === "Publicado").length}
              </p>
            </div>
            <div className="min-w-0 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4">
              <p className="text-sm text-[#6B7280]">Resumo</p>
              <p className="mt-2 text-lg font-semibold text-[#050505]">Operação pronta</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
