"use client"

import { useState } from "react"
import {
  Copy,
  ExternalLink,
  Mail,
  MessageCircleMore,
  PencilLine,
  RefreshCw,
  Trash2,
  UserCheck,
} from "lucide-react"

import type { AgencyBroker } from "@/components/agency-brokers-data"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

type AgencyBrokerManagementModalProps = {
  broker: AgencyBroker | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (broker: AgencyBroker) => void
  onToggleStatus?: (broker: AgencyBroker) => void
  onSecondaryAction?: (broker: AgencyBroker) => void
  onDelete?: (broker: AgencyBroker) => void
}

export function AgencyBrokerManagementModal({
  broker,
  open,
  onOpenChange,
  onEdit,
  onToggleStatus,
  onSecondaryAction,
  onDelete,
}: AgencyBrokerManagementModalProps) {
  const [copyFeedback, setCopyFeedback] = useState(false)

  async function copyCatalogLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopyFeedback(true)
      window.setTimeout(() => setCopyFeedback(false), 1800)
    } catch {
      setCopyFeedback(false)
    }
  }

  function openCatalogLink(link: string) {
    const slug = link.split("/").pop() || "marina-costa"
    window.open(`/catalogo/${slug}`, "_blank", "noopener,noreferrer")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-6xl">
        {broker && (
          <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
            <DialogTitle className="sr-only">{broker.name}</DialogTitle>
            <DialogDescription className="sr-only">Gestão interna do corretor com desempenho, catálogo, imóveis e ações administrativas.</DialogDescription>

            <div className="grid gap-6">
              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex size-16 items-center justify-center rounded-full bg-[#00C853]/15 text-lg font-semibold text-[#69F0AE]">{broker.initials}</div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">{broker.name}</h3>
                          <span className={`rounded-full border px-3 py-1 text-xs ${broker.status === "Ativo" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.04] text-white/65"}`}>{broker.status}</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-white/60">
                          <div className="flex items-center gap-2"><UserCheck className="size-4 text-[#69F0AE]" /><span>CRECI {broker.creci}</span></div>
                          <div className="flex items-center gap-2"><Mail className="size-4 text-[#69F0AE]" /><span>{broker.email}</span></div>
                          <div className="flex items-center gap-2"><MessageCircleMore className="size-4 text-[#69F0AE]" /><span>{broker.whatsApp}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  <MetricCard title="Imóveis ativos" value={String(broker.properties)} />
                  <MetricCard title="Visualizações" value={broker.views} />
                  <MetricCard title="Cliques no WhatsApp" value={broker.clicks} />
                  <MetricCard title="Leads gerados" value={String(broker.leads)} />
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-6">
                  <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Catálogo</p>
                      <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
                        <ExternalLink className="size-4 shrink-0 text-white/35" />
                        <p className="min-w-0 truncate text-base font-medium text-white">{broker.catalogLink}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={() => copyCatalogLink(broker.catalogLink)} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                        <Copy className="size-4" />
                        {copyFeedback ? "Link copiado" : "Copiar link"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => openCatalogLink(broker.catalogLink)} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                        <ExternalLink className="size-4" />
                        Abrir catálogo
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-semibold text-white">Imóveis do corretor</p>
                        <p className="mt-1 text-sm text-white/50">Últimos imóveis publicados por {broker.name.split(" ")[0]}.</p>
                      </div>
                      <Button variant="ghost" onClick={() => openCatalogLink(broker.catalogLink)} className="h-9 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
                        Ver todos os imóveis
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {broker.recentProperties.map((property) => (
                        <div key={property.title} className="grid gap-4 rounded-[1.25rem] border border-white/[0.08] bg-black/20 p-4 md:grid-cols-[110px_minmax(0,1fr)_90px]">
                          <div className="overflow-hidden rounded-[1rem] border border-white/[0.08]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={property.image} alt={property.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base font-medium text-white">{property.title}</p>
                            <p className="mt-1 text-sm text-white/45">{property.location}</p>
                            <p className="mt-3 text-lg font-semibold text-white">{property.price}</p>
                          </div>
                          <div className="flex items-start md:justify-end">
                            <span className={`rounded-full border px-3 py-1.5 text-xs ${property.status === "Publicado" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-white/[0.08] bg-white/[0.04] text-white/65"}`}>{property.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
                    <p className="text-xl font-semibold text-white">Ações de gestão</p>
                    <div className="mt-4 grid gap-2.5">
                      <Button onClick={() => onEdit?.(broker)} className="h-10 rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
                        <PencilLine className="size-4" />
                        Editar corretor
                      </Button>
                      <Button variant="ghost" onClick={() => onToggleStatus?.(broker)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white">
                        <UserCheck className="size-4" />
                        {broker.actionLabel}
                      </Button>
                      <Button variant="ghost" onClick={() => onSecondaryAction?.(broker)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white">
                        <RefreshCw className="size-4" />
                        {broker.secondaryAction}
                      </Button>
                      <Button variant="ghost" onClick={() => onDelete?.(broker)} className="h-10 rounded-xl border border-[#ff6b6b]/15 bg-[#ff6b6b]/8 text-[#ff9b9b] hover:bg-[#ff6b6b]/12 hover:text-[#ffc1c1]">
                        <Trash2 className="size-4" />
                        Excluir corretor
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/50">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}
