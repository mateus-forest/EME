"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CopyPlus,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  LayoutTemplate,
  PenLine,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { BrokerContractsPage } from "@/components/broker-contracts-page"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  contractTemplates,
  templateContracts,
  type ContractTemplateInstanceRecord,
  type ContractTemplateRecord,
} from "@/lib/contract-template-client"
import {
  calculateContractReadiness,
  contractBindingOptions,
  renderContractTemplateHtml,
  type ContractFieldBinding,
  type ContractTemplateField,
  type ContractTemplateStructure,
} from "@/lib/contract-template-engine"
import type { LeadRecord } from "@/lib/lead-contract"
import type { PropertyApiItem } from "@/lib/property-contract"

type WorkspaceMode = "import" | "new" | "editor" | null
type WorkspaceView = "contracts" | "templates"

function formatBytes(value: number | null) {
  if (!value) return "Tamanho não informado"
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${Math.ceil(value / 1024)} KB`
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ContractTemplateField
  value: string
  onChange: (value: string) => void
}) {
  const common = {
    id: `contract-field-${field.id}`,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
    placeholder: field.required ? "Precisa completar" : "Opcional",
    className: "rounded-xl border-black/[0.08] bg-white text-[#111111]",
  }
  if (field.type === "LONG_TEXT") return <Textarea {...common} rows={3} />
  return <Input {...common} type={field.type === "DATE" ? "date" : field.type === "EMAIL" ? "email" : "text"} />
}

function ImportTemplatePanel({
  templates,
  initialTemplate,
  onTemplatesChanged,
  onClose,
}: {
  templates: ContractTemplateRecord[]
  initialTemplate?: ContractTemplateRecord | null
  onTemplatesChanged: () => Promise<void>
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [template, setTemplate] = useState<ContractTemplateRecord | null>(initialTemplate ?? null)
  const [name, setName] = useState(initialTemplate?.name ?? "")
  const [structure, setStructure] = useState<ContractTemplateStructure | null>(initialTemplate?.version?.structure ?? null)
  const [isBusy, setIsBusy] = useState(false)
  const [feedback, setFeedback] = useState("")

  const legalTextModified = useMemo(() => {
    if (!template?.version?.structure || !structure) return false
    return JSON.stringify(template.version.structure.blocks) !== JSON.stringify(structure.blocks)
  }, [structure, template])

  function beginReview(next: ContractTemplateRecord) {
    if (!next.version?.structure) {
      setFeedback("A estrutura deste modelo ainda não está disponível para revisão.")
      return
    }
    setTemplate(next)
    setName(next.name)
    setStructure(next.version.structure)
    setFeedback("")
  }

  async function importFile() {
    if (!file) return
    setIsBusy(true)
    setFeedback("")
    try {
      const result = await contractTemplates.import(file)
      await onTemplatesChanged()
      if (result.template.status === "REVIEW_REQUIRED") beginReview(result.template)
      else if (result.template.status === "READY") {
        setFeedback("Este arquivo já foi analisado e o modelo pronto foi reutilizado.")
      } else if (result.template.status === "ANALYZING") {
        setFeedback("Este modelo já está sendo preparado. Nenhuma nova análise foi iniciada.")
      } else {
        setFeedback("O arquivo foi preservado, mas a análise precisa ser retomada explicitamente.")
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível importar o modelo.")
    } finally {
      setIsBusy(false)
    }
  }

  function updateField(fieldId: string, patch: Partial<ContractTemplateField>) {
    setStructure((current) => current ? {
      ...current,
      fields: current.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
    } : current)
  }

  function removeField(fieldId: string) {
    setStructure((current) => current ? {
      ...current,
      fields: current.fields.filter((field) => field.id !== fieldId),
    } : current)
  }

  async function saveReview() {
    if (!template || !structure || !name.trim()) return
    if (legalTextModified && !window.confirm("O texto jurídico foi alterado. Confirme que ele deve ser salvo como uma nova revisão do seu modelo.")) return
    setIsBusy(true)
    setFeedback("")
    try {
      const confirmed: ContractTemplateStructure = {
        ...structure,
        fields: structure.fields.map((field) => ({ ...field, reviewStatus: "CONFIRMED" })),
      }
      await contractTemplates.saveReview(template.id, { name: name.trim(), structure: confirmed })
      await onTemplatesChanged()
      onClose()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar o modelo.")
    } finally {
      setIsBusy(false)
    }
  }

  async function reanalyze(item: ContractTemplateRecord) {
    setIsBusy(true)
    setFeedback("")
    try {
      const result = await contractTemplates.reanalyze(item.id)
      await onTemplatesChanged()
      if (result.template.status === "REVIEW_REQUIRED") beginReview(result.template)
      else setFeedback("A preparação deste modelo já está em andamento.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível reanalisar o modelo.")
    } finally {
      setIsBusy(false)
    }
  }

  if (template && structure) {
    return (
      <div className="grid max-h-[calc(100vh-7rem)] gap-5 overflow-y-auto pr-1">
        <button type="button" onClick={() => setTemplate(null)} className="flex w-fit items-center gap-2 text-sm text-[#5f6b7a]">
          <ArrowLeft className="size-4" /> Voltar ao upload
        </button>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-4">
            <section className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Modelo identificado</p>
              <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-3 h-12 rounded-xl border-black/[0.08] text-lg font-semibold" />
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><strong className="block text-xl text-[#050505]">{structure.sections.length}</strong><span className="text-[#687386]">seções</span></div>
                <div><strong className="block text-xl text-[#050505]">{structure.fields.length}</strong><span className="text-[#687386]">campos</span></div>
                <div><strong className="block text-xl text-[#050505]">{structure.parties.length}</strong><span className="text-[#687386]">partes</span></div>
              </div>
            </section>

            <section className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <h3 className="font-semibold text-[#050505]">Partes identificadas</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {structure.parties.length > 0 ? structure.parties.map((party) => (
                  <label key={party.id} className="flex items-center gap-2 rounded-xl bg-[#f2f8f4] px-3 py-2 text-sm text-[#17733a]">
                    <Check className="size-3.5 shrink-0" />
                    <Input
                      value={party.label}
                      aria-label={`Nome da parte ${party.label}`}
                      onChange={(event) => setStructure((current) => current ? {
                        ...current,
                        parties: current.parties.map((item) => item.id === party.id ? { ...item, label: event.target.value } : item),
                      } : current)}
                      className="h-8 border-0 bg-transparent px-1 text-sm text-[#17733a] shadow-none focus-visible:ring-1"
                    />
                  </label>
                )) : <span className="text-sm text-[#6b7280]">Nenhuma parte inequívoca foi classificada.</span>}
              </div>
            </section>

            <section className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <div>
                <h3 className="font-semibold text-[#050505]">Revisar campos e origens</h3>
                <p className="mt-1 text-sm leading-6 text-[#687386]">A inteligência sugere. Você confirma antes de o modelo ficar disponível.</p>
              </div>
              <div className="mt-4 grid gap-3">
                {structure.fields.map((field) => (
                  <div key={field.id} className="grid gap-3 rounded-xl bg-[#fafaf7] p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_150px_auto] md:items-end">
                    <label className="grid gap-1.5 text-xs text-[#687386]">
                      Campo no documento
                      <Input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} className="bg-white text-sm text-[#111]" />
                    </label>
                    <label className="grid gap-1.5 text-xs text-[#687386]">
                      Origem confirmada
                      <select
                        value={field.binding}
                        onChange={(event) => {
                          const binding = event.target.value as ContractFieldBinding
                          const option = contractBindingOptions.find((item) => item.value === binding)
                          updateField(field.id, { binding, source: option?.source ?? "NONE", reviewStatus: "CONFIRMED" })
                        }}
                        className="h-10 rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-[#111]"
                      >
                        {contractBindingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs text-[#687386]">
                      Tipo
                      <select
                        value={field.type}
                        onChange={(event) => updateField(field.id, { type: event.target.value as ContractTemplateField["type"] })}
                        className="h-10 rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-[#111]"
                      >
                        <option value="TEXT">Texto</option>
                        <option value="LONG_TEXT">Texto longo</option>
                        <option value="DATE">Data</option>
                        <option value="CURRENCY">Valor monetário</option>
                        <option value="NUMBER">Número</option>
                        <option value="CPF_CNPJ">CPF ou CNPJ</option>
                        <option value="PHONE">Telefone</option>
                        <option value="EMAIL">E-mail</option>
                      </select>
                    </label>
                    <label className="flex h-10 items-center gap-2 text-sm text-[#4b5563]">
                      <input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} className="size-4 accent-[#009b3a]" />
                      Obrigatório
                    </label>
                    <button type="button" onClick={() => removeField(field.id)} className="flex h-10 items-center justify-center gap-2 rounded-lg text-xs text-[#8a4a44] hover:bg-[#fff1ef] md:col-start-4">
                      <Trash2 className="size-3.5" /> Manter como texto fixo
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <details className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <summary className="cursor-pointer font-semibold text-[#111]">Estrutura e texto do modelo</summary>
              <p className="mt-2 text-sm leading-6 text-[#687386]">Use apenas para corrigir o documento. Alterações no texto jurídico criam uma nova versão e recomendam revisão jurídica.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {structure.sections.map((section) => (
                  <label key={section.id} className="grid gap-1.5 text-xs uppercase tracking-[0.1em] text-[#8b95a1]">
                    Seção
                    <Input
                      value={section.title}
                      onChange={(event) => setStructure((current) => current ? {
                        ...current,
                        sections: current.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item),
                      } : current)}
                      className="normal-case tracking-normal text-[#111]"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-3">
                {structure.blocks.map((block) => (
                  <label key={block.id} className="grid gap-1.5 text-xs uppercase tracking-[0.1em] text-[#8b95a1]">
                    <select
                      value={block.type}
                      onChange={(event) => setStructure((current) => current ? {
                        ...current,
                        blocks: current.blocks.map((item) => item.id === block.id ? {
                          ...item,
                          type: event.target.value as ContractTemplateStructure["blocks"][number]["type"],
                        } : item),
                      } : current)}
                      className="h-9 w-fit rounded-lg border border-black/[0.08] bg-white px-3 text-xs text-[#5f6b7a]"
                    >
                      <option value="TITLE">Título</option>
                      <option value="HEADING">Cabeçalho</option>
                      <option value="CLAUSE">Cláusula</option>
                      <option value="PARAGRAPH">Parágrafo</option>
                      <option value="SIGNATURE">Assinatura</option>
                    </select>
                    <Textarea
                      value={block.text}
                      onChange={(event) => setStructure((current) => current ? {
                        ...current,
                        blocks: current.blocks.map((item) => item.id === block.id ? { ...item, text: event.target.value } : item),
                      } : current)}
                      rows={Math.min(8, Math.max(2, Math.ceil(block.text.length / 100)))}
                      className="normal-case tracking-normal text-[#111]"
                    />
                  </label>
                ))}
              </div>
            </details>
            {legalTextModified ? (
              <p className="rounded-xl bg-[#fff8e8] p-4 text-sm leading-6 text-[#765a16]">
                Este modelo foi alterado após a importação. Recomenda-se revisão jurídica antes do uso.
              </p>
            ) : null}
          </div>

          <aside className="h-fit rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-5 lg:sticky lg:top-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Fonte preservada</p>
            <p className="mt-2 font-medium text-[#111]">{template.version?.sourceFileName}</p>
            <p className="mt-1 text-sm text-[#687386]">{formatBytes(template.version?.sourceFileSize ?? null)}</p>
            <Button variant="outline" onClick={() => window.open(`/api/brokers/contract-templates/${template.id}/original`, "_blank")} className="mt-4 w-full rounded-xl">
              <ExternalLink className="size-4" /> Abrir original
            </Button>
            {structure.partiallyRecognized || structure.warnings.length > 0 ? (
              <div className="mt-4 rounded-xl bg-[#fff8e8] p-3 text-sm leading-5 text-[#765a16]">
                <AlertCircle className="mb-2 size-4" />
                {structure.warnings[0] || "Alguns trechos precisam de atenção humana."}
              </div>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-[#7b8491]">Salvar confirma a estrutura. O texto jurídico não será reanalisado ao criar novos contratos.</p>
            <Button onClick={() => void saveReview()} disabled={isBusy || !name.trim()} className="mt-5 w-full rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
              {isBusy ? <Spinner className="size-4" /> : <CheckCircle2 className="size-4" />} Salvar modelo
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm("Reanalisar inicia uma nova leitura do arquivo original. Deseja continuar?")) void reanalyze(template)
              }}
              disabled={isBusy}
              className="mt-2 w-full rounded-xl text-[#5f6b7a]"
            >
              <RefreshCw className="size-4" /> Reanalisar arquivo
            </Button>
          </aside>
        </div>
        {feedback ? <p className="rounded-xl bg-[#fff8e8] p-3 text-sm text-[#765a16]">{feedback}</p> : null}
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-dashed border-black/[0.1] bg-[#fbfbf8] p-7 text-center">
        <FileUp className="mx-auto size-7 text-[#009b3a]" />
        <h3 className="mt-3 font-semibold text-[#050505]">Adicione o contrato que você já utiliza.</h3>
        <p className="mt-1 text-sm text-[#687386]">PDF ou DOCX, até 15 MB. O conteúdo jurídico será preservado.</p>
        <Input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mx-auto mt-5 max-w-xl bg-white" />
        <Button onClick={() => void importFile()} disabled={!file || isBusy} className="mt-4 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
          {isBusy ? <><Spinner className="size-4" /> Preparando seu modelo...</> : "Importar modelo"}
        </Button>
      </section>
      {templates.some((item) => item.status === "REVIEW_REQUIRED") ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Aguardando revisão</p>
          <div className="mt-3 grid gap-2">
            {templates.filter((item) => item.status === "REVIEW_REQUIRED").map((item) => (
              <button key={item.id} type="button" onClick={() => beginReview(item)} className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-4 text-left">
                <span><strong className="block text-sm text-[#111]">{item.name}</strong><span className="text-xs text-[#7b8491]">Revisar campos antes de utilizar</span></span>
                <PenLine className="size-4 text-[#009b3a]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {templates.some((item) => item.status === "ANALYZING") ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Em preparação</p>
          <div className="mt-3 grid gap-2">
            {templates.filter((item) => item.status === "ANALYZING").map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-white p-4">
                <span className="flex items-center gap-3"><Spinner className="size-4 text-[#009b3a]" /><span><strong className="block text-sm text-[#111]">{item.name}</strong><span className="text-xs text-[#7b8491]">Nenhuma análise adicional será iniciada enquanto esta estiver ativa.</span></span></span>
                <Button variant="ghost" disabled={isBusy} onClick={() => void reanalyze(item)} className="rounded-xl text-xs">Verificar preparação</Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {templates.some((item) => item.status === "READY") ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Seus modelos</p>
          <div className="mt-3 grid gap-2">
            {templates.filter((item) => item.status === "READY").map((item) => (
              <button key={item.id} type="button" onClick={() => beginReview(item)} className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-4 text-left">
                <span><strong className="block text-sm text-[#111]">{item.name}</strong><span className="text-xs text-[#7b8491]">Versão {item.currentVersion} · editar estrutura</span></span>
                <PenLine className="size-4 text-[#5f6b7a]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {templates.some((item) => item.status === "FAILED") ? (
        <section>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Precisa de atenção</p>
          <div className="mt-3 grid gap-2">
            {templates.filter((item) => item.status === "FAILED").map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ead5a0] bg-[#fffdf7] p-4">
                <span><strong className="block text-sm text-[#111]">{item.name}</strong><span className="text-xs text-[#7b8491]">O arquivo original está preservado.</span></span>
                <Button variant="outline" disabled={isBusy} onClick={() => void reanalyze(item)} className="rounded-xl">Reanalisar modelo</Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {feedback ? <p className="rounded-xl bg-[#fff8e8] p-3 text-sm text-[#765a16]">{feedback}</p> : null}
    </div>
  )
}

function TemplateLibrary({
  templates,
  loading,
  feedback,
  onImport,
  onInspect,
  onUse,
}: {
  templates: ContractTemplateRecord[]
  loading: boolean
  feedback: string
  onImport: () => void
  onInspect: (template: ContractTemplateRecord) => void
  onUse: (templateId: string) => Promise<void>
}) {
  const ready = templates.filter((template) => template.status === "READY")
  const pending = templates.filter((template) => template.status !== "READY")

  return (
    <div className="grid gap-5">
      <section className="rounded-[2rem] border border-black/[0.05] bg-white px-6 py-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#9aa4b2]">Biblioteca reutilizável</p>
            <h2 className="mt-2 flex items-center gap-2 text-[2rem] font-semibold tracking-[-0.05em] text-[#050505]"><LayoutTemplate className="size-5 text-[#009b3a]" /> Modelos</h2>
            <p className="mt-2 text-sm leading-6 text-[#6b7280]">Consulte a estrutura dos seus modelos próprios e use-os em novas operações sem uma nova análise.</p>
          </div>
          <Button onClick={onImport} className="h-11 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"><FileUp className="size-4" /> Importar modelo</Button>
        </div>
      </section>

      {feedback ? <p className="rounded-xl border border-black/[0.06] bg-white p-3 text-sm text-[#5f6b7a]">{feedback}</p> : null}
      {loading ? <div className="flex justify-center rounded-2xl border border-black/[0.05] bg-white py-16"><Spinner className="size-6 text-[#009b3a]" /></div> : null}

      {!loading && ready.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ready.map((template) => (
            <article key={template.id} className="grid min-w-0 gap-5 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.035)]">
              <button type="button" onClick={() => onInspect(template)} className="min-w-0 text-left">
                <span className="inline-flex rounded-full bg-[#edf8f1] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#17733a]">Pronto para usar</span>
                <strong className="mt-3 block truncate text-base text-[#111]">{template.name}</strong>
                <span className="mt-1 block text-xs leading-5 text-[#7b8491]">Versão {template.currentVersion} · atualizado em {new Intl.DateTimeFormat("pt-BR").format(new Date(template.updatedAt))}</span>
                <span className="mt-3 block text-sm text-[#5f6b7a]">Consultar estrutura e campos</span>
              </button>
              <div className="flex gap-2 border-t border-black/[0.05] pt-4">
                <Button variant="outline" onClick={() => onInspect(template)} className="flex-1 rounded-xl">Consultar</Button>
                <Button disabled={loading} onClick={() => void onUse(template.id)} className="flex-1 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]"><Plus className="size-4" /> Usar modelo</Button>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {!loading && ready.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-black/[0.08] bg-[#fbfbf8] p-10 text-center">
          <LayoutTemplate className="mx-auto size-7 text-[#8b95a1]" />
          <p className="mt-3 font-medium text-[#111]">Nenhum modelo pronto ainda.</p>
          <p className="mt-1 text-sm text-[#687386]">Importe um PDF ou DOCX, revise a estrutura identificada e salve para reutilizar.</p>
          <Button onClick={onImport} className="mt-5 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">Importar modelo</Button>
        </section>
      ) : null}

      {!loading && pending.length > 0 ? (
        <section className="rounded-2xl border border-black/[0.05] bg-white p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Em preparação ou revisão</p>
          <div className="mt-3 grid gap-2">
            {pending.map((template) => (
              <button key={template.id} type="button" onClick={() => onInspect(template)} className="flex items-center justify-between rounded-xl bg-[#fbfbf8] p-4 text-left">
                <span><strong className="block text-sm text-[#111]">{template.name}</strong><span className="text-xs text-[#7b8491]">{template.status === "ANALYZING" ? "Em preparação" : template.status === "FAILED" ? "Precisa de atenção" : "Aguardando revisão"}</span></span>
                {template.status === "ANALYZING" ? <Spinner className="size-4 text-[#009b3a]" /> : <PenLine className="size-4 text-[#5f6b7a]" />}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function InstanceEditor({
  instanceId,
  onChanged,
  onChangeTemplate,
}: {
  instanceId: string
  onChanged: () => void
  onChangeTemplate: () => void
}) {
  const [instance, setInstance] = useState<ContractTemplateInstanceRecord | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [title, setTitle] = useState("")
  const [leadId, setLeadId] = useState("")
  const [propertyId, setPropertyId] = useState("")
  const [additionalParties, setAdditionalParties] = useState<ContractTemplateInstanceRecord["additionalParties"]>({})
  const [leads, setLeads] = useState<LeadRecord[]>([])
  const [properties, setProperties] = useState<PropertyApiItem[]>([])
  const [isBusy, setIsBusy] = useState(true)
  const [feedback, setFeedback] = useState("")
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10))
  const [signatureNote, setSignatureNote] = useState("")

  const applyInstance = useCallback((next: ContractTemplateInstanceRecord) => {
    setInstance(next)
    setValues(next.values)
    setTitle(next.title)
    setLeadId(next.leadId ?? "")
    setPropertyId(next.propertyId ?? "")
    setAdditionalParties(next.additionalParties ?? {})
  }, [])

  useEffect(() => {
    let active = true
    setIsBusy(true)
    Promise.all([
      templateContracts.get(instanceId),
      fetch("/api/brokers/leads", { credentials: "include", cache: "no-store" }).then((response) => response.json()),
      fetch("/api/properties/me", { credentials: "include", cache: "no-store" }).then((response) => response.json()),
    ]).then(([contract, leadData, propertyData]) => {
      if (!active) return
      applyInstance(contract.instance)
      setLeads((leadData?.leads ?? []) as LeadRecord[])
      setProperties((propertyData?.properties ?? []) as PropertyApiItem[])
    }).catch((error) => active && setFeedback(error instanceof Error ? error.message : "Não foi possível carregar o contrato."))
      .finally(() => active && setIsBusy(false))
    return () => { active = false }
  }, [applyInstance, instanceId])

  const readiness = useMemo(
    () => instance ? calculateContractReadiness(instance.structure, values) : { score: 0, missing: [], completed: 0, required: 0 },
    [instance, values],
  )
  const previewHtml = useMemo(
    () => instance ? renderContractTemplateHtml({ structure: instance.structure, values, draft: instance.status === "draft", title }) : "",
    [instance, title, values],
  )

  const groupedFields = useMemo(() => {
    if (!instance) return []
    const groups = [
      { id: "parties", label: "Partes", fields: instance.structure.fields.filter((field) => ["CLIENT", "ADDITIONAL_PARTY", "BROKER"].includes(field.source)) },
      { id: "property", label: "Imóvel", fields: instance.structure.fields.filter((field) => field.source === "PROPERTY") },
      { id: "negotiation", label: "Negociação", fields: instance.structure.fields.filter((field) => field.source === "CONTRACT") },
      { id: "other", label: "Outros dados", fields: instance.structure.fields.filter((field) => field.source === "NONE") },
    ]
    return groups.filter((group) => group.fields.length > 0)
  }, [instance])

  const readinessGroups = useMemo(() => groupedFields.map((group) => {
    const required = group.fields.filter((field) => field.required)
    const missing = required.filter((field) => !values[field.id]?.trim())
    return { ...group, required: required.length, missing }
  }), [groupedFields, values])

  async function save(patch: Partial<Pick<ContractTemplateInstanceRecord, "leadId" | "propertyId" | "additionalParties">> = {}) {
    if (!instance) return
    setIsBusy(true)
    setFeedback("")
    try {
      const result = await templateContracts.update(instance.id, {
        title,
        leadId: patch.leadId ?? leadId,
        propertyId: patch.propertyId ?? propertyId,
        values,
        additionalParties: patch.additionalParties ?? additionalParties,
      })
      applyInstance(result.instance)
      onChanged()
      setFeedback("Alterações salvas.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setIsBusy(false)
    }
  }

  async function duplicate() {
    if (!instance) return
    setIsBusy(true)
    try {
      const result = await templateContracts.duplicate(instance.id)
      onChanged()
      const loaded = await templateContracts.get(result.instance.id)
      applyInstance(loaded.instance)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível duplicar.")
    } finally { setIsBusy(false) }
  }

  async function sign() {
    if (!instance) return
    setIsBusy(true)
    try {
      const result = await templateContracts.sign(instance.id, { signedAt: `${signedAt}T12:00:00.000Z`, note: signatureNote })
      applyInstance(result.instance)
      setSignatureOpen(false)
      onChanged()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível registrar a assinatura.")
    } finally { setIsBusy(false) }
  }

  function fieldState(field: ContractTemplateField) {
    if (!values[field.id]?.trim() && field.required) return { label: "Precisa completar", tone: "text-[#a06e0f]" }
    const knownEntity = ["CLIENT", "PROPERTY", "BROKER"].includes(field.source)
      || (field.source === "ADDITIONAL_PARTY" && Boolean(field.partyId && additionalParties[field.partyId]?.leadId))
    if (!values[field.id]?.trim()) return { label: "Opcional", tone: "text-[#8b95a1]" }
    return knownEntity
      ? { label: "Preenchido pelo EME", tone: "text-[#009b3a]" }
      : { label: "Informação deste contrato", tone: "text-[#5f6b7a]" }
  }

  if (isBusy && !instance) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-6 text-[#009b3a]" /></div>
  if (!instance) return <p className="rounded-xl bg-[#fff8e8] p-4 text-sm text-[#765a16]">{feedback || "Contrato não encontrado."}</p>

  return (
    <div data-testid="contract-instance-editor" className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4 pr-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Modelo · versão {instance.template.version}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#050505]">{instance.template.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void duplicate()} className="rounded-xl"><CopyPlus className="size-4" /> Duplicar</Button>
          <Button
            variant="outline"
            onClick={() => setSignatureOpen(true)}
            disabled={readiness.score < 100 || instance.status === "signed"}
            title={readiness.score < 100 ? "Complete os campos obrigatórios antes de registrar a assinatura." : undefined}
            className="rounded-xl"
          >
            <Check className="size-4" /> {instance.status === "signed" ? "Assinatura registrada" : "Registrar assinatura"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 gap-5 overflow-x-hidden overflow-y-auto pt-4 lg:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)] lg:items-start">
        <aside data-testid="contract-editor-form" className="grid min-w-0 gap-5 lg:col-start-1 lg:row-start-1">
          <section className="rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Modelo</p>
            <p className="mt-2 text-sm font-semibold text-[#111]">{instance.template.name}</p>
            <Button variant="ghost" onClick={onChangeTemplate} className="mt-1 h-8 rounded-lg px-2 text-xs text-[#5f6b7a]">Trocar modelo</Button>
            <label className="mt-4 grid gap-1.5 text-xs text-[#687386]">
              Título deste contrato
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className="bg-white" />
            </label>
          </section>
          <section className="grid gap-3 rounded-2xl border border-black/[0.06] bg-white p-4">
            <label className="grid gap-1.5 text-xs text-[#687386]">Cliente
              <select value={leadId} onChange={(event) => { const value = event.target.value; setLeadId(value); void save({ leadId: value }) }} className="h-10 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111]">
                <option value="">Selecionar cliente</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.email || "Cliente sem nome"}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-[#687386]">Imóvel
              <select value={propertyId} onChange={(event) => { const value = event.target.value; setPropertyId(value); void save({ propertyId: value }) }} className="h-10 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111]">
                <option value="">Selecionar imóvel</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
              </select>
            </label>
          </section>

          {instance.structure.parties.filter((party) => instance.structure.fields.some((field) => field.partyId === party.id && field.source === "ADDITIONAL_PARTY")).map((party) => (
            <section key={party.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <p className="text-sm font-semibold text-[#111]">{party.label}</p>
              <select
                value={additionalParties[party.id]?.leadId ?? ""}
                onChange={(event) => {
                  const next = { ...additionalParties, [party.id]: { ...(additionalParties[party.id] ?? {}), leadId: event.target.value || undefined } }
                  setAdditionalParties(next)
                  void save({ additionalParties: next })
                }}
                className="mt-2 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111]"
              >
                <option value="">Cadastrar dados neste contrato</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.email || "Pessoa sem nome"}</option>)}
              </select>
            </section>
          ))}

          {groupedFields.map((group) => (
            <section key={group.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">{group.label}</p>
              <div className="mt-3 grid gap-3">
                {group.fields.map((field) => (
                  <label key={field.id} className="grid gap-1.5 text-xs text-[#687386]">
                    <span className="flex items-center justify-between gap-2"><span>{field.label}{field.required ? " *" : ""}</span><span className={fieldState(field).tone}>{fieldState(field).label}</span></span>
                    <FieldInput field={field} value={values[field.id] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />
                  </label>
                ))}
              </div>
            </section>
          ))}
          <Button onClick={() => void save()} disabled={isBusy} className="rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">{isBusy ? <Spinner className="size-4" /> : <Check className="size-4" />} Salvar alterações</Button>
        </aside>

        <main data-testid="contract-editor-preview" className="min-w-0 rounded-2xl bg-[#f3f2ee] p-3 sm:p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <p className="mb-3 text-center text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Preview A4 sincronizado</p>
          <div className="mx-auto aspect-[210/297] w-full max-w-[760px] overflow-hidden rounded-lg bg-white shadow-[0_12px_35px_rgba(15,23,42,.08)]">
            <iframe title="Preview do contrato" srcDoc={previewHtml} className="h-full w-full bg-white" />
          </div>
        </main>

        <aside className="min-w-0 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4 lg:col-start-1 lg:row-start-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Prontidão</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-[#050505]">{readiness.score}%</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-[#009b3a]" style={{ width: `${readiness.score}%` }} /></div>
          <div className="mt-4 grid gap-1.5">
            {readinessGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => group.missing[0] && document.getElementById(`contract-field-${group.missing[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-xs"
              >
                <span className="text-[#4b5563]">{group.label}</span>
                {group.missing.length === 0
                  ? <span className="inline-flex items-center gap-1 text-[#17733a]"><CheckCircle2 className="size-3.5" /> Completo</span>
                  : <span className="inline-flex items-center gap-1 text-[#a06e0f]"><AlertCircle className="size-3.5" /> {group.missing.length} pendente{group.missing.length > 1 ? "s" : ""}</span>}
              </button>
            ))}
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Pendências</p>
          <div className="mt-2 grid gap-2">
            {readiness.missing.length > 0 ? readiness.missing.map((field) => (
              <button key={field.id} type="button" onClick={() => document.getElementById(`contract-field-${field.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })} className="flex items-start gap-2 rounded-lg bg-white p-2 text-left text-xs text-[#765a16]">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {field.label}
              </button>
            )) : <p className="flex gap-2 rounded-lg bg-white p-3 text-xs text-[#17733a]"><CheckCircle2 className="size-4" /> Contrato pronto para gerar</p>}
          </div>
          <div className="mt-5 grid gap-2">
            <Button variant="outline" onClick={() => window.open(`/api/brokers/contract-instances/${instance.id}/pdf?draft=1`, "_blank")} className="rounded-xl"><Download className="size-4" /> Gerar rascunho</Button>
            <Button disabled={readiness.score < 100} onClick={() => window.open(`/api/brokers/contract-instances/${instance.id}/pdf`, "_blank")} className="rounded-xl bg-[#111] text-white hover:bg-[#050505]"><FileText className="size-4" /> Gerar PDF final</Button>
          </div>
          {feedback ? <p className="mt-4 rounded-lg bg-white p-3 text-xs leading-5 text-[#5f6b7a]">{feedback}</p> : null}
        </aside>
      </div>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="max-w-md rounded-2xl border-black/[0.07] bg-white text-[#111111] shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <DialogHeader><DialogTitle>Registrar assinatura</DialogTitle><DialogDescription>Confirma que este contrato foi assinado externamente?</DialogDescription></DialogHeader>
          <label className="grid gap-2 text-sm text-[#5f6b7a]">Data da assinatura<Input type="date" value={signedAt} onChange={(event) => setSignedAt(event.target.value)} /></label>
          <label className="grid gap-2 text-sm text-[#5f6b7a]">Observação<Textarea value={signatureNote} onChange={(event) => setSignatureNote(event.target.value)} placeholder="Opcional" /></label>
          <Button onClick={() => void sign()} disabled={!signedAt || isBusy} className="rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">Confirmar</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function BrokerContractsExperience() {
  const [view, setView] = useState<WorkspaceView>("contracts")
  const [mode, setMode] = useState<WorkspaceMode>(null)
  const [templates, setTemplates] = useState<ContractTemplateRecord[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateRecord | null>(null)
  const [instanceId, setInstanceId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [feedback, setFeedback] = useState("")

  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true)
    try {
      const result = await contractTemplates.list()
      setTemplates(result.templates)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar os modelos.")
    } finally { setIsLoadingTemplates(false) }
  }, [])

  function openMode(next: WorkspaceMode) {
    setMode(next)
    if (next === "import") setSelectedTemplate(null)
    setFeedback("")
    if (next === "import" || next === "new") void loadTemplates()
  }

  async function createFromTemplate(templateId: string) {
    setIsLoadingTemplates(true)
    setFeedback("")
    try {
      const result = await templateContracts.create({ templateId })
      setInstanceId(result.instance.id)
      setMode("editor")
      setRevision((value) => value + 1)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar o contrato.")
    } finally { setIsLoadingTemplates(false) }
  }

  function openInstance(id: string) {
    setInstanceId(id)
    setMode("editor")
  }

  const readyTemplates = templates.filter((template) => template.status === "READY")

  useEffect(() => {
    if (view === "templates") void loadTemplates()
  }, [loadTemplates, view])

  function inspectTemplate(template: ContractTemplateRecord) {
    setSelectedTemplate(template)
    setMode("import")
    setFeedback("")
  }

  return (
    <>
      <div className="mb-5 flex w-fit rounded-xl border border-black/[0.06] bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
        <button type="button" onClick={() => setView("contracts")} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${view === "contracts" ? "bg-[#edf8f1] text-[#17733a]" : "text-[#687386]"}`}>Contratos</button>
        <button type="button" onClick={() => setView("templates")} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${view === "templates" ? "bg-[#edf8f1] text-[#17733a]" : "text-[#687386]"}`}>Modelos</button>
      </div>

      {view === "contracts" ? (
        <BrokerContractsPage
          key={revision}
          onNewTemplateContract={() => openMode("new")}
          onImportTemplate={() => openMode("import")}
          onOpenTemplateContract={openInstance}
        />
      ) : (
        <TemplateLibrary
          templates={templates}
          loading={isLoadingTemplates}
          feedback={feedback}
          onImport={() => openMode("import")}
          onInspect={inspectTemplate}
          onUse={createFromTemplate}
        />
      )}

      <Dialog open={mode === "import"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="max-h-[95vh] max-w-[min(1120px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-black/[0.07] bg-white p-5 text-[#111111] shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-6">
          <DialogHeader><DialogTitle>{selectedTemplate ? "Estrutura do modelo" : "Importar modelo"}</DialogTitle><DialogDescription>{selectedTemplate ? "Consulte e revise os campos deste modelo reutilizável." : "Adicione o contrato que você já utiliza. O EME identifica os campos; você revisa e confirma."}</DialogDescription></DialogHeader>
          <ImportTemplatePanel key={selectedTemplate?.id ?? "new-import"} templates={templates} initialTemplate={selectedTemplate} onTemplatesChanged={loadTemplates} onClose={() => setMode(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "new"} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="max-w-2xl rounded-2xl border-black/[0.07] bg-white text-[#111111] shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <DialogHeader><DialogTitle>Escolha um modelo</DialogTitle><DialogDescription>Seus contratos, preparados com os dados da operação.</DialogDescription></DialogHeader>
          {isLoadingTemplates ? <div className="flex justify-center py-10"><Spinner className="size-6 text-[#009b3a]" /></div> : readyTemplates.length > 0 ? (
            <div className="grid gap-2">
              {readyTemplates.map((template) => (
                <button key={template.id} type="button" onClick={() => void createFromTemplate(template.id)} className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-4 text-left transition hover:border-[#009b3a]/20 hover:bg-[#f8fcf9]">
                  <span><strong className="block text-[#111]">{template.name}</strong><span className="mt-1 block text-xs text-[#7b8491]">Versão {template.currentVersion} · modelo próprio</span></span>
                  <Plus className="size-4 text-[#009b3a]" />
                </button>
              ))}
              <Button variant="outline" onClick={() => setMode("import")} className="mt-2 rounded-xl"><FileUp className="size-4" /> Importar novo modelo</Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-black/[0.08] bg-[#fbfbf8] p-8 text-center">
              <FileText className="mx-auto size-6 text-[#8b95a1]" />
              <p className="mt-3 font-medium text-[#111]">Você ainda não possui modelos.</p>
              <Button onClick={() => setMode("import")} className="mt-4 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">Importar modelo</Button>
            </div>
          )}
          {feedback ? <p className="rounded-xl bg-[#fff8e8] p-3 text-sm text-[#765a16]">{feedback}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={mode === "editor" && Boolean(instanceId)} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="h-[min(96dvh,1040px)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[1680px] overflow-hidden rounded-2xl border-black/[0.07] bg-white p-4 text-[#111111] shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:max-w-[1680px] sm:p-6">
          <DialogHeader className="sr-only"><DialogTitle>Editor de contrato por modelo próprio</DialogTitle><DialogDescription>Preencha os dados, revise a prontidão e gere o documento.</DialogDescription></DialogHeader>
          {instanceId ? (
            <InstanceEditor
              instanceId={instanceId}
              onChanged={() => setRevision((value) => value + 1)}
              onChangeTemplate={() => {
                setInstanceId(null)
                openMode("new")
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
