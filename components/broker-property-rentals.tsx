"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, CircleDollarSign, ClipboardList, FileText, History, KeyRound, Plus, UserRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export type RentalRecord = {
  id: string
  propertyId: string
  property: { id: string; title: string; purpose: string; rentalAvailable: boolean }
  tenant: { id: string; name: string | null; phone: string | null; email: string | null }
  owner: { id: string; name: string | null; phone: string | null; email: string | null } | null
  ownerName: string | null
  contract: { id: string; title: string; status: string } | null
  monthlyRent: number
  dueDay: number
  startDate: string
  endDate: string | null
  adjustmentIndex: string
  adjustmentOther: string | null
  guaranteeType: string
  guaranteeOther: string | null
  notes: string | null
  status: "ACTIVE" | "ENDED"
  nextAdjustmentDate: string | null
  endedAt: string | null
  payments: Array<{ id: string; competence: string; amount: number; dueDate: string; paidAt: string | null; status: string; notes: string | null }>
  adjustments: Array<{ id: string; previousAmount: number; percentage: number | null; indexLabel: string | null; newAmount: number; effectiveDate: string }>
  issues: Array<{ id: string; type: string; title: string; description: string | null; priority: string; status: string; eventDate: string }>
}

type RentalProperty = { id: string; title: string; purpose: string; ownerName: string }
type LeadOption = { id: string; name: string; phone: string; email: string }
type ContractOption = { id: string; title: string; leadId: string | null; propertyId: string | null }

export function useBrokerRentals() {
  const [rentals, setRentals] = useState<RentalRecord[]>([])
  const [availability, setAvailability] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/properties/rentals", { cache: "no-store" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Não foi possível carregar as locações.")
      setRentals(Array.isArray(data?.rentals) ? data.rentals : [])
      setAvailability(Object.fromEntries((Array.isArray(data?.propertyAvailability) ? data.propertyAvailability : []).map((item: { id: string; rentalAvailable: boolean }) => [item.id, item.rentalAvailable])))
      setError("")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar as locações.")
    } finally {
      setIsLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const activeByProperty = useMemo(() => Object.fromEntries(rentals.filter((item) => item.status === "ACTIVE").map((item) => [item.propertyId, item])), [rentals])
  const byProperty = useMemo(() => rentals.reduce<Record<string, RentalRecord[]>>((groups, item) => {
    groups[item.propertyId] = [...(groups[item.propertyId] ?? []), item]
    return groups
  }, {}), [rentals])
  return { rentals, availability, activeByProperty, byProperty, isLoading, error, refresh }
}

