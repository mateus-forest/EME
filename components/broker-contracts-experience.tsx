"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CopyPlus,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  LayoutTemplate,
  ListChecks,
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
  inspectContractTemplateStructure,
  renderContractTemplateHtml,
  type ContractFieldBinding,
  type ContractTemplateField,
  type ContractTemplateStructure,
} from "@/lib/contract-template-engine"
import type { LeadRecord } from "@/lib/lead-contract"
import type { PropertyApiItem } from "@/lib/property-contract"

type WorkspaceMode = "import" | "new" | "editor" | null
type WorkspaceView = "contracts" | "templates"
type TemplateEditorView = "document" | "fields"

const bindingSourceLabels: Record<ContractTemplateField["source"], string> = {
  CLIENT: "Dados do cliente",
  PROPERTY: "Dados do imóvel",
  BROKER: "Dados do corretor",
  CONTRACT: "Preenchimento manual",
  ADDITIONAL_PARTY: "Dados de outra parte",
  NONE: "Sem preenchimento automático",
}

const bindingSourceOrder: ContractTemplateField["source"][] = [
  "CLIENT",
  "PROPERTY",
  "BROKER",
  "CONTRACT",
  "ADDITIONAL_PARTY",
  "NONE",
]

function findTextOccurrence(text: string, needle: string, occurrenceIndex: number) {
  let cursor = 0
  for (let occurrence = 0; occurrence <= occurrenceIndex; occurrence += 1) {
    const index = text.indexOf(needle, cursor)
    if (index < 0) return -1
    if (occurrence === occurrenceIndex) return index
    cursor = index + needle.length
  }
  return -1
}

