"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { Bot, Edit3, MessageCircle } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type AssessorStatus = "Em preparação" | "Ativo" | "Pausado"

export function AdminAssessorEmePage() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState({
    number: "",
    status: "Em preparação" as AssessorStatus,
    notes: "",
  })
  const hasNumber = config.number.trim().length > 0

  return (
    <AdminPageShell title="Assessor EME" subtitle="Canal oficial do EME para demandas operacionais dos corretores">
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <Bot className="size-5 text-[#69F0AE]" />
                Configuração do canal oficial
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0">
              <InfoBlock label="Número oficial" value={hasNumber ? config.number : "Canal em preparação"} />
              <InfoBlock label="Status" value={config.status} />
              <InfoBlock label="Observações internas" value={config.notes || "Nenhuma observação registrada."} />
              <Button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 h-10 w-fit rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
              >
                <Edit3 className="size-4" />
                Editar configuração
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-[#25D366]/20 bg-[linear-gradient(180deg,rgba(18,28,22,0.9),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <MessageCircle className="size-5 text-[#25D366]" />
                O que é
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <p className="text-sm leading-7 text-white/60">
                O Assessor EME é o WhatsApp oficial/principal do EME. É por esse canal que corretores conversam com a IA do sistema para cadastrar imóveis, procurar imóveis, cadastrar leads, gerar resumos e criar anúncios.
              </p>
              {!hasNumber ? (
                <div className="mt-5 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 p-4 text-sm text-[#69F0AE]">
                  Estado vazio pronto: defina o número oficial quando a operação liberar o canal.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-white/[0.08] bg-[#111111] text-white">
          <DialogHeader>
            <DialogTitle>Editar Assessor EME</DialogTitle>
            <DialogDescription className="text-white/55">
              Estrutura preparada para configurar o canal oficial. Nenhuma integração real de WhatsApp será criada aqui.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Número oficial do WhatsApp">
              <Input value={config.number} onChange={(event) => setConfig({ ...config, number: event.target.value })} placeholder="Canal em preparação" className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
            <Field label="Status">
              <select value={config.status} onChange={(event) => setConfig({ ...config, status: event.target.value as AssessorStatus })} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white outline-none">
                <option className="bg-[#111]">Em preparação</option>
                <option className="bg-[#111]">Ativo</option>
                <option className="bg-[#111]">Pausado</option>
              </select>
            </Field>
            <Field label="Observações/instruções internas">
              <Textarea value={config.notes} onChange={(event) => setConfig({ ...config, notes: event.target.value })} className="min-h-28 border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/35" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676]">
              Salvar estrutura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm text-white/55">{label}</span>
      {children}
    </label>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  )
}
