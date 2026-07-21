"use client"

import { CheckCircle2 } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"

export function AdminAlertsPage() {
  return (
    <AdminPageShell title="Alertas" subtitle="Acompanhe os principais pontos de atenção da plataforma">
      <section className="rounded-[1.75rem] border border-black/[0.06] bg-white p-8 text-center shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
          <CheckCircle2 className="size-6" />
        </div>
        <h3 className="mt-4 text-2xl font-semibold text-[#111111]">Nenhum alerta operacional</h3>
        <p className="mt-3 text-sm leading-7 text-[#6B7280]">
          Os alertas reais aparecerão aqui quando houver atividade operacional suficiente para monitoramento.
        </p>
      </section>
    </AdminPageShell>
  )
}
