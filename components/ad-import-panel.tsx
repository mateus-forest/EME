"use client"

import { useEffect, useMemo, useState } from "react"
import { FileCode2, ImagePlus, LinkIcon, Sparkles, Upload } from "lucide-react"

import { confirmPropertyAdImport, extractPropertyAd, getPropertyImportCapabilities } from "@/lib/property-ad-import-client"
import { propertyImportTypeOptions, type AdImportDraft } from "@/lib/property-ad-import-shared"
import { previewPropertyXml } from "@/lib/property-xml-import-client"
import { formatCurrencyInput } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const emptyDraft: AdImportDraft = {
  title: "",
  description: "",
  price: "",
  type: "Apartamento",
  city: "",
  neighborhood: "",
  address: "",
  bedrooms: 0,
  bathrooms: 0,
  parking: 0,
  area: "",
  features: [],
  tags: [],
  images: [],
  sourceUrl: "",
  notes: "",
  lowConfidenceFields: [],
  missingFields: [],
  status: "needs_review",
}

type DraftEntry = {
  id: string
  draft: AdImportDraft
}

function buildDraftEntries(drafts: AdImportDraft[]) {
  return drafts.map((draft, index) => ({
    id: `${draft.title || "imovel"}-${index}`,
    draft,
  }))
}

