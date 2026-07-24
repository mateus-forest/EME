"use client"

import { useEffect, useState } from "react"
import { ImagePlus, LinkIcon, Sparkles } from "lucide-react"

import type { AdImportDraft } from "@/lib/property-ad-import"
import { confirmPropertyAdImport, extractPropertyAd, getPropertyImportCapabilities } from "@/lib/property-ad-import-client"
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

export function AdImportPanel({ onImported }: { onImported: () => void | Promise<void> }) {
  const [adText, setAdText] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [draft, setDraft] = useState<AdImportDraft | null>(null)
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

  function updateDraft<K extends keyof AdImportDraft>(field: K, value: AdImportDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  async function handleExtract() {
    if (!aiImportEnabled) {
      setFeedback(aiImportReason || "A importacao inteligente nao esta disponivel neste ambiente.")
      return
    }

    setIsExtracting(true)
    setFeedback("")
    setDraft(null)

    try {
      const result = await extractPropertyAd({ adText, sourceUrl, notes, image })
      setDraft(result.draft)
      setFeedback("Dados extraidos. Revise as informacoes antes de publicar.")
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
      setFeedback("Imovel criado como rascunho.")
      setDraft(null)
      setAdText("")
      setSourceUrl("")
      setNotes("")
      setImage(null)
      await onImported()
    } catch (caughtError) {
      setFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel criar o imovel.")
    } finally {
      setIsSaving(false)
    }
  }

  const currentDraft = draft ?? emptyDraft

  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div>
        <h3 className="text-lg font-semibold text-[#111111]">Importar de anuncio</h3>
        <p className="mt-1 text-sm leading-6 text-[#6B7280]">
          Cole um anuncio, envie um print ou informe um link para a IA montar o imovel automaticamente.
        </p>
      </div>

      {!draft ? (
        <div className="grid gap-4">
          <Textarea
            value={adText}
            onChange={(event) => setAdText(event.target.value)}
            placeholder="Cole aqui o texto do anuncio..."
            className="min-h-32 rounded-[1.25rem] border-black/[0.06] bg-white text-[#111111] placeholder:text-[#9CA3AF]"
          />
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
              <span className="text-sm font-medium text-[#5F6B7A]">Print ou imagem</span>
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
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observacoes opcionais..."
            className="min-h-20 rounded-[1.25rem] border-black/[0.06] bg-white text-[#111111] placeholder:text-[#9CA3AF]"
          />
          <Button
            type="button"
            onClick={handleExtract}
            disabled={isExtracting || !aiImportEnabled}
            className="h-10 w-fit rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60"
          >
            <Sparkles className="size-4" />
            {isExtracting ? "Extraindo..." : "Extrair dados com IA"}
          </Button>
          {!aiImportEnabled && aiImportReason ? (
            <p className="text-sm text-[#9B6B00]">{aiImportReason}</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[1rem] border border-black/[0.06] bg-white px-4 py-3 text-sm text-[#5F6B7A]">
            Revise as informacoes antes de publicar.
            {[...currentDraft.lowConfidenceFields, ...currentDraft.missingFields].length > 0
              ? ` Campos para revisar: ${[...currentDraft.lowConfidenceFields, ...currentDraft.missingFields].join(", ")}.`
              : null}
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
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
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
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="Quartos" value={currentDraft.bedrooms} onChange={(value) => updateDraft("bedrooms", value)} />
            <NumberInput label="Banheiros" value={currentDraft.bathrooms} onChange={(value) => updateDraft("bathrooms", value)} />
            <NumberInput label="Vagas" value={currentDraft.parking} onChange={(value) => updateDraft("parking", value)} />
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSaving}
              className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60"
            >
              {isSaving ? "Criando..." : "Confirmar criacao"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
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
