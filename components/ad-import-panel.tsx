"use client"

import { useState } from "react"
import { ImagePlus, LinkIcon, Sparkles } from "lucide-react"

import type { AdImportDraft } from "@/lib/property-ad-import"
import { confirmPropertyAdImport, extractPropertyAd } from "@/lib/property-ad-import-client"
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

  function updateDraft<K extends keyof AdImportDraft>(field: K, value: AdImportDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  async function handleExtract() {
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
    <div className="grid gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Importar de anuncio</h3>
        <p className="mt-1 text-sm leading-6 text-white/55">
          Cole um anuncio, envie um print ou informe um link para a IA montar o imovel automaticamente.
        </p>
      </div>

      {!draft ? (
        <div className="grid gap-4">
          <Textarea
            value={adText}
            onChange={(event) => setAdText(event.target.value)}
            placeholder="Cole aqui o texto do anuncio..."
            className="min-h-32 rounded-[1.25rem] border-white/[0.08] bg-black/20 text-white placeholder:text-white/30"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-white/70">Link do anuncio</span>
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35" />
                <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." className="h-10 rounded-xl border-white/[0.08] bg-black/20 pl-9 text-white placeholder:text-white/30" />
              </div>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-white/70">Print ou imagem</span>
              <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm text-white/70 hover:bg-white/[0.06]">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
                <ImagePlus className="size-4" />
                {image ? image.name : "Selecionar imagem"}
              </span>
            </label>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observacoes opcionais..."
            className="min-h-20 rounded-[1.25rem] border-white/[0.08] bg-black/20 text-white placeholder:text-white/30"
          />
          <Button type="button" onClick={handleExtract} disabled={isExtracting} className="h-10 w-fit rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
            <Sparkles className="size-4" />
            {isExtracting ? "Extraindo..." : "Extrair dados com IA"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[1rem] border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/60">
            Revise as informacoes antes de publicar.
            {[...currentDraft.lowConfidenceFields, ...currentDraft.missingFields].length > 0
              ? ` Campos para revisar: ${[...currentDraft.lowConfidenceFields, ...currentDraft.missingFields].join(", ")}.`
              : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <DraftField label="Titulo">
              <Input value={currentDraft.title} onChange={(event) => updateDraft("title", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
            </DraftField>
            <DraftField label="Preco">
              <Input value={currentDraft.price} onChange={(event) => updateDraft("price", formatCurrencyInput(event.target.value))} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
            </DraftField>
            <DraftField label="Tipo">
              <Select value={currentDraft.type} onValueChange={(value) => updateDraft("type", value as AdImportDraft["type"])}>
                <SelectTrigger className="h-10 w-full rounded-xl border-white/[0.08] bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[#121212] text-white">
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </DraftField>
            <DraftField label="Cidade">
              <Input value={currentDraft.city} onChange={(event) => updateDraft("city", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
            </DraftField>
            <DraftField label="Bairro">
              <Input value={currentDraft.neighborhood} onChange={(event) => updateDraft("neighborhood", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
            </DraftField>
            <DraftField label="Area">
              <Input value={currentDraft.area} onChange={(event) => updateDraft("area", event.target.value)} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
            </DraftField>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="Quartos" value={currentDraft.bedrooms} onChange={(value) => updateDraft("bedrooms", value)} />
            <NumberInput label="Banheiros" value={currentDraft.bathrooms} onChange={(value) => updateDraft("bathrooms", value)} />
            <NumberInput label="Vagas" value={currentDraft.parking} onChange={(value) => updateDraft("parking", value)} />
          </div>
          <DraftField label="Descricao">
            <Textarea value={currentDraft.description} onChange={(event) => updateDraft("description", event.target.value)} className="min-h-28 rounded-[1.25rem] border-white/[0.08] bg-black/20 text-white" />
          </DraftField>
          <DraftField label="Caracteristicas">
            <Input value={currentDraft.features.join(", ")} onChange={(event) => updateDraft("features", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
          </DraftField>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleConfirm} disabled={isSaving} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
              {isSaving ? "Criando..." : "Confirmar criacao"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
              Voltar
            </Button>
          </div>
        </div>
      )}

      {feedback ? <p className="rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">{feedback}</p> : null}
    </div>
  )
}

function DraftField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <DraftField label={label}>
      <Input type="number" min={0} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className="h-10 rounded-xl border-white/[0.08] bg-black/20 text-white" />
    </DraftField>
  )
}