export function AdImportPanel({ onImported }: { onImported: () => void | Promise<void> }) {
  const [xmlSourceUrl, setXmlSourceUrl] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState("")
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [feedback, setFeedback] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiImportEnabled, setAiImportEnabled] = useState(true)
  const [aiImportReason, setAiImportReason] = useState("")

  useEffect(() => {
    let isMounted = true

    void getPropertyImportCapabilities()
      .then((capabilities) => {
        if (!isMounted) return
        setAiImportEnabled(capabilities.aiImportEnabled)
        setAiImportReason(capabilities.aiImportReason)
      })
      .catch(() => {
        if (!isMounted) return
        setAiImportEnabled(false)
        setAiImportReason("Nao foi possivel validar os recursos de importacao neste ambiente.")
      })

    return () => {
      isMounted = false
    }
  }, [])

  const draft = useMemo(
    () => draftEntries.find((entry) => entry.id === selectedDraftId)?.draft ?? null,
    [draftEntries, selectedDraftId],
  )

  function resetInputs() {
    setXmlSourceUrl("")
    setSourceUrl("")
    setImage(null)
  }

  function clearFlow() {
    setDraftEntries([])
    setSelectedDraftId("")
    setSelectedDraftIds([])
    resetInputs()
  }

  function applyDrafts(drafts: AdImportDraft[], message: string) {
    const entries = buildDraftEntries(drafts)
    setDraftEntries(entries)
    setSelectedDraftId(entries[0]?.id ?? "")
    setSelectedDraftIds(entries.map((entry) => entry.id))
    setFeedback(message)
  }

  function toggleDraftSelection(id: string) {
    setSelectedDraftIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  function updateDraft<K extends keyof AdImportDraft>(field: K, value: AdImportDraft[K]) {
    setDraftEntries((current) =>
      current.map((entry) => (entry.id === selectedDraftId ? { ...entry, draft: { ...entry.draft, [field]: value } } : entry)),
    )
  }

  async function handleXmlImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const isXml = file.name.toLowerCase().endsWith(".xml") || ["text/xml", "application/xml"].includes(file.type)
    if (!isXml) {
      setFeedback("Envie um arquivo XML valido para revisar antes de importar.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback("O XML deve ter ate 5 MB.")
      return
    }

    setIsExtracting(true)
    setFeedback("")
    setDraftEntries([])
    setSelectedDraftId("")
    setSelectedDraftIds([])

    try {
      const result = await previewPropertyXml({ file })
      applyDrafts(result.drafts, result.drafts.length > 1 ? "XML analisado. Revise e salve um imovel por vez." : "XML analisado. Revise as informacoes antes de salvar.")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel analisar o XML.")
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleXmlImportUrl() {
    if (!xmlSourceUrl.trim()) {
      setFeedback("Informe a URL do XML para analisar antes de importar.")
      return
    }

    setIsExtracting(true)
    setFeedback("")
    setDraftEntries([])
    setSelectedDraftId("")
    setSelectedDraftIds([])

    try {
      const result = await previewPropertyXml({ sourceUrl: xmlSourceUrl.trim() })
      applyDrafts(result.drafts, result.drafts.length > 1 ? "XML analisado. Revise e salve um imovel por vez." : "XML analisado. Revise as informacoes antes de salvar.")
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel analisar o XML.")
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleExtract() {
    if (!aiImportEnabled) {
      setFeedback(aiImportReason || "A importacao inteligente nao esta disponivel neste ambiente.")
      return
    }

    if (!sourceUrl.trim() && !image) {
      setFeedback("Informe o link do anuncio, envie uma imagem ou use XML para iniciar a extracao.")
      return
    }

    setIsExtracting(true)
    setFeedback("")
    setDraftEntries([])
    setSelectedDraftId("")
    setSelectedDraftIds([])

    try {
      const result = await extractPropertyAd({ sourceUrl: sourceUrl.trim(), image })
      applyDrafts(
        result.drafts,
        result.drafts.length > 1
          ? "Varios imoveis foram identificados. Escolha quais deseja cadastrar e revise cada previa."
          : "Dados extraidos. Revise as informacoes antes de salvar.",
      )
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel extrair os dados do anuncio.")
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleConfirm() {
    if (!draft) return

    setIsSaving(true)
    setFeedback("")

    try {
      await confirmPropertyAdImport(draft)
      const remainingEntries = draftEntries.filter((entry) => entry.id !== selectedDraftId)
      setDraftEntries(remainingEntries)
      setSelectedDraftId(remainingEntries[0]?.id ?? "")
      setFeedback(remainingEntries.length > 0 ? "Imovel salvo. Revise o proximo item antes de confirmar." : "Imovel criado como rascunho.")
      if (remainingEntries.length === 0) {
        resetInputs()
      }
      await onImported()
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel criar o imovel.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmSelected() {
    const selectedEntries = draftEntries.filter((entry) => selectedDraftIds.includes(entry.id))
    if (selectedEntries.length === 0) {
      setFeedback("Selecione pelo menos um imovel para cadastrar.")
      return
    }

    setIsSaving(true)
    setFeedback("")

    try {
      for (const entry of selectedEntries) {
        await confirmPropertyAdImport(entry.draft)
      }

      const remainingEntries = draftEntries.filter((entry) => !selectedDraftIds.includes(entry.id))
      setDraftEntries(remainingEntries)
      setSelectedDraftId(remainingEntries[0]?.id ?? "")
      setSelectedDraftIds(remainingEntries.map((entry) => entry.id))
      setFeedback(
        remainingEntries.length > 0
          ? "Imoveis selecionados salvos. Revise os demais antes de confirmar."
          : "Imoveis selecionados criados como rascunho.",
      )
      if (remainingEntries.length === 0) {
        resetInputs()
      }
      await onImported()
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel criar os imoveis selecionados.")
    } finally {
      setIsSaving(false)
    }
  }

  const currentDraft = draft ?? emptyDraft
  const fieldsToReview = [...currentDraft.lowConfidenceFields, ...currentDraft.missingFields]

  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div>
        <h3 className="text-lg font-semibold text-[#111111]">Importar imovel</h3>
        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
          XML, URL de XML, link do anuncio e print/imagem alimentam a mesma previa revisavel antes do cadastro.
        </p>
      </div>

      {!draft ? (
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid min-h-44 cursor-pointer gap-3 rounded-[1.5rem] border border-black/[0.06] bg-white p-5 transition-colors hover:border-[#009b3a]/30 hover:bg-[#009b3a]/[0.05]">
              <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(event) => void handleXmlImport(event.target.files)} />
              <Upload className="size-8 text-[#009b3a]" />
              <div>
                <h4 className="text-lg font-semibold text-[#111111]">Importar XML</h4>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">Upload do XML para leitura, extracao e previa antes do salvamento.</p>
              </div>
            </label>
            <div className="grid min-h-44 gap-3 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
              <FileCode2 className="size-8 text-[#009b3a]" />
              <div>
                <h4 className="text-lg font-semibold text-[#111111]">Importar XML por URL</h4>
                <p className="mt-2 text-sm leading-6 text-[#6B7280]">Cole a URL do XML e gere a mesma previa revisavel.</p>
              </div>
              <Input
                value={xmlSourceUrl}
                onChange={(event) => setXmlSourceUrl(event.target.value)}
                placeholder="https://.../imoveis.xml"
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111] placeholder:text-[#9CA3AF]"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleXmlImportUrl()}
                disabled={isExtracting}
                className="h-10 w-fit rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-60"
              >
                {isExtracting ? "Analisando..." : "Analisar XML"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white p-5">
            <div>
              <h4 className="text-lg font-semibold text-[#111111]">Importar anuncio</h4>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                Use o link do anuncio, uma foto, um print ou uma captura de tela para extrair os dados com IA.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#5F6B7A]">Link do anuncio</span>
                <div className="relative">
                  <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                  <Input
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://..."
                    className="h-10 rounded-xl border-black/[0.06] bg-white pl-9 text-[#111111] placeholder:text-[#9CA3AF]"
                  />
                </div>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-[#5F6B7A]">Imagem ou print</span>
                <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 text-sm text-[#5F6B7A] hover:bg-[#f8faf8]">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  />
                  <ImagePlus className="size-4" />
                  {image ? image.name : "Selecionar imagem"}
                </span>
              </label>
            </div>
            <Button
              type="button"
              onClick={handleExtract}
              disabled={isExtracting || !aiImportEnabled}
              className="h-10 w-fit rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60"
            >
              <Sparkles className="size-4" />
              {isExtracting ? "Extraindo..." : "Extrair dados com IA"}
            </Button>
            {!aiImportEnabled && aiImportReason ? <p className="text-sm text-[#9B6B00]">{aiImportReason}</p> : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {draftEntries.length > 1 ? (
            <div className="grid gap-3 rounded-[1rem] border border-black/[0.06] bg-white p-4">
              <div>
                <p className="text-sm font-medium text-[#111111]">Previa revisavel</p>
                <p className="mt-1 text-sm text-[#6B7280]">Selecione o item que deseja revisar e salvar agora.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {draftEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`rounded-[1rem] border px-3 py-3 transition-colors ${
                      entry.id === selectedDraftId
                        ? "border-[#009b3a]/35 bg-[#009b3a]/10"
                        : "border-black/[0.06] bg-[#fbfbf8]"
                    }`}
                  >
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedDraftIds.includes(entry.id)}
                        onChange={() => toggleDraftSelection(entry.id)}
                        className="mt-0.5 size-4 rounded border-black/[0.12]"
                      />
                      <button type="button" onClick={() => setSelectedDraftId(entry.id)} className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-medium text-[#111111]">{entry.draft.title || `Imovel ${index + 1}`}</p>
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {[entry.draft.neighborhood, entry.draft.city].filter(Boolean).join(", ") || "Localizacao pendente"}
                        </p>
                      </button>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[1rem] border border-black/[0.06] bg-white px-4 py-3 text-sm text-[#5F6B7A]">
            Revise as informacoes antes de salvar.
            {fieldsToReview.length > 0 ? ` Campos para revisar: ${fieldsToReview.join(", ")}.` : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <DraftField label="Titulo">
              <Input
                value={currentDraft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
            <DraftField label="Preco">
              <Input
                value={currentDraft.price}
                onChange={(event) => updateDraft("price", formatCurrencyInput(event.target.value))}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
            <DraftField label="Tipo">
              <Select value={currentDraft.type} onValueChange={(value) => updateDraft("type", value as AdImportDraft["type"])}>
                <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.06] bg-white text-[#111111]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-black/[0.06] bg-white text-[#111111]">
                  {propertyImportTypeOptions.map((typeOption) => (
                    <SelectItem key={typeOption} value={typeOption}>
                      {typeOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DraftField>
            <DraftField label="Cidade">
              <Input
                value={currentDraft.city}
                onChange={(event) => updateDraft("city", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
            <DraftField label="Bairro">
              <Input
                value={currentDraft.neighborhood}
                onChange={(event) => updateDraft("neighborhood", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
            <DraftField label="Area">
              <Input
                value={currentDraft.area}
                onChange={(event) => updateDraft("area", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
            <DraftField label="Endereco">
              <Input
                value={currentDraft.address}
                onChange={(event) => updateDraft("address", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
            <DraftField label="Link de origem">
              <Input
                value={currentDraft.sourceUrl}
                onChange={(event) => updateDraft("sourceUrl", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="Dormitorios" value={currentDraft.bedrooms} onChange={(value) => updateDraft("bedrooms", value)} />
            <NumberInput label="Banheiros" value={currentDraft.bathrooms} onChange={(value) => updateDraft("bathrooms", value)} />
            <NumberInput label="Garagens" value={currentDraft.parking} onChange={(value) => updateDraft("parking", value)} />
          </div>

          <DraftField label="Descricao">
            <Textarea
              value={currentDraft.description}
              onChange={(event) => updateDraft("description", event.target.value)}
              className="min-h-28 rounded-[1.25rem] border-black/[0.06] bg-white text-[#111111]"
            />
          </DraftField>

          <DraftField label="Caracteristicas">
            <Input
              value={currentDraft.features.join(", ")}
              onChange={(event) =>
                updateDraft(
                  "features",
                  event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
            />
          </DraftField>

          <DraftField label="Fotos encontradas">
            <Textarea
              value={currentDraft.images.join("\n")}
              onChange={(event) =>
                updateDraft(
                  "images",
                  event.target.value
                    .split(/\r?\n/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                )
              }
              placeholder="Uma URL por linha"
              className="min-h-24 rounded-[1.25rem] border-black/[0.06] bg-white text-[#111111] placeholder:text-[#9CA3AF]"
            />
          </DraftField>

          {currentDraft.notes ? (
            <DraftField label="Referencia">
              <Input
                value={currentDraft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
                className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
              />
            </DraftField>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {draftEntries.length > 1 ? (
              <Button
                type="button"
                onClick={handleConfirmSelected}
                disabled={isSaving || selectedDraftIds.length === 0}
                className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60"
              >
                {isSaving ? "Salvando..." : `Salvar selecionados (${selectedDraftIds.length})`}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Salvar imovel"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={clearFlow}
              className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#5F6B7A] hover:bg-[#f8faf8] hover:text-[#111111]"
            >
              Voltar
            </Button>
          </div>
        </div>
      )}

      {feedback ? (
        <p className="rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#009b3a]">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}

function DraftField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#5F6B7A]">{label}</span>
      {children}
    </label>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <DraftField label={label}>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
        className="h-10 rounded-xl border-black/[0.06] bg-white text-[#111111]"
      />
    </DraftField>
  )
}
