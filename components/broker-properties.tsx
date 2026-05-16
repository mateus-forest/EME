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
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_22px_50px_rgba(0,0,0,0.18)]">
        <CardHeader className="border-b border-white/[0.08] px-6 py-5">
          <div>
            <CardTitle className="text-xl text-white">Imóveis em destaque</CardTitle>
            <p className="mt-1 text-sm text-white/50">
              Um preview visual dos imóveis que estão puxando sua vitrine agora.
            </p>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2 2xl:grid-cols-3">
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
                    <span className="inline-flex items-center rounded-full border border-[#00C853]/20 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-[#69F0AE] backdrop-blur-md">
                      {badge}
                    </span>
                  }
                />
              )
            })
          ) : (
            <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-white/55 lg:col-span-2 2xl:col-span-3">
              Nenhum imóvel disponível para destaque.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card className="rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_22px_50px_rgba(0,0,0,0.18)]">
          <CardContent className="p-5 sm:p-6">
            <div className="inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-[#69F0AE]">
              Próxima ação
            </div>
            <h3 className="mt-5 text-xl font-semibold text-white">
              Configure seu plano quando estiver pronto para escalar.
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/55">
              Limites, pacotes, Corretor M e créditos IA ficam organizados na tela Plano.
            </p>
            <Button
              type="button"
              onClick={onUpgradeClick}
              className="mt-6 h-11 w-full rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
            >
              Ver plano e pacotes
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_22px_50px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-lg text-white">Resumo rápido</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-5 pt-0 sm:p-6 sm:pt-0">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-sm text-white/50">Imóvel em destaque</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {featuredProperties[0]?.title ?? "Sem destaque"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-sm text-white/50">Imóveis publicados</p>
              <p className="mt-2 text-lg font-semibold text-white">
                {featuredProperties.filter((property) => property.status === "Publicado").length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-sm text-white/50">Resumo</p>
              <p className="mt-2 text-lg font-semibold text-white">Operação pronta</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
