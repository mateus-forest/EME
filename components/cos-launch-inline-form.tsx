"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { ImagePlus, Mic, Square, X } from "lucide-react"

import type { CosLaunchForm } from "@/lib/cos-launch/types"

type Props = {
  form: CosLaunchForm
  busy: boolean
  onCancel: () => void
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
}

type Attachment = {
  id: string
  name: string
  type: string
  size: number
  category: "image" | "document"
  dataUrl: string
}

type SpeechRecognitionResultLike = {
  0?: { transcript?: string }
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

type SpeechRecognitionController = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionController

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Arquivo inválido"))
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"))
    reader.readAsDataURL(file)
  })
}

const initialValues = {
  source: "COS",
  agendaType: "Compromisso",
}

const incomeCategories = [
  { id: "COMMISSION", label: "Comissão" },
  { id: "FEES", label: "Honorários" },
  { id: "RENT", label: "Locação" },
  { id: "DEPOSIT", label: "Sinal" },
  { id: "OTHER", label: "Outro" },
]

const expenseCategories = [
  { id: "ADS", label: "Tráfego/anúncios" },
  { id: "PHOTOGRAPHY", label: "Fotografia" },
  { id: "TRAVEL", label: "Deslocamento" },
  { id: "DOCUMENTATION", label: "Documentação" },
  { id: "TOOLS", label: "Ferramentas" },
  { id: "OTHER", label: "Outros" },
]

const incomeStatuses = [
  { id: "EXPECTED", label: "Previsto" },
  { id: "RECEIVED", label: "Recebido" },
  { id: "OVERDUE", label: "Atrasado" },
]

const expenseStatuses = [
  { id: "PENDING", label: "Pendente" },
  { id: "PAID", label: "Pago" },
]

const inputClass =
  "min-h-10 w-full rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"