function TemplateDocumentText({
  text,
  fields,
  selectedFieldId,
  onSelectField,
}: {
  text: string
  fields: ContractTemplateField[]
  selectedFieldId: string | null
  onSelectField: (fieldId: string) => void
}) {
  const occurrences = fields
    .map((field) => ({ field, index: findTextOccurrence(text, field.exactText, field.occurrenceIndex) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
  const fragments: React.ReactNode[] = []
  let cursor = 0

  for (const occurrence of occurrences) {
    if (occurrence.index < cursor) continue
    if (occurrence.index > cursor) fragments.push(text.slice(cursor, occurrence.index))
    const isSelected = occurrence.field.id === selectedFieldId
    fragments.push(
      <button
        key={`${occurrence.field.id}-${occurrence.index}`}
        type="button"
        data-testid={`template-field-highlight-${occurrence.field.id}`}
        aria-label={`Configurar campo ${occurrence.field.label}`}
        onClick={() => onSelectField(occurrence.field.id)}
        className={`mx-0.5 inline rounded px-1.5 py-0.5 text-left font-medium underline decoration-dotted underline-offset-2 transition ${isSelected ? "bg-[#009b3a] text-white" : "bg-[#e8f5ec] text-[#116b34] hover:bg-[#d8eddf]"}`}
      >
        {occurrence.field.exactText}
      </button>,
    )
    cursor = occurrence.index + occurrence.field.exactText.length
  }
  if (cursor < text.length) fragments.push(text.slice(cursor))
  return <>{fragments}</>
}

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
  onEditorStateChange,
}: {
  templates: ContractTemplateRecord[]
  initialTemplate?: ContractTemplateRecord | null
  onTemplatesChanged: () => Promise<void>
  onClose: () => void
  onEditorStateChange?: (active: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [template, setTemplate] = useState<ContractTemplateRecord | null>(initialTemplate ?? null)
  const [name, setName] = useState(initialTemplate?.name ?? "")
  const [structure, setStructure] = useState<ContractTemplateStructure | null>(initialTemplate?.version?.structure ?? null)
  const [isBusy, setIsBusy] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [editorView, setEditorView] = useState<TemplateEditorView>("document")
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(initialTemplate?.version?.structure?.fields[0]?.id ?? null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)

  const legalTextModified = useMemo(() => {
    if (!template?.version?.structure || !structure) return false
    return JSON.stringify(template.version.structure.blocks) !== JSON.stringify(structure.blocks)
  }, [structure, template])
  const structureInspection = useMemo(
    () => structure ? inspectContractTemplateStructure(structure) : null,
    [structure],
  )
  const invalidFieldIds = useMemo(
    () => new Set(structureInspection?.invalidOccurrences.map((field) => field.id) ?? []),
    [structureInspection],
  )
  const selectedField = structure?.fields.find((field) => field.id === selectedFieldId) ?? null
  const fieldGroups = useMemo(() => {
    if (!structure) return []
    const blockOrder = new Map(structure.blocks.map((block, index) => [block.id, index]))
    const groups = new Map<string, { id: string; label: string; kind: "Parte" | "Seção"; fields: ContractTemplateField[] }>()

    for (const field of structure.fields) {
      const party = field.partyId ? structure.parties.find((item) => item.id === field.partyId) : null
      const fieldBlockIndex = blockOrder.get(field.blockId) ?? -1
      const section = structure.sections.find((item) => {
        const start = blockOrder.get(item.startBlockId) ?? -1
        const end = blockOrder.get(item.endBlockId) ?? -1
        return fieldBlockIndex >= start && fieldBlockIndex <= end
      })
      const id = party ? `party:${party.id}` : `section:${section?.id ?? "other"}`
      const existing = groups.get(id) ?? {
        id,
        label: party?.label || section?.title || "Outros campos",
        kind: party ? "Parte" as const : "Seção" as const,
        fields: [],
      }
      existing.fields.push(field)
      groups.set(id, existing)
    }
    return [...groups.values()]
  }, [structure])
  const documentSections = useMemo(() => {
    if (!structure) return []
    const blockOrder = new Map(structure.blocks.map((block, index) => [block.id, index]))
    const grouped = structure.sections.map((section) => {
      const start = blockOrder.get(section.startBlockId) ?? 0
      const end = blockOrder.get(section.endBlockId) ?? start
      return {
        ...section,
        blocks: structure.blocks.slice(Math.min(start, end), Math.max(start, end) + 1),
      }
    })
    const groupedBlockIds = new Set(grouped.flatMap((section) => section.blocks.map((block) => block.id)))
    const remaining = structure.blocks.filter((block) => !groupedBlockIds.has(block.id))
    if (remaining.length > 0) {
      grouped.push({
        id: "ungrouped",
        title: "Outros trechos",
        startBlockId: remaining[0].id,
        endBlockId: remaining.at(-1)?.id ?? remaining[0].id,
        blocks: remaining,
      })
    }
    return grouped
  }, [structure])

  useEffect(() => {
    onEditorStateChange?.(Boolean(template && structure))
  }, [onEditorStateChange, structure, template])

  useEffect(() => {
    if (!structure?.fields.length) {
      setSelectedFieldId(null)
      return
    }
    if (!structure.fields.some((field) => field.id === selectedFieldId)) {
      setSelectedFieldId(structure.fields[0].id)
    }
  }, [selectedFieldId, structure])

  async function beginReview(next: ContractTemplateRecord) {
    setIsBusy(true)
    setFeedback("")
    try {
      const detailed = next.version?.structure?.blocks?.length
        ? next
        : (await contractTemplates.get(next.id)).template
      if (!detailed.version?.structure?.blocks?.length) {
        setFeedback("O conteúdo deste modelo não pôde ser recuperado. Reanalise o arquivo original ou exclua o modelo.")
        return
      }
      setTemplate(detailed)
      setName(detailed.name)
      setStructure(detailed.version.structure)
      setSelectedFieldId(detailed.version.structure.fields[0]?.id ?? null)
      setEditorView("document")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível carregar o modelo.")
    } finally {
      setIsBusy(false)
    }
  }

  async function importFile() {
    if (!file) return
    setIsBusy(true)
    setFeedback("")
    try {
      const result = await contractTemplates.import(file)
      await onTemplatesChanged()
      if (result.template.status === "REVIEW_REQUIRED") await beginReview(result.template)
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

  function selectTemplateField(fieldId: string) {
    setSelectedFieldId(fieldId)
    if (window.innerWidth < 1024) {
      window.requestAnimationFrame(() => {
        document.querySelector('[data-testid="template-field-properties"]')?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }

  function removeField(fieldId: string) {
    setStructure((current) => current ? {
      ...current,
      fields: current.fields.filter((field) => field.id !== fieldId),
    } : current)
  }

  async function saveReview() {
    if (!template || !structure || !name.trim()) return
    if (!structureInspection?.hasUsableExtraction) {
      setFeedback("Este modelo ainda não possui campos variáveis e partes válidos. Reanalise o arquivo antes de salvar como pronto.")
      return
    }
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
      if (result.template.status === "REVIEW_REQUIRED") await beginReview(result.template)
      else setFeedback("A preparação deste modelo já está em andamento.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível reanalisar o modelo.")
    } finally {
      setIsBusy(false)
    }
  }

  async function deleteTemplate(item: ContractTemplateRecord) {
    if (!window.confirm(`Excluir o modelo “${item.name}”?`)) return
    setIsBusy(true)
    setFeedback("")
    try {
      await contractTemplates.delete(item.id)
      if (template?.id === item.id) {
        setTemplate(null)
        setStructure(null)
      }
      await onTemplatesChanged()
      setFeedback("Modelo excluído.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o modelo.")
    } finally {
      setIsBusy(false)
    }
  }

  if (template && structure) {
    return (
      <div data-testid="contract-template-editor" className="flex h-full min-h-0 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-black/[0.06] pb-4 pr-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setTemplate(null)} className="flex items-center gap-2 text-sm text-[#5f6b7a] hover:text-[#111]">
              <ArrowLeft className="size-4" /> Voltar aos modelos
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => window.open(`/api/brokers/contract-templates/${template.id}/original`, "_blank")} className="rounded-xl">
                <ExternalLink className="size-4" /> Abrir original
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm("Reanalisar inicia uma nova leitura do arquivo original. Deseja continuar?")) void reanalyze(template)
                }}
                disabled={isBusy}
                className="rounded-xl"
              >
                <RefreshCw className="size-4" /> Reanalisar
              </Button>
              <Button onClick={() => void saveReview()} disabled={isBusy || !name.trim() || !structureInspection?.hasUsableExtraction} className="rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">
                {isBusy ? <Spinner className="size-4" /> : <CheckCircle2 className="size-4" />} Salvar modelo
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="min-w-[min(100%,360px)] flex-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7b8491]">
              Nome do modelo
              <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 rounded-xl border-black/[0.08] bg-white text-base font-semibold normal-case tracking-normal text-[#111]" />
            </label>
            <div className="flex flex-wrap gap-2 text-xs text-[#5f6b7a]">
              <span className="rounded-full bg-[#f3f5f3] px-3 py-2">Versão {template.currentVersion}</span>
              <span className="rounded-full bg-[#edf8f1] px-3 py-2 text-[#17733a]">{structure.fields.length} campos</span>
              <span className="rounded-full bg-[#f3f5f3] px-3 py-2">{structure.parties.length} {structure.parties.length === 1 ? "parte" : "partes"}</span>
              <span className="rounded-full bg-[#f3f5f3] px-3 py-2">{structure.sections.length} {structure.sections.length === 1 ? "seção" : "seções"}</span>
            </div>
          </div>
          {feedback ? <p className="mt-3 rounded-xl bg-[#fff8e8] px-4 py-2.5 text-sm text-[#765a16]">{feedback}</p> : null}
          {structure.partiallyRecognized && structure.warnings[0] ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-[#765a16]"><AlertCircle className="size-4 shrink-0" /> {structure.warnings[0]}</p>
          ) : null}
          {legalTextModified ? (
            <p className="mt-3 flex items-center gap-2 text-xs text-[#765a16]"><AlertCircle className="size-4" /> O texto jurídico foi alterado e será salvo em uma nova revisão quando necessário.</p>
          ) : null}
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-4 lg:overflow-hidden">
          <section className="min-w-0 lg:overflow-y-auto lg:pr-1">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/[0.05] bg-white pb-3">
              <div className="inline-flex rounded-xl bg-[#f3f5f3] p-1" aria-label="Visão do editor">
                <button type="button" onClick={() => setEditorView("document")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${editorView === "document" ? "bg-white text-[#111] shadow-sm" : "text-[#687386]"}`}>
                  <FileText className="size-4" /> Documento
                </button>
                <button type="button" onClick={() => setEditorView("fields")} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${editorView === "fields" ? "bg-white text-[#111] shadow-sm" : "text-[#687386]"}`}>
                  <ListChecks className="size-4" /> Campos <span className="rounded-full bg-[#edf8f1] px-1.5 py-0.5 text-[10px] text-[#17733a]">{structure.fields.length}</span>
                </button>
              </div>
              <p className="hidden text-xs text-[#7b8491] sm:block">Clique em um campo para configurar</p>
            </div>

            {editorView === "document" ? (
              <div className="mx-auto mt-4 grid max-w-[920px] gap-4 pb-8">
                {documentSections.map((section) => (
                  <article key={section.id} className="rounded-2xl border border-black/[0.06] bg-[#fcfcfa] p-4 sm:p-5">
                    {section.id !== "ungrouped" ? (
                      <Input
                        aria-label={`Nome da seção ${section.title}`}
                        value={section.title}
                        onChange={(event) => setStructure((current) => current ? {
                          ...current,
                          sections: current.sections.map((item) => item.id === section.id ? { ...item, title: event.target.value } : item),
                        } : current)}
                        className="mb-4 h-9 border-0 bg-transparent px-0 text-sm font-semibold text-[#111] shadow-none focus-visible:ring-1"
                      />
                    ) : <h3 className="mb-4 text-sm font-semibold text-[#111]">{section.title}</h3>}
                    <div className="grid gap-3">
                      {section.blocks.map((block) => {
                        const blockFields = structure.fields.filter((field) => field.blockId === block.id)
                        return (
                          <div key={block.id} className="rounded-xl border border-black/[0.05] bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <select
                                aria-label={`Tipo do trecho ${block.order + 1}`}
                                value={block.type}
                                onChange={(event) => setStructure((current) => current ? {
                                  ...current,
                                  blocks: current.blocks.map((item) => item.id === block.id ? { ...item, type: event.target.value as ContractTemplateStructure["blocks"][number]["type"] } : item),
                                } : current)}
                                className="h-8 rounded-lg border border-black/[0.07] bg-[#fafaf7] px-2 text-[11px] text-[#687386]"
                              >
                                <option value="TITLE">Título</option>
                                <option value="HEADING">Cabeçalho</option>
                                <option value="CLAUSE">Cláusula</option>
                                <option value="PARAGRAPH">Parágrafo</option>
                                <option value="SIGNATURE">Assinatura</option>
                              </select>
                              <button type="button" onClick={() => setEditingBlockId((current) => current === block.id ? null : block.id)} className="flex items-center gap-1.5 text-xs text-[#5f6b7a] hover:text-[#111]">
                                <PenLine className="size-3.5" /> {editingBlockId === block.id ? "Concluir edição" : "Editar texto"}
                              </button>
                            </div>
                            <div className={`mt-3 whitespace-pre-wrap text-sm leading-7 text-[#303740] ${block.type === "TITLE" ? "text-center font-semibold uppercase" : block.type === "HEADING" || block.type === "CLAUSE" ? "font-medium" : ""}`}>
                              <TemplateDocumentText text={block.text} fields={blockFields} selectedFieldId={selectedFieldId} onSelectField={selectTemplateField} />
                            </div>
                            {editingBlockId === block.id ? (
                              <div className="mt-3 border-t border-black/[0.05] pt-3">
                                <p className="mb-2 text-xs leading-5 text-[#765a16]">Edite somente quando necessário. Remover um trecho destacado torna o campo inconsistente.</p>
                                <Textarea
                                  aria-label={`Texto do trecho ${block.order + 1}`}
                                  value={block.text}
                                  onChange={(event) => setStructure((current) => current ? {
                                    ...current,
                                    blocks: current.blocks.map((item) => item.id === block.id ? { ...item, text: event.target.value } : item),
                                  } : current)}
                                  rows={Math.min(12, Math.max(4, Math.ceil(block.text.length / 90)))}
                                  className="text-sm leading-6 text-[#111]"
                                />
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 grid gap-5 pb-8">
                <section className="rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-[#111]">Partes do contrato</h3><span className="text-xs text-[#7b8491]">{structure.parties.length} identificadas</span></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {structure.parties.length > 0 ? structure.parties.map((party) => (
                      <label key={party.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-[#17733a]">
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
                    )) : <p className="text-sm text-[#6b7280]">Nenhuma parte foi identificada.</p>}
                  </div>
                </section>
                {fieldGroups.map((group) => (
                  <section key={group.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-[10px] uppercase tracking-[0.14em] text-[#8b95a1]">{group.kind}</p><h3 className="mt-1 font-semibold text-[#111]">{group.label}</h3></div>
                      <span className="text-xs text-[#7b8491]">{group.fields.length} campo{group.fields.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {group.fields.map((field) => {
                        const hasIssue = invalidFieldIds.has(field.id) || field.reviewStatus !== "CONFIRMED"
                        return (
                          <button
                            key={field.id}
                            type="button"
                            onClick={() => selectTemplateField(field.id)}
                            aria-pressed={selectedFieldId === field.id}
                            className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${selectedFieldId === field.id ? "border-[#009b3a]/30 bg-[#edf8f1]" : hasIssue ? "border-[#e8cf91] bg-[#fffaf0]" : "border-black/[0.05] bg-[#fafaf7] hover:border-black/[0.12]"}`}
                          >
                            <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${hasIssue ? "bg-[#fff1cc] text-[#8b6614]" : "bg-white text-[#17733a]"}`}>{hasIssue ? <AlertCircle className="size-4" /> : <Check className="size-4" />}</span>
                            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#111]">{field.label}</strong><span className="mt-0.5 block truncate text-xs text-[#687386]">{bindingSourceLabels[field.source]}</span></span>
                            <ChevronRight className="size-4 shrink-0 text-[#9aa1aa]" />
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 border-t border-black/[0.06] bg-[#fbfbf8] p-4 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-5">
            {selectedField ? (
              <div data-testid="template-field-properties" className="grid gap-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Propriedades do campo</p>
                  <h2 className="mt-2 text-lg font-semibold text-[#111]">{selectedField.label}</h2>
                  <p className="mt-1 break-words text-xs leading-5 text-[#7b8491]">Trecho detectado: “{selectedField.exactText}”</p>
                </div>

                {invalidFieldIds.has(selectedField.id) ? (
                  <p className="flex gap-2 rounded-xl border border-[#ead5a0] bg-[#fff8e8] p-3 text-sm leading-5 text-[#765a16]"><AlertCircle className="mt-0.5 size-4 shrink-0" /> Este trecho não corresponde mais ao texto do documento. Restaure o texto ou mantenha o campo como texto fixo.</p>
                ) : selectedField.reviewStatus !== "CONFIRMED" ? (
                  <p className="flex gap-2 rounded-xl bg-[#fff8e8] p-3 text-sm leading-5 text-[#765a16]"><AlertCircle className="mt-0.5 size-4 shrink-0" /> Confira como este campo deve ser preenchido antes de salvar.</p>
                ) : null}

                <label className="grid gap-1.5 text-xs font-medium text-[#5f6b7a]">
                  Nome do campo
                  <Input value={selectedField.label} onChange={(event) => updateField(selectedField.id, { label: event.target.value })} className="bg-white text-sm text-[#111]" />
                </label>

                <label className="grid gap-1.5 text-xs font-medium text-[#5f6b7a]">
                  Preencher com
                  <select
                    aria-label="Preencher com"
                    value={selectedField.binding}
                    onChange={(event) => {
                      const binding = event.target.value as ContractFieldBinding
                      const option = contractBindingOptions.find((item) => item.value === binding)
                      updateField(selectedField.id, { binding, source: option?.source ?? "NONE", reviewStatus: "CONFIRMED" })
                    }}
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111]"
                  >
                    {bindingSourceOrder.map((source) => (
                      <optgroup key={source} label={bindingSourceLabels[source]}>
                        {contractBindingOptions.filter((option) => option.source === source).map((option) => <option key={option.value} value={option.value}>{option.label.split(" / ").at(-1)}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <span className="font-normal leading-5 text-[#8b95a1]">{bindingSourceLabels[selectedField.source]}</span>
                </label>

                <label className="grid gap-1.5 text-xs font-medium text-[#5f6b7a]">
                  Parte relacionada
                  <select
                    value={selectedField.partyId ?? ""}
                    onChange={(event) => updateField(selectedField.id, { partyId: event.target.value || null })}
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111]"
                  >
                    <option value="">Nenhuma parte específica</option>
                    {structure.parties.map((party) => <option key={party.id} value={party.id}>{party.label}</option>)}
                  </select>
                </label>

                <label className="grid gap-1.5 text-xs font-medium text-[#5f6b7a]">
                  Formato do valor
                  <select
                    value={selectedField.type}
                    onChange={(event) => updateField(selectedField.id, { type: event.target.value as ContractTemplateField["type"] })}
                    className="h-11 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111]"
                  >
                    <option value="TEXT">Texto</option><option value="LONG_TEXT">Texto longo</option><option value="DATE">Data</option><option value="CURRENCY">Valor monetário</option><option value="NUMBER">Número</option><option value="CPF_CNPJ">CPF ou CNPJ</option><option value="PHONE">Telefone</option><option value="EMAIL">E-mail</option>
                  </select>
                </label>

                <label className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-3 text-sm text-[#4b5563]">
                  Campo obrigatório
                  <input type="checkbox" checked={selectedField.required} onChange={(event) => updateField(selectedField.id, { required: event.target.checked })} className="size-4 accent-[#009b3a]" />
                </label>

                <button type="button" onClick={() => removeField(selectedField.id)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#eedbd8] bg-white text-sm text-[#8a4a44] hover:bg-[#fff1ef]">
                  <Trash2 className="size-4" /> Manter como texto fixo
                </button>
                <p className="text-xs leading-5 text-[#7b8491]">Salvar confirma os campos revisados. O conteúdo jurídico não é reescrito automaticamente.</p>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.08] bg-white p-6 text-center">
                <LayoutTemplate className="size-6 text-[#9aa1aa]" />
                <p className="mt-3 text-sm font-medium text-[#111]">Selecione um campo</p>
                <p className="mt-1 text-xs leading-5 text-[#7b8491]">Clique em um destaque no documento ou em um item da visão Campos.</p>
              </div>
            )}
          </aside>
        </div>
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
              <div key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-black/[0.06] bg-white p-2">
                <button type="button" onClick={() => void beginReview(item)} className="flex min-w-0 flex-1 items-center justify-between p-2 text-left">
                  <span className="min-w-0"><strong className="block truncate text-sm text-[#111]">{item.name}</strong><span className="text-xs text-[#7b8491]">Revisar campos antes de utilizar</span></span>
                  <PenLine className="size-4 shrink-0 text-[#009b3a]" />
                </button>
                <Button type="button" variant="ghost" aria-label={`Excluir modelo ${item.name}`} onClick={() => void deleteTemplate(item)} className="size-9 shrink-0 rounded-lg p-0 text-[#b54747]"><Trash2 className="size-4" /></Button>
              </div>
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
              <button key={item.id} type="button" onClick={() => void beginReview(item)} className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white p-4 text-left">
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
                <span className="flex gap-2"><Button variant="outline" disabled={isBusy} onClick={() => void reanalyze(item)} className="rounded-xl">Reanalisar modelo</Button><Button variant="ghost" aria-label={`Excluir modelo ${item.name}`} disabled={isBusy} onClick={() => void deleteTemplate(item)} className="rounded-xl text-[#b54747]"><Trash2 className="size-4" /> Excluir</Button></span>
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
  onDelete,
}: {
  templates: ContractTemplateRecord[]
  loading: boolean
  feedback: string
  onImport: () => void
  onInspect: (template: ContractTemplateRecord) => void
  onUse: (templateId: string) => Promise<void>
  onDelete: (template: ContractTemplateRecord) => Promise<void>
}) {
  const ready = templates.filter((template) => template.status === "READY")
  const pending = templates.filter((template) => template.status !== "READY")

  return (
    <div className="grid gap-4">
      <section className="rounded-[var(--broker-radius-lg)] border border-[var(--broker-border)] bg-[var(--broker-surface)] px-4 py-4 shadow-[var(--broker-shadow)] sm:px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#9aa4b2]">Biblioteca reutilizável</p>
            <h2 className="mt-1.5 flex items-center gap-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-[#050505]"><LayoutTemplate className="size-5 text-[#009b3a]" /> Modelos</h2>
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
                <span className="mt-3 block text-sm text-[#5f6b7a]">Editar estrutura, texto, campos e bindings</span>
              </button>
              <div className="flex gap-2 border-t border-black/[0.05] pt-4">
                <Button variant="outline" onClick={() => onInspect(template)} className="flex-1 rounded-xl">Editar modelo</Button>
                <Button disabled={loading} onClick={() => void onUse(template.id)} className="flex-1 rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]"><Plus className="size-4" /> Usar modelo</Button>
                <Button variant="ghost" disabled={loading} aria-label={`Excluir modelo ${template.name}`} onClick={() => void onDelete(template)} className="size-10 shrink-0 rounded-xl p-0 text-[#b54747]"><Trash2 className="size-4" /></Button>
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
              <div key={template.id} className="flex min-w-0 items-center gap-2 rounded-xl bg-[#fbfbf8] p-2">
                <button type="button" onClick={() => onInspect(template)} className="flex min-w-0 flex-1 items-center justify-between p-2 text-left">
                  <span className="min-w-0"><strong className="block truncate text-sm text-[#111]">{template.name}</strong><span className="text-xs text-[#7b8491]">{template.status === "ANALYZING" ? "Em preparação" : template.status === "FAILED" ? "Precisa de atenção" : "Aguardando revisão"}</span></span>
                  {template.status === "ANALYZING" ? <Spinner className="size-4 shrink-0 text-[#009b3a]" /> : <PenLine className="size-4 shrink-0 text-[#5f6b7a]" />}
                </button>
                <Button variant="ghost" disabled={loading} aria-label={`Excluir modelo ${template.name}`} onClick={() => void onDelete(template)} className="size-9 shrink-0 rounded-lg p-0 text-[#b54747]"><Trash2 className="size-4" /></Button>
              </div>
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
  const [showAllFields, setShowAllFields] = useState(false)

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
    const groups = new Map<string, { id: string; label: string; fields: ContractTemplateField[] }>()
    const monetaryBindings = new Set<ContractFieldBinding>([
      "property.price",
      "contract.value",
      "contract.paymentMethod",
      "contract.guarantee",
      "contract.duration",
      "contract.dueDate",
    ])

    for (const field of instance.structure.fields) {
      const party = field.partyId ? instance.structure.parties.find((item) => item.id === field.partyId) : null
      const block = instance.structure.blocks.find((item) => item.id === field.blockId)
      const isSignature = block?.type === "SIGNATURE" || /\b(assinatura|testemunha)\b/i.test(field.label)
      const isValue = field.type === "CURRENCY" || monetaryBindings.has(field.binding)
      const group = party
        ? { id: `party-${party.id}`, label: party.label }
        : isSignature
          ? { id: "signature", label: "Assinatura" }
          : field.source === "PROPERTY"
            ? { id: "property", label: "Imóvel" }
            : field.source === "CLIENT"
              ? { id: "client", label: "Cliente" }
              : field.source === "BROKER"
                ? { id: "broker", label: "Corretor" }
                : field.source === "ADDITIONAL_PARTY"
                  ? { id: "additional-parties", label: "Outras partes" }
                  : isValue
                    ? { id: "values", label: "Valores e condições" }
                    : field.source === "CONTRACT"
                      ? { id: "contract", label: "Dados do contrato" }
                      : { id: "other", label: "Outros dados" }
      const existing = groups.get(group.id) ?? { ...group, fields: [] }
      existing.fields.push(field)
      groups.set(group.id, existing)
    }

    return [...groups.values()].map((group) => ({
      ...group,
      fields: [...group.fields].sort((left, right) => {
        const priority = (field: ContractTemplateField) => {
          if (field.required && !values[field.id]?.trim()) return 0
          if (!values[field.id]?.trim()) return 1
          return 2
        }
        return priority(left) - priority(right)
      }),
    }))
  }, [instance, values])

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

  async function cancel() {
    if (!instance || !window.confirm("Cancelar este contrato?")) return
    setIsBusy(true)
    setFeedback("")
    try {
      const result = await templateContracts.cancel(instance.id)
      applyInstance(result.instance)
      onChanged()
      setFeedback("Contrato cancelado.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível cancelar o contrato.")
    } finally {
      setIsBusy(false)
    }
  }

  async function deleteInstance() {
    if (!instance || !window.confirm("Excluir este contrato? Esta ação não pode ser desfeita.")) return
    setIsBusy(true)
    setFeedback("")
    try {
      await templateContracts.delete(instance.id)
      onChanged()
      onChangeTemplate()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o contrato.")
    } finally {
      setIsBusy(false)
    }
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

  function focusContractField(fieldId: string) {
    window.requestAnimationFrame(() => {
      const field = document.getElementById(`contract-field-${fieldId}`)
      field?.scrollIntoView({ behavior: "smooth", block: "center" })
      field?.focus({ preventScroll: true })
    })
  }

  if (isBusy && !instance) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="size-6 text-[#009b3a]" /></div>
  if (!instance) return <p className="rounded-xl bg-[#fff8e8] p-4 text-sm text-[#765a16]">{feedback || "Contrato não encontrado."}</p>

  return (
      <div data-testid="contract-instance-editor" className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4 pr-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Preencher contrato · modelo versão {instance.template.version}</p>
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
          {instance.status !== "signed" && instance.status !== "cancelled" ? <Button variant="ghost" onClick={() => void cancel()} disabled={isBusy} className="rounded-xl text-[#b54747]">Cancelar</Button> : null}
          <Button variant="ghost" onClick={() => void deleteInstance()} disabled={isBusy} className="rounded-xl text-[#b54747]"><Trash2 className="size-4" /> Excluir</Button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 gap-4 overflow-x-hidden overflow-y-auto pt-4 lg:grid-cols-[minmax(300px,0.64fr)_minmax(0,1.36fr)] lg:items-start">
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
              <select disabled={isBusy} value={leadId} onChange={(event) => { const value = event.target.value; setLeadId(value); void save({ leadId: value }) }} className="h-10 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111] disabled:cursor-wait disabled:opacity-60">
                <option value="">Selecionar cliente</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.email || "Cliente sem nome"}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-[#687386]">Imóvel
              <select disabled={isBusy} value={propertyId} onChange={(event) => { const value = event.target.value; setPropertyId(value); void save({ propertyId: value }) }} className="h-10 rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111] disabled:cursor-wait disabled:opacity-60">
                <option value="">Selecionar imóvel</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
              </select>
            </label>
          </section>

          {instance.structure.parties.filter((party) => instance.structure.fields.some((field) => field.partyId === party.id && field.source === "ADDITIONAL_PARTY")).map((party) => (
            <section key={party.id} className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <p className="text-sm font-semibold text-[#111]">{party.label}</p>
              <select
                disabled={isBusy}
                value={additionalParties[party.id]?.leadId ?? ""}
                onChange={(event) => {
                  const next = { ...additionalParties, [party.id]: { ...(additionalParties[party.id] ?? {}), leadId: event.target.value || undefined } }
                  setAdditionalParties(next)
                  void save({ additionalParties: next })
                }}
                className="mt-2 h-10 w-full rounded-xl border border-black/[0.08] bg-white px-3 text-sm text-[#111] disabled:cursor-wait disabled:opacity-60"
              >
                <option value="">Cadastrar dados neste contrato</option>
                {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.email || "Pessoa sem nome"}</option>)}
              </select>
            </section>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#111]">Campos do contrato</p>
              <p className="mt-0.5 text-xs text-[#7b8491]">Pendências obrigatórias aparecem primeiro.</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAllFields((current) => !current)}
              className="h-9 rounded-lg border border-black/[0.06] bg-white px-3 text-xs text-[#4b5563]"
            >
              {showAllFields ? "Mostrar somente em aberto" : "Mostrar todos os campos"}
            </Button>
          </div>

          {groupedFields.map((group) => {
            const completedCount = group.fields.filter((field) => values[field.id]?.trim()).length
            const visibleFields = showAllFields
              ? group.fields
              : group.fields.filter((field) => !instance.values[field.id]?.trim() || !values[field.id]?.trim())
            return (
            <section key={group.id} data-testid={`contract-field-group-${group.id}`} className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">{group.label}</p>
                <span className="text-[11px] text-[#7b8491]">{completedCount}/{group.fields.length} preenchidos</span>
              </div>
              {visibleFields.length > 0 ? <div className="mt-3 grid gap-3">
                {visibleFields.map((field) => (
                  <label key={field.id} className="grid gap-1.5 text-xs text-[#687386]">
                    <span className="flex items-center justify-between gap-2"><span>{field.label}{field.required ? " *" : ""}</span><span className={fieldState(field).tone}>{fieldState(field).label}</span></span>
                    <FieldInput field={field} value={values[field.id] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />
                  </label>
                ))}
              </div> : (
                <p className="mt-3 rounded-xl bg-[#f7faf7] px-3 py-2 text-xs text-[#17733a]">
                  Campos preenchidos recolhidos para manter o formulário compacto.
                </p>
              )}
              {!showAllFields && completedCount > 0 && visibleFields.length > 0 ? (
                <p className="mt-3 text-[11px] text-[#7b8491]">{completedCount} campo{completedCount === 1 ? "" : "s"} preenchido{completedCount === 1 ? "" : "s"} recolhido{completedCount === 1 ? "" : "s"}.</p>
              ) : null}
            </section>
          )})}
          <Button onClick={() => void save()} disabled={isBusy} className="rounded-xl bg-[#009b3a] text-white hover:bg-[#008633]">{isBusy ? <Spinner className="size-4" /> : <Check className="size-4" />} Salvar alterações</Button>
        </aside>

        <main data-testid="contract-editor-preview" className="min-w-0 rounded-2xl bg-[#f3f2ee] p-3 sm:p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <p className="mb-3 text-center text-[11px] uppercase tracking-[0.16em] text-[#8b95a1]">Preview A4 sincronizado</p>
          <div className="mx-auto aspect-[210/297] w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-[0_12px_35px_rgba(15,23,42,.08)]">
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
                onClick={() => group.missing[0] && focusContractField(group.missing[0].id)}
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
              <button key={field.id} type="button" onClick={() => focusContractField(field.id)} className="flex items-start gap-2 rounded-lg bg-white p-2 text-left text-xs text-[#765a16]">
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
  const [isTemplateEditorActive, setIsTemplateEditorActive] = useState(false)
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
    if (next === "import") {
      setSelectedTemplate(null)
      setIsTemplateEditorActive(false)
    }
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

  async function deleteTemplate(template: ContractTemplateRecord) {
    if (!window.confirm(`Excluir o modelo “${template.name}”?`)) return
    setIsLoadingTemplates(true)
    setFeedback("")
    try {
      await contractTemplates.delete(template.id)
      if (selectedTemplate?.id === template.id) setSelectedTemplate(null)
      await loadTemplates()
      setFeedback("Modelo excluído.")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível excluir o modelo.")
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  function openInstance(id: string) {
    setInstanceId(id)
    setMode("editor")
  }

  const readyTemplates = templates.filter((template) => template.status === "READY")

  useEffect(() => {
    if (view === "templates") void loadTemplates()
  }, [loadTemplates, view])

  async function inspectTemplate(template: ContractTemplateRecord) {
    setIsLoadingTemplates(true)
    setFeedback("")
    try {
      const detailed = template.version?.structure?.blocks?.length
        ? template
        : (await contractTemplates.get(template.id)).template
      setSelectedTemplate(detailed)
      setIsTemplateEditorActive(true)
      setMode("import")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível consultar o modelo.")
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  return (
    <>
      <div className="mb-3 flex w-fit rounded-xl border border-[var(--broker-border)] bg-[var(--broker-surface)] p-1 shadow-[var(--broker-shadow)]">
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
          onInspect={(template) => { void inspectTemplate(template) }}
          onUse={createFromTemplate}
          onDelete={deleteTemplate}
        />
      )}

      <Dialog open={mode === "import"} onOpenChange={(open) => {
        if (!open) {
          setMode(null)
          setIsTemplateEditorActive(false)
        }
      }}>
        <DialogContent className={isTemplateEditorActive
          ? "h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-white p-4 text-[#111111] shadow-none sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:w-[calc(100vw-1rem)] sm:max-w-[1800px] sm:rounded-2xl sm:border sm:border-black/[0.07] sm:p-5 sm:shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
          : "max-h-[95vh] max-w-[min(1120px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-black/[0.07] bg-white p-5 text-[#111111] shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-6"}
        >
          <DialogHeader className={isTemplateEditorActive ? "sr-only" : undefined}><DialogTitle>{isTemplateEditorActive ? "Editar modelo" : "Importar modelo"}</DialogTitle><DialogDescription>{isTemplateEditorActive ? "Revise a estrutura, o texto jurídico e como cada campo será preenchido." : "Adicione o contrato que você já utiliza. O EME identifica os campos; você revisa e confirma."}</DialogDescription></DialogHeader>
          <ImportTemplatePanel
            key={selectedTemplate?.id ?? "new-import"}
            templates={templates}
            initialTemplate={selectedTemplate}
            onTemplatesChanged={loadTemplates}
            onClose={() => {
              setMode(null)
              setIsTemplateEditorActive(false)
            }}
            onEditorStateChange={setIsTemplateEditorActive}
          />
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
          <DialogHeader className="sr-only"><DialogTitle>Preencher contrato</DialogTitle><DialogDescription>Selecione cliente e imóvel, complete os valores da instância e gere o documento.</DialogDescription></DialogHeader>
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