export function RentalStatusBadge({ purpose, active, available, hasHistory }: { purpose: string; active: boolean; available: boolean; hasHistory: boolean }) {
  if (purpose !== "Locação") return null
  const label = active ? "Locação ativa" : available ? "Disponível para aluguel" : hasHistory ? "Locação encerrada" : "Indisponível"
  return <Badge className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "border-[#009b3a]/20 bg-[#eaf8ef] text-[#078338]" : "border-black/[0.07] bg-white/90 text-[#5F6B7A]"}`}><KeyRound className="mr-1 size-3" />{label}</Badge>
}

export function BrokerRentalStartDialog({ property, open, onOpenChange, onCreated }: { property: RentalProperty | null; open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [form, setForm] = useState({ tenantLeadId: "", ownerLeadId: "", ownerName: "", contractDocumentId: "", monthlyRent: "", dueDay: "10", startDate: "", endDate: "", adjustmentIndex: "IPCA", adjustmentOther: "", guaranteeType: "CAUÇÃO", guaranteeOther: "", notes: "" })
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !property) return
    setForm((current) => ({ ...current, ownerName: property.ownerName || "", startDate: new Date().toISOString().slice(0, 10) }))
    void Promise.all([
      fetch("/api/brokers/leads", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/brokers/contracts", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([leadData, contractData]) => {
      setLeads(Array.isArray(leadData?.leads) ? leadData.leads : [])
      setContracts(Array.isArray(contractData?.contracts) ? contractData.contracts : [])
    }).catch(() => setError("Não foi possível carregar clientes e contratos."))
  }, [open, property])

  async function submit() {
    if (!property) return
    setIsSaving(true)
    setError("")
    try {
      let contractDocumentId = form.contractDocumentId
      if (contractFile) {
        if (!form.tenantLeadId) throw new Error("Selecione o locatário antes de anexar o contrato.")
        const payload = new FormData()
        payload.set("leadId", form.tenantLeadId)
        payload.set("propertyId", property.id)
        payload.set("kind", "Locação residencial")
        payload.set("title", `Contrato de locação - ${property.title}`)
        payload.set("file", contractFile)
        const uploadResponse = await fetch("/api/brokers/contracts", { method: "POST", body: payload })
        const uploadData = await uploadResponse.json().catch(() => null)
        if (!uploadResponse.ok) throw new Error(uploadData?.error || "Não foi possível anexar o contrato.")
        contractDocumentId = uploadData?.contract?.id || uploadData?.document?.id || ""
      }
      const response = await fetch("/api/properties/rentals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: property.id, ...form, contractDocumentId }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Não foi possível iniciar a locação.")
      onOpenChange(false)
      onCreated()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível iniciar a locação.")
    } finally { setIsSaving(false) }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] max-w-[calc(100%-1.5rem)] overflow-y-auto rounded-[1.5rem] border-black/[0.06] bg-white p-0 sm:max-w-3xl">
      <div className="border-b border-black/[0.06] px-6 py-5"><DialogTitle>Iniciar locação</DialogTitle><DialogDescription className="mt-1">Relacione as pessoas, o contrato e as condições operacionais de {property?.title}.</DialogDescription></div>
      <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
        <RentalField label="Locatário"><Select value={form.tenantLeadId} onValueChange={(value) => setForm({ ...form, tenantLeadId: value })}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{leads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.name || lead.phone || lead.email}</SelectItem>)}</SelectContent></Select><Link href="/corretor/clientes" className="mt-1 inline-flex text-xs font-medium text-[#008633]">+ Cadastrar novo cliente</Link></RentalField>
        <RentalField label="Proprietário"><Select value={form.ownerLeadId || "manual"} onValueChange={(value) => { const lead = leads.find((item) => item.id === value); setForm({ ...form, ownerLeadId: value === "manual" ? "" : value, ownerName: lead?.name || form.ownerName }) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Informar manualmente</SelectItem>{leads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.name || lead.phone || lead.email}</SelectItem>)}</SelectContent></Select><Input className="mt-2" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} placeholder="Nome do proprietário" /></RentalField>
        <RentalField label="Contrato"><Select value={form.contractDocumentId} onValueChange={(value) => setForm({ ...form, contractDocumentId: value })}><SelectTrigger><SelectValue placeholder="Selecione um contrato" /></SelectTrigger><SelectContent>{contracts.map((contract) => <SelectItem key={contract.id} value={contract.id}>{contract.title}</SelectItem>)}</SelectContent></Select><Input className="mt-2" type="file" accept=".pdf,.doc,.docx" onChange={(event) => setContractFile(event.target.files?.[0] ?? null)} /><Link href="/corretor/documentos/contratos" className="mt-1 inline-flex text-xs font-medium text-[#008633]">Criar ou relacionar em Contratos</Link></RentalField>
        <RentalField label="Valor mensal"><Input value={form.monthlyRent} onChange={(event) => setForm({ ...form, monthlyRent: event.target.value })} placeholder="R$ 0,00" inputMode="decimal" /></RentalField>
        <RentalField label="Dia de vencimento"><Input type="number" min={1} max={31} value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: event.target.value })} /></RentalField>
        <RentalField label="Data de início"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></RentalField>
        <RentalField label="Data de término"><Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></RentalField>
        <RentalField label="Índice de reajuste"><Select value={form.adjustmentIndex} onValueChange={(value) => setForm({ ...form, adjustmentIndex: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IPCA">IPCA</SelectItem><SelectItem value="IGP-M">IGP-M</SelectItem><SelectItem value="OUTRO">Outro</SelectItem></SelectContent></Select>{form.adjustmentIndex === "OUTRO" ? <Input className="mt-2" value={form.adjustmentOther} onChange={(event) => setForm({ ...form, adjustmentOther: event.target.value })} placeholder="Informe o índice" /> : null}</RentalField>
        <RentalField label="Garantia"><Select value={form.guaranteeType} onValueChange={(value) => setForm({ ...form, guaranteeType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CAUÇÃO">Caução</SelectItem><SelectItem value="FIADOR">Fiador</SelectItem><SelectItem value="SEGURO-FIANÇA">Seguro-fiança</SelectItem><SelectItem value="SEM GARANTIA">Sem garantia</SelectItem><SelectItem value="OUTRO">Outro</SelectItem></SelectContent></Select>{form.guaranteeType === "OUTRO" ? <Input className="mt-2" value={form.guaranteeOther} onChange={(event) => setForm({ ...form, guaranteeOther: event.target.value })} placeholder="Informe a garantia" /> : null}</RentalField>
        <div className="md:col-span-2"><RentalField label="Observações"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></RentalField></div>
        {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">{error}</div> : null}
      </div>
      <DialogFooter className="border-t border-black/[0.06] px-6 py-4"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void submit()} disabled={isSaving} className="bg-[#009b3a] text-white">{isSaving ? "Iniciando..." : "Iniciar locação"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

export function BrokerPropertyRentalPanel({ property, rentals, available, onStart, onChanged }: { property: RentalProperty; rentals: RentalRecord[]; available: boolean; onStart: () => void; onChanged: () => void }) {
  const active = rentals.find((item) => item.status === "ACTIVE")
  const [action, setAction] = useState<"payment" | "adjustment" | "issue" | "end" | null>(null)
  if (property.purpose !== "Locação") return null
  return <section className="grid gap-4 rounded-[1.25rem] border border-[#009b3a]/12 bg-[#f7fbf8] p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#008633]">Gestão de locação</p><h3 className="mt-1 text-lg font-semibold">{active ? "Locação ativa" : available ? "Disponível para aluguel" : "Locação encerrada"}</h3></div>{!active && available ? <Button onClick={onStart} className="bg-[#009b3a] text-white"><KeyRound className="size-4" />Iniciar locação</Button> : null}</div>
    {active ? <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><RentalInfo icon={UserRound} label="Locatário" value={active.tenant.name || "Não informado"} /><RentalInfo icon={UserRound} label="Proprietário" value={active.owner?.name || active.ownerName || "Não informado"} /><RentalInfo icon={CircleDollarSign} label="Valor mensal" value={formatMoney(active.monthlyRent)} /><RentalInfo icon={CalendarClock} label="Vencimento" value={`Dia ${active.dueDay}`} /><RentalInfo icon={CalendarClock} label="Início / fim" value={`${formatDate(active.startDate)} · ${active.endDate ? formatDate(active.endDate) : "sem término"}`} /><RentalInfo icon={History} label="Reajuste" value={active.adjustmentOther || active.adjustmentIndex} /><RentalInfo icon={KeyRound} label="Garantia" value={active.guaranteeOther || formatRentalLabel(active.guaranteeType)} /><RentalInfo icon={CalendarClock} label="Próximo reajuste" value={active.nextAdjustmentDate ? formatDate(active.nextAdjustmentDate) : "Não informado"} /></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="ghost"><Link href="/corretor/clientes">Ver locatário</Link></Button><Button asChild variant="ghost"><Link href="/corretor/documentos/contratos">Ver contrato</Link></Button><Button onClick={() => setAction("payment")} variant="ghost">Registrar pagamento</Button><Button onClick={() => setAction("issue")} variant="ghost">Registrar pendência</Button><Button onClick={() => setAction("adjustment")} variant="ghost">Reajustar aluguel</Button><Button onClick={() => setAction("end")} variant="ghost" className="text-red-600">Encerrar locação</Button></div>
      <div className="grid gap-3 lg:grid-cols-3"><RentalHistory title="Pagamentos" empty="Nenhum pagamento registrado." items={active.payments.map((item) => `${item.competence} · ${formatMoney(item.amount)} · ${formatRentalLabel(resolvePaymentStatus(item))}`)} /><RentalHistory title="Reajustes" empty="Nenhum reajuste registrado." items={active.adjustments.map((item) => `${formatDate(item.effectiveDate)} · ${formatMoney(item.previousAmount)} → ${formatMoney(item.newAmount)}`)} /><RentalHistory title="Pendências" empty="Nenhuma pendência registrada." items={active.issues.map((item) => `${item.title} · ${formatRentalLabel(item.status)}`)} /></div>
      <RentalActionDialog rental={active} action={action} onOpenChange={(open) => !open && setAction(null)} onChanged={() => { setAction(null); onChanged() }} />
    </> : rentals.length ? <RentalHistory title="Histórico de locações" empty="" items={rentals.map((item) => `${formatDate(item.startDate)} a ${item.endedAt ? formatDate(item.endedAt) : item.endDate ? formatDate(item.endDate) : "encerrada"} · ${item.tenant.name || "Locatário não informado"}`)} /> : <p className="text-sm text-[#667085]">Inicie a locação para acompanhar contrato, pagamentos, reajustes e pendências neste imóvel.</p>}
  </section>
}

function RentalActionDialog({ rental, action, onOpenChange, onChanged }: { rental: RentalRecord; action: "payment" | "adjustment" | "issue" | "end" | null; onOpenChange: (open: boolean) => void; onChanged: () => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>({ competence: new Date().toISOString().slice(0, 7), amount: (rental.monthlyRent / 100).toFixed(2).replace(".", ","), dueDate: "", status: "PAID", newAmount: "", percentage: "", effectiveDate: new Date().toISOString().slice(0, 10), indexLabel: rental.adjustmentIndex, type: "MAINTENANCE", title: "", description: "", priority: "MEDIUM", eventDate: new Date().toISOString().slice(0, 10), endedAt: new Date().toISOString().slice(0, 10), makeAvailable: true })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit() {
    if (!action) return
    setIsSaving(true); setError("")
    try {
      const response = await fetch(`/api/properties/rentals/${rental.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...form }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Não foi possível salvar.")
      onChanged()
    } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar.") } finally { setIsSaving(false) }
  }
  const title = action === "payment" ? "Registrar pagamento" : action === "adjustment" ? "Reajustar aluguel" : action === "issue" ? "Registrar pendência" : "Encerrar locação"
  return <Dialog open={Boolean(action)} onOpenChange={onOpenChange}><DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[1.5rem] border-black/[0.06] bg-white sm:max-w-lg"><DialogTitle>{title}</DialogTitle><DialogDescription>As informações serão mantidas no histórico operacional da locação.</DialogDescription><div className="grid gap-3">
    {action === "payment" ? <><RentalField label="Competência"><Input type="month" value={String(form.competence)} onChange={(event) => setForm({ ...form, competence: event.target.value })} /></RentalField><RentalField label="Valor"><Input value={String(form.amount)} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></RentalField><RentalField label="Vencimento"><Input type="date" value={String(form.dueDate)} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></RentalField><RentalField label="Status"><Select value={String(form.status)} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAID">Pago</SelectItem><SelectItem value="PENDING">Pendente</SelectItem><SelectItem value="OVERDUE">Em atraso</SelectItem></SelectContent></Select></RentalField></> : null}
    {action === "adjustment" ? <><RentalField label="Valor atual"><Input disabled value={formatMoney(rental.monthlyRent)} /></RentalField><RentalField label="Percentual / índice"><Input value={String(form.percentage)} onChange={(event) => setForm({ ...form, percentage: event.target.value })} placeholder="Ex.: 4,5" /></RentalField><RentalField label="Novo valor"><Input value={String(form.newAmount)} onChange={(event) => setForm({ ...form, newAmount: event.target.value })} /></RentalField><RentalField label="Data de vigência"><Input type="date" value={String(form.effectiveDate)} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></RentalField></> : null}
    {action === "issue" ? <><RentalField label="Tipo"><Select value={String(form.type)} onValueChange={(value) => setForm({ ...form, type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MAINTENANCE">Manutenção</SelectItem><SelectItem value="INSPECTION">Vistoria</SelectItem><SelectItem value="DOCUMENTATION">Documentação</SelectItem><SelectItem value="TENANT_REQUEST">Solicitação do locatário</SelectItem><SelectItem value="OTHER">Outro</SelectItem></SelectContent></Select></RentalField><RentalField label="Título"><Input value={String(form.title)} onChange={(event) => setForm({ ...form, title: event.target.value })} /></RentalField><RentalField label="Prioridade"><Select value={String(form.priority)} onValueChange={(value) => setForm({ ...form, priority: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baixa</SelectItem><SelectItem value="MEDIUM">Média</SelectItem><SelectItem value="HIGH">Alta</SelectItem><SelectItem value="URGENT">Urgente</SelectItem></SelectContent></Select></RentalField><RentalField label="Data"><Input type="date" value={String(form.eventDate)} onChange={(event) => setForm({ ...form, eventDate: event.target.value })} /></RentalField><RentalField label="Descrição"><Textarea value={String(form.description)} onChange={(event) => setForm({ ...form, description: event.target.value })} /></RentalField></> : null}
    {action === "end" ? <><RentalField label="Data de encerramento"><Input type="date" value={String(form.endedAt)} onChange={(event) => setForm({ ...form, endedAt: event.target.value })} /></RentalField><label className="flex items-start gap-3 rounded-xl border border-black/[0.06] p-3 text-sm"><input type="checkbox" checked={Boolean(form.makeAvailable)} onChange={(event) => setForm({ ...form, makeAvailable: event.target.checked })} className="mt-0.5" /><span><strong>Disponibilizar novamente para aluguel</strong><br /><span className="text-[#667085]">O histórico será preservado em qualquer opção.</span></span></label></> : null}
    {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
  </div><DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void submit()} disabled={isSaving} className={action === "end" ? "bg-red-600 text-white" : "bg-[#009b3a] text-white"}>{isSaving ? "Salvando..." : "Confirmar"}</Button></DialogFooter></DialogContent></Dialog>
}

function RentalField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium text-[#344054]"><span>{label}</span>{children}</label> }
function RentalInfo({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="rounded-xl border border-black/[0.06] bg-white p-3"><div className="flex items-center gap-2 text-xs text-[#667085]"><Icon className="size-3.5 text-[#009b3a]" />{label}</div><p className="mt-1 text-sm font-semibold text-[#111827]">{value}</p></div> }
function RentalHistory({ title, empty, items }: { title: string; empty: string; items: string[] }) { return <div className="rounded-xl border border-black/[0.06] bg-white p-3"><div className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="size-4 text-[#009b3a]" />{title}</div>{items.length ? <ul className="mt-2 grid gap-1.5 text-xs text-[#667085]">{items.map((item, index) => <li key={`${item}-${index}`} className="border-t border-black/[0.05] pt-1.5 first:border-0 first:pt-0">{item}</li>)}</ul> : <p className="mt-2 text-xs text-[#8B95A1]">{empty}</p>}</div> }
function formatMoney(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100) }
function formatDate(value: string) { return new Intl.DateTimeFormat("pt-BR").format(new Date(value)) }
function formatRentalLabel(value: string) { return ({ PAID: "Pago", PENDING: "Pendente", OVERDUE: "Em atraso", OPEN: "Aberta", IN_PROGRESS: "Em andamento", RESOLVED: "Resolvida", CANCELLED: "Cancelada", "CAUÇÃO": "Caução", FIADOR: "Fiador", "SEGURO-FIANÇA": "Seguro-fiança", "SEM GARANTIA": "Sem garantia" } as Record<string, string>)[value] || value.toLowerCase().replace(/(^|_)(\w)/g, (_, space: string, letter: string) => `${space ? " " : ""}${letter.toUpperCase()}`) }
function resolvePaymentStatus(payment: { status: string; dueDate: string }) { return payment.status === "PENDING" && new Date(payment.dueDate) < new Date() ? "OVERDUE" : payment.status }