export function CosLaunchInlineForm({ form, busy, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({ ...initialValues, ...form.defaults })
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [fileError, setFileError] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionController | null>(null)

  useEffect(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setValues({ ...initialValues, ...form.defaults })
    setAttachments([])
    setFileError("")
    setIsRecording(false)

    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [form])

  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }))

  const field = (
    label: string,
    key: string,
    options: { type?: string; required?: boolean; placeholder?: string } = {},
  ) => (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        className={inputClass}
        type={options.type ?? "text"}
        required={options.required}
        placeholder={options.placeholder}
        value={values[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  )

  const select = (
    label: string,
    key: string,
    options: Array<{ id: string; label: string }>,
    required = false,
    emptyLabel = "Selecione",
  ) => (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <select
        className={inputClass}
        required={required}
        value={values[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )

  async function handleFiles(files: FileList | null) {
    if (!files) return
    setFileError("")

    const selected = Array.from(files)
    const isProperty = form.kind === "property"
    if (isProperty && attachments.length + selected.length > 8) {
      setFileError("Selecione no máximo 8 imagens.")
      return
    }
    if (
      selected.some((file) =>
        isProperty ? !file.type.startsWith("image/") : file.type !== "application/pdf",
      )
    ) {
      setFileError(isProperty ? "Use apenas imagens." : "Use um arquivo PDF.")
      return
    }
    if (selected.some((file) => file.size > 8 * 1024 * 1024)) {
      setFileError("Cada arquivo pode ter no máximo 8 MB.")
      return
    }

    const loaded = await Promise.all(
      selected.map(async (file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        category: (isProperty ? "image" : "document") as Attachment["category"],
        dataUrl: await readFile(file),
      })),
    )
    setAttachments((current) => (isProperty ? [...current, ...loaded] : loaded.slice(0, 1)))
  }

  function toggleRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const speechWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!Recognition) {
      setFileError("A gravação de áudio não está disponível neste navegador.")
      return
    }

    setFileError("")
    const recognition = new Recognition()
    recognition.lang = "pt-BR"
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index]?.[0]?.transcript ?? ""
      }
      const nextText = transcript.trim()
      if (nextText) {
        setValues((current) => ({
          ...current,
          description: [current.description?.trim(), nextText].filter(Boolean).join(" "),
        }))
      }
    }
    recognition.onerror = () => {
      setFileError("Não foi possível reconhecer o áudio. Tente novamente.")
      setIsRecording(false)
      recognitionRef.current = null
    }
    recognition.onend = () => {
      setIsRecording(false)
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    setIsRecording(true)
    recognition.start()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    recognitionRef.current?.stop()

    const payload: Record<string, unknown> = Object.fromEntries(
      Object.entries(values).filter(([, entryValue]) => entryValue.trim().length > 0),
    )
    if (attachments.length) payload.attachments = attachments
    if (form.kind === "property") payload.allowIncompleteDraft = true
    if (form.kind === "document") payload.fileName = attachments[0]?.name ?? ""
    await onSubmit(payload)
  }

  const propertyHasInput =
    Boolean(values.description?.trim()) || attachments.some((attachment) => attachment.category === "image")
  const submitDisabled =
    busy ||
    (form.kind === "document" && attachments.length === 0) ||
    (form.kind === "property" && !propertyHasInput)

  return (
    <form
      onSubmit={submit}
      className="rounded-[24px] border border-emerald-100 bg-emerald-50/55 p-3 shadow-sm sm:p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 sm:text-base">{form.title}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{form.description}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white bg-white text-slate-500"
          aria-label="Fechar formulário"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {form.kind === "property" ? (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white/80 px-3 text-xs font-semibold text-emerald-800">
              <ImagePlus className="size-4" />
              Adicionar fotos
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => void handleFiles(event.target.files)}
              />
            </label>
            <button
              type="button"
              onClick={toggleRecording}
              className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition ${
                isRecording
                  ? "border-emerald-300 bg-emerald-950 text-white"
                  : "border-slate-200 bg-white/80 text-slate-700"
              }`}
            >
              {isRecording ? <Square className="size-3.5" /> : <Mic className="size-4" />}
              {isRecording ? "Parar áudio" : "Gravar áudio"}
            </button>
          </div>

          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Principais detalhes
            <textarea
              className={`${inputClass} min-h-20 resize-none py-2.5`}
              value={values.description ?? ""}
              placeholder="Ex.: Apartamento para venda no Centro, 2 quartos, 70 m² e R$ 450 mil."
              onChange={(event) => set("description", event.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {form.kind === "client" ? (
            <>
              {field("Nome", "name", { required: true })}
              {field("WhatsApp", "phone", {
                required: true,
                placeholder: "(00) 00000-0000",
              })}
              {field("Interesse (opcional)", "interest")}
              {select("Imóvel relacionado (opcional)", "propertyId", form.properties ?? [])}
            </>
          ) : null}

          {form.kind === "proposal" ? (
            <>
              {select("Cliente", "leadId", form.clients ?? [], true)}
              {select("Imóvel", "propertyId", form.properties ?? [], true)}
              {field("Valor da proposta", "value", { required: true })}
            </>
          ) : null}

          {form.kind === "contract" ? (
            <>
              {field("Tipo de contrato", "contractType", {
                required: true,
                placeholder: "Ex.: Locação residencial",
              })}
              {select("Cliente", "leadId", form.clients ?? [], true)}
              {select("Imóvel (opcional)", "propertyId", form.properties ?? [])}
            </>
          ) : null}

          {form.kind === "agenda" ? (
            <>
              {field("Título", "title", { required: true })}
              {field("Data", "date", { type: "date", required: true })}
              {field("Horário", "time", { type: "time", required: true })}
            </>
          ) : null}

          {form.kind === "document" ? (
            <>
              {select("Cliente", "leadId", form.clients ?? [], true)}
              {field("Nome do documento", "documentName", { required: true })}
            </>
          ) : null}

          {form.kind === "financial_income" ? (
            <>
              {field("Descrição", "description", { required: true })}
              {select("Categoria", "category", incomeCategories, true)}
              {select("Cliente (opcional)", "leadId", form.clients ?? [])}
              {select("Imóvel (opcional)", "propertyId", form.properties ?? [])}
              {field("Valor", "amount", { required: true, placeholder: "R$ 0,00" })}
              {field("Data prevista", "dueDate", { type: "date", required: true })}
              {select("Status", "status", incomeStatuses, true)}
              {field("Data recebida (opcional)", "occurredAt", { type: "date" })}
              {select("Conta (opcional)", "accountId", form.accounts ?? [], false, "Sem conta vinculada")}
              <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
                Observação (opcional)
                <textarea className={`${inputClass} min-h-20 resize-none py-2.5`} value={values.notes ?? ""} onChange={(event) => set("notes", event.target.value)} />
              </label>
            </>
          ) : null}

          {form.kind === "financial_expense" ? (
            <>
              {field("Descrição", "description", { required: true })}
              {select("Categoria", "category", expenseCategories, true)}
              {select("Cliente (opcional)", "leadId", form.clients ?? [])}
              {select("Imóvel (opcional)", "propertyId", form.properties ?? [])}
              {field("Valor", "amount", { required: true, placeholder: "R$ 0,00" })}
              {field("Data", "dueDate", { type: "date", required: true })}
              {select("Status", "status", expenseStatuses, true)}
              {field("Data do pagamento (opcional)", "occurredAt", { type: "date" })}
              {select("Conta (opcional)", "accountId", form.accounts ?? [], false, "Sem conta vinculada")}
              <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
                Observação (opcional)
                <textarea className={`${inputClass} min-h-20 resize-none py-2.5`} value={values.notes ?? ""} onChange={(event) => set("notes", event.target.value)} />
              </label>
            </>
          ) : null}

          {form.kind === "financial_commission" ? (
            <>
              {select("Cliente", "leadId", form.clients ?? [], true)}
              {select("Imóvel", "propertyId", form.properties ?? [], true)}
              {field("Valor da operação", "operationAmount", { required: true, placeholder: "R$ 0,00" })}
              {field("Percentual de comissão", "commissionPercent", { required: true, placeholder: "Ex.: 6" })}
              {field("Previsão de recebimento", "dueDate", { type: "date", required: true })}
              {select("Status", "status", incomeStatuses, true)}
              {field("Recebido em (opcional)", "occurredAt", { type: "date" })}
              <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
                Observação (opcional)
                <textarea className={`${inputClass} min-h-20 resize-none py-2.5`} value={values.notes ?? ""} onChange={(event) => set("notes", event.target.value)} />
              </label>
            </>
          ) : null}
        </div>
      )}

      {form.kind === "document" ? (
        <div className="mt-3">
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-white/80 px-3 text-xs font-semibold text-emerald-800">
            <ImagePlus className="size-4" />
            Selecionar PDF
            <input
              className="sr-only"
              type="file"
              accept="application/pdf"
              onChange={(event) => void handleFiles(event.target.files)}
            />
          </label>
        </div>
      ) : null}

      {fileError ? <p className="mt-2 text-xs text-red-600">{fileError}</p> : null}

      {attachments.length ? (
        <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative shrink-0">
              {attachment.category === "image" ? (
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="size-16 rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-10 max-w-56 items-center rounded-xl bg-white px-3 text-xs text-slate-600">
                  {attachment.name}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setAttachments((current) =>
                    current.filter((item) => item.id !== attachment.id),
                  )
                }
                className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-slate-900 text-white"
                aria-label={`Remover ${attachment.name}`}
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitDisabled}
          className="min-h-10 rounded-full bg-emerald-950 px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Processando..." : form.submitLabel}
        </button>
      </div>
    </form>
  )
}
