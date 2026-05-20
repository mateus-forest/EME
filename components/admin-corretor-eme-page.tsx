"use client"

import { useMemo, useState } from "react"
import { Eye, MessageCircle, UserRound } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import { useAdminBrokers, type AdminBrokerRecord } from "@/components/use-admin-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type CorretorEmeStatus = "Não configurado" | "Em preparação" | "Ativo" | "Pausado"

function integrationStatus(broker: AdminBrokerRecord): CorretorEmeStatus {
  if (!broker.whatsApp || broker.whatsApp === "-") return "Não configurado"
  if (broker.status === "Inativo") return "Pausado"
  return "Em preparação"
}

export function AdminCorretorEmePage() {
  const [brokers] = useAdminBrokers()
  const [selectedBroker, setSelectedBroker] = useState<AdminBrokerRecord | null>(null)
  const summary = useMemo(
    () => ({
      total: brokers.length,
      configured: brokers.filter((broker) => broker.whatsApp && broker.whatsApp !== "-").length,
      active: brokers.filter((broker) => integrationStatus(broker) === "Ativo").length,
      preparing: brokers.filter((broker) => integrationStatus(broker) === "Em preparação").length,
    }),
    [brokers],
  )

  return (
    <AdminPageShell title="Corretor EME" subtitle="WhatsApps dos corretores para pré-atendimento e qualificação de leads">
      <div className="grid gap-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric label="Corretores" value={String(summary.total)} icon={UserRound} />
          <Metric label="Números configurados" value={String(summary.configured)} icon={MessageCircle} />
          <Metric label="Integrações ativas" value={String(summary.active)} icon={MessageCircle} />
          <Metric label="Em preparação" value={String(summary.preparing)} icon={MessageCircle} />
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">Corretores e status de integração</CardTitle>
            <p className="text-sm text-white/50">Nenhum webhook real será criado nesta área. A estrutura acompanha configuração e preparação por corretor.</p>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-0">
            {brokers.length > 0 ? (
              brokers.map((broker) => (
                <div key={broker.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-base font-semibold text-white">{broker.name}</p>
                    <p className="mt-1 text-sm text-white/50">{broker.whatsApp || "WhatsApp não configurado"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={integrationStatus(broker)} />
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/60">
                      Atualizado em {broker.createdAt}
                    </span>
                    <Button type="button" variant="ghost" onClick={() => setSelectedBroker(broker)} className="h-8 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs text-white/75 hover:bg-white/[0.08] hover:text-white">
                      <Eye className="size-3.5" />
                      Detalhes
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-5 text-sm leading-6 text-[#69F0AE]">
                Nenhum corretor cadastrado ainda. Quando houver corretores, seus números e status do Corretor EME aparecerão aqui.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedBroker)} onOpenChange={(open) => !open && setSelectedBroker(null)}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-[#111111] text-white">
          {selectedBroker ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedBroker.name}</DialogTitle>
                <DialogDescription className="text-white/55">Detalhes preparados para acompanhamento do Corretor EME.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
                <Info label="WhatsApp" value={selectedBroker.whatsApp || "Não configurado"} />
                <Info label="Status da integração" value={integrationStatus(selectedBroker)} />
                <Info label="Última atualização" value={selectedBroker.createdAt} />
                <Info label="Observação" value="Integração real ainda não conectada." />
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof UserRound }) {
  return (
    <Card className="rounded-[1.5rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-sm text-white/55">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs text-[#69F0AE]">{status}</span>
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-2 text-sm text-white/78">{value}</p>
    </div>
  )
}
