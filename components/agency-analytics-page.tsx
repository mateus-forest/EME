"use client"

import { BarChart3 } from "lucide-react"

import { AgencyPageShell } from "@/components/agency-page-shell"

export function AgencyAnalyticsPage() {
  return (
    <AgencyPageShell
      title="Analytics"
      subtitle="Desempenho da sua operação"
      searchPlaceholder="Buscar corretor ou imóvel"
      searchValue=""
      onSearchChange={() => {}}
    >
      <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] p-8 text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <BarChart3 className="size-6" />
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-white">Analytics ainda sem dados reais</h3>
        <p className="mt-3 text-sm leading-7 text-white/55">
          Os datasets mock foram removidos. A tela agora aguarda indicadores reais para preencher gráficos e resumos.
        </p>
      </section>
    </AgencyPageShell>
  )
}
