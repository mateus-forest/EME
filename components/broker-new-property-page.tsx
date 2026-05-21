"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpFromLine, AudioLines, FileText, ImagePlus, Images, Keyboard, Sparkles, Upload, type LucideIcon } from "lucide-react"

import { AdImportPanel } from "@/components/ad-import-panel"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { confirmPropertyXmlImport, previewPropertyXml, type XmlImportReport, type XmlImportSummary } from "@/lib/property-xml-import-client"
import type { ParsedXmlProperty } from "@/lib/property-xml-import"
import { requestPropertyAi } from "@/lib/property-ai-client"
import { isBillingBypassEnabled } from "@/lib/billing-config"
import { formatCurrencyInput } from "@/lib/currency"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

type CreationMode = "ai" | "manual" | "import"
type PropertyType = "Apartamento" | "Casa" | "Comercial"
type PublishStatus = "Rascunho" | "Publicado"

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  }
}

export function BrokerNewPropertyPage() {
  const { properties, addProperty, uploadPropertyImages, uploadPropertyAudio, refreshProperties } = useBrokerProperties()
  const { subscription } = useBrokerSubscription()
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("")
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false)
  const [title, setTitle] = useState("")
  const [city, setCity] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [price, setPrice] = useState("")
  const [propertyType, setPropertyType] = useState<PropertyType>("Apartamento")
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("Publicado")
  const [description, setDescription] = useState("")
  const [bedrooms, setBedrooms] = useState(2)
  const [bathrooms, setBathrooms] = useState(2)
  const [parking, setParking] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [publishFeedback, setPublishFeedback] = useState("")
  const [aiHighlights, setAiHighlights] = useState<string[]>([])
  const [xmlPreview, setXmlPreview] = useState<ParsedXmlProperty[]>([])
  const [xmlSummary, setXmlSummary] = useState<XmlImportSummary | null>(null)
  const [xmlReport, setXmlReport] = useState<XmlImportReport | null>(null)
  const [isAnalyzingXml, setIsAnalyzingXml] = useState(false)
  const [isImportingXml, setIsImportingXml] = useState(false)

  const totalPropertiesCount = useMemo(() => properties.length, [properties])
  const billingBypassEnabled = isBillingBypassEnabled()
  const isPlanBlocked = !billingBypassEnabled && subscription.isProfileResolved && subscription.requiresRegularization
  const hasReachedLimit =
    !billingBypassEnabled &&
    subscription.isProfileResolved &&
    !isPlanBlocked &&
    !subscription.isUpgraded &&
    totalPropertiesCount >= (subscription.propertyLimit ?? 3)

  const previewImages = useMemo(() => images, [images])
  const previewLocation = [neighborhood.trim(), city.trim()].filter(Boolean).join(", ")
  const hasPreviewData = Boolean(title.trim() || price.trim() || previewLocation || description.trim() || previewImages[0])

  function validateManualProperty() {
    if (!title.trim() || !city.trim() || !neighborhood.trim() || !price.trim()) {
      setPublishFeedback("Preencha título, cidade, bairro e valor para cadastrar o imóvel manualmente.")
      return false
    }

    return true
  }

  async function handleImageSelection(files: FileList | null) {
    if (!files) return

    const nextFiles = Array.from(files).slice(0, 6)
    const nextImages = nextFiles.map((file) => URL.createObjectURL(file))

    setSelectedFiles(nextFiles)
    setImages(nextImages)
    setHasGenerated(false)
    setIsPublished(false)
    setPublishFeedback("")
  }

  async function handleXmlImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const isXml = file.name.toLowerCase().endsWith(".xml") || ["text/xml", "application/xml"].includes(file.type)
    if (!isXml) {
      setPublishFeedback("Envie um arquivo XML valido para revisar antes de importar.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPublishFeedback("O XML deve ter ate 5 MB.")
      return
    }

    setIsAnalyzingXml(true)
    setPublishFeedback("")
    setXmlPreview([])
    setXmlSummary(null)
    setXmlReport(null)

    try {
      const result = await previewPropertyXml(file)
      setXmlPreview(result.properties)
      setXmlSummary(result.summary)
      setPublishFeedback("XML analisado. Revise os imoveis antes de importar.")
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel analisar o XML.")
    } finally {
      setIsAnalyzingXml(false)
    }
  }

  async function handleConfirmXmlImport() {
    const importableProperties = xmlPreview.filter((property) => property.status !== "invalid")
    if (importableProperties.length === 0) {
      setPublishFeedback("Nenhum imovel esta pronto para importar.")
      return
    }

    setIsImportingXml(true)
    setPublishFeedback("")

    try {
      const result = await confirmPropertyXmlImport(importableProperties)
      setXmlReport(result.report)
      setPublishFeedback("Importacao finalizada.")
      await refreshProperties()
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Nao foi possivel importar os imoveis.")
    } finally {
      setIsImportingXml(false)
    }
  }

  function handleAudioSelection(files: FileList | null) {
    const file = files?.[0] ?? null
    setAudioFile(file)
    setAudioPreviewUrl(file ? URL.createObjectURL(file) : "")
    setHasGenerated(false)
    setIsPublished(false)
    setPublishFeedback("")
  }

  function handleAudioDescription() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined

    if (!SpeechRecognition) {
      setPublishFeedback("TranscriÃ§Ã£o por Ã¡udio nÃ£o estÃ¡ disponÃ­vel neste navegador.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "pt-BR"
    recognition.interimResults = false
    recognition.continuous = false

    setIsTranscribingAudio(true)
    setPublishFeedback("Ouvindo descriÃ§Ã£o do imÃ³vel...")

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim()

      if (transcript) {
        setDescription((current) => [current.trim(), transcript].filter(Boolean).join("\n\n"))
        setPublishFeedback("Ãudio transcrito e adicionado Ã  descriÃ§Ã£o.")
      }
    }

    recognition.onerror = () => {
      setPublishFeedback("NÃ£o foi possÃ­vel transcrever o Ã¡udio. Tente novamente ou digite a descriÃ§Ã£o.")
    }

    recognition.onend = () => {
      setIsTranscribingAudio(false)
    }

    recognition.start()
  }

  async function handleGenerateAd() {
    if (isPlanBlocked) {
      setPublishFeedback("Seu plano Corretor não está ativo para criar novos imóveis. Regularize sua assinatura para continuar.")
      return
    }

    if (hasReachedLimit) {
      setPublishFeedback("Seu plano atual atingiu o limite permitido de 3 imóveis. Faça upgrade para continuar.")
      return
    }

    setIsGenerating(true)
    setHasGenerated(false)
    setIsPublished(false)
    setPublishFeedback("")

    try {
      const generated = await requestPropertyAi({
        title,
        type: propertyType,
        city: city || "Não informado",
        neighborhood: neighborhood || "Não informado",
        price: price || "Não informado",
        bedrooms,
        bathrooms,
        parkingSpots: parking,
        description,
      })

      if (!description.trim() || window.confirm("Substituir a descricao atual pela sugestao da IA?")) {
        setDescription(generated.description)
      }

      if (!title.trim() && generated.suggestedTitle) {
        setTitle(generated.suggestedTitle)
      }

      setAiHighlights(generated.highlights)
      setHasGenerated(true)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ""
      setPublishFeedback(
        message.toLowerCase().includes("ia ainda")
          ? "A geracao com IA ainda nao esta ativada."
          : message || "Não foi possível gerar o anúncio com IA.",
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function handlePublishToCatalog() {
    if (isPlanBlocked) {
      setPublishFeedback("Seu plano Corretor não está ativo para criar novos imóveis. Regularize sua assinatura para continuar.")
      return
    }

    if (hasReachedLimit) {
      setPublishFeedback("Seu plano atual atingiu o limite permitido de 3 imóveis. Faça upgrade para continuar.")
      return
    }

    setIsSubmitting(true)
    setPublishFeedback("")

    try {
      if (!validateManualProperty()) {
        return
      }

      const createdProperty = await addProperty({
        titulo: title,
        preco: price,
        tipo: propertyType,
        corretorId: "",
        imobiliariaId: null,
        title,
        city,
        neighborhood,
        location: `${neighborhood}, ${city}`,
        price,
        images: [],
        bedrooms,
        bathrooms,
        parking,
        status: publishStatus,
        views: "0",
        leads: "0",
        type: propertyType,
        description,
        audioUrl: "",
      })

      const mediaErrors: string[] = []

      if (selectedFiles.length > 0) {
        try {
          await uploadPropertyImages(createdProperty.id, selectedFiles)
        } catch (caughtError) {
          const message = caughtError instanceof Error ? caughtError.message : "erro desconhecido"
          mediaErrors.push(`imagens (${message})`)
        }
      }

      if (audioFile) {
        try {
          await uploadPropertyAudio(createdProperty.id, audioFile)
        } catch (caughtError) {
          const message = caughtError instanceof Error ? caughtError.message : "erro desconhecido"
          mediaErrors.push(`áudio (${message})`)
        }
      }

      setIsPublished(true)
      setPublishFeedback(
        mediaErrors.length > 0
          ? `${publishStatus === "Publicado" ? "Imóvel publicado" : "Rascunho criado"}, mas não foi possível anexar ${mediaErrors.join(" e ")}.`
          : publishStatus === "Publicado" ? "Publicado com sucesso" : "Rascunho criado com sucesso",
      )
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível publicar o imóvel.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <BrokerPageShell title="Novo imóvel">
      <div className="grid gap-6">
        {billingBypassEnabled ? (
          <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
            Ambiente local com billing em modo de teste. Os bloqueios de plano estão temporariamente desativados.
          </div>
        ) : null}

        {isPlanBlocked ? (
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#ffb74d]/20 bg-[#ffb74d]/10 px-4 py-4 text-sm text-[#ffd180]">
            <p>Seu plano Corretor não está ativo para criar novos imóveis. Regularize sua assinatura para continuar.</p>
            <div>
              <Button
                asChild
                className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
              >
                <Link href="/corretor/plano">Regularizar plano</Link>
              </Button>
            </div>
          </div>
        ) : hasReachedLimit ? (
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-4 text-sm text-[#69F0AE]">
            <p>Seu plano atual atingiu o limite permitido de 3 imóveis. Faça upgrade para continuar.</p>
            <div>
              <Button
                asChild
                className="h-9 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
              >
                <Link href="/corretor/plano">Fazer upgrade</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!creationMode ? (
          <PropertyCreationChoice onChoose={setCreationMode} />
        ) : creationMode === "import" ? (
          <ImportPropertyPanel
            feedback={publishFeedback}
            preview={xmlPreview}
            summary={xmlSummary}
            report={xmlReport}
            isAnalyzing={isAnalyzingXml}
            isImporting={isImportingXml}
            onImported={refreshProperties}
            onBack={() => {
              setCreationMode(null)
              setPublishFeedback("")
            }}
            onXmlImport={handleXmlImport}
            onConfirmImport={handleConfirmXmlImport}
          />
        ) : (
          <>

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] px-6 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Novo imóvel</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {creationMode === "ai" ? "Use fotos, áudio ou texto para gerar o anúncio" : "Preencha os dados do imóvel com controle total"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
            {creationMode === "ai"
              ? "A IA monta a primeira versão do anúncio e você revisa tudo antes de publicar."
              : "Cadastre cada detalhe do imóvel com calma, sem depender da geração automática."}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCreationMode(null)}
            className="mt-5 h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white"
          >
            Voltar
          </Button>
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">{creationMode === "ai" ? "Fotos para acelerar a IA" : "Fotos do imóvel"}</CardTitle>
            <p className="text-sm text-white/50">
              {creationMode === "ai"
                ? "Envie fotos reais para apoiar a criação do anúncio. Você revisa o resultado antes de publicar."
                : "Adicione fotos reais do imóvel para compor o anúncio manual."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-0">
            <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#00C853]/28 bg-[#00C853]/[0.05] px-6 text-center transition-colors hover:bg-[#00C853]/[0.08]">
              <input
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleImageSelection(event.target.files)}
              />
              <div className="flex size-14 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <ImagePlus className="size-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                Arraste imagens aqui ou selecione do dispositivo
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/55">
                {creationMode === "ai"
                  ? "Use fotos, áudio ou texto para a IA montar uma primeira versão do anúncio."
                  : "Selecione imagens reais para o cadastro tradicional do imóvel."}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white/75">
                <Upload className="size-4" />
                Selecionar imagens
              </div>
            </label>

            {previewImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {previewImages.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative min-h-40 overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] px-4 text-center">
                <Images className="size-8 text-white/35" />
                <p className="mt-3 text-sm font-medium text-white/75">Nenhuma foto selecionada</p>
                <p className="mt-1 text-sm text-white/45">As imagens reais aparecerão aqui antes da publicação.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            {creationMode === "ai" ? (
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">{creationMode === "ai" ? "Descrição, áudio e IA" : "Descrição do imóvel"}</CardTitle>
                <p className="text-sm text-white/50">
                  {creationMode === "ai"
                    ? "Descreva ou grave os pontos principais. A IA transforma isso em um anúncio revisável."
                    : "Escreva a descrição do imóvel diretamente, com os detalhes que deseja publicar."}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 pt-0">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Fale sobre ambientes, diferenciais, lazer, localização ou qualquer detalhe relevante."
                  className="min-h-40 rounded-[1.25rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                />

                {creationMode === "ai" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleAudioDescription}
                    disabled={isTranscribingAudio}
                    className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
                  >
                    <AudioLines className="size-4" />
                    {isTranscribingAudio ? "Ouvindo..." : "Áudio"}
                  </Button>

                  <label className="inline-flex h-10 cursor-pointer items-center justify-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white">
                    <input
                      type="file"
                      accept="audio/*"
                      className="sr-only"
                      onChange={(event) => {
                        handleAudioSelection(event.target.files)
                        event.currentTarget.value = ""
                      }}
                    />
                    <Upload className="size-4" />
                    Anexar áudio
                  </label>

                  <Button
                    onClick={handleGenerateAd}
                    disabled={isGenerating || hasReachedLimit || isPlanBlocked}
                    className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30 disabled:opacity-60"
                  >
                    {isGenerating ? <Spinner className="size-4 text-black" /> : <Sparkles className="size-4" />}
                    {isGenerating ? "Gerando..." : "Gerar anúncio com IA"}
                  </Button>
                </div>
                ) : null}

                {creationMode === "ai" && audioFile ? (
                  <div className="grid gap-3 rounded-[1rem] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                    <p>{audioFile.name}</p>
                    {audioPreviewUrl ? (
                      <audio controls src={audioPreviewUrl} className="w-full">
                        Seu navegador não suporta reprodução de áudio.
                      </audio>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            ) : null}

            {(creationMode === "manual" || hasGenerated) ? (
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">{creationMode === "manual" ? "Dados do imóvel" : "Revisão do imóvel"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 pt-0">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Título do imóvel">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ex.: Apartamento com varanda no Jardins"
                      className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                    />
                  </Field>
                  <Field label="Valor">
                    <Input
                      value={price}
                      onChange={(event) => setPrice(formatCurrencyInput(event.target.value))}
                      placeholder="R$ 500.000,00"
                      className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select value={propertyType} onValueChange={(value) => setPropertyType(value as PropertyType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-white/[0.08] bg-white/[0.04] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/[0.08] bg-[#121212] text-white">
                        <SelectItem value="Apartamento">Apartamento</SelectItem>
                        <SelectItem value="Casa">Casa</SelectItem>
                        <SelectItem value="Comercial">Comercial</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={publishStatus} onValueChange={(value) => setPublishStatus(value as PublishStatus)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-white/[0.08] bg-white/[0.04] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/[0.08] bg-[#121212] text-white">
                        <SelectItem value="Publicado">Publicado</SelectItem>
                        <SelectItem value="Rascunho">Rascunho</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Cidade">
                    <Input
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      placeholder="São Paulo"
                      className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                    />
                  </Field>
                  <Field label="Bairro">
                    <Input
                      value={neighborhood}
                      onChange={(event) => setNeighborhood(event.target.value)}
                      placeholder="Jardins"
                      className="h-10 rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                    />
                  </Field>
                </div>

                {creationMode === "manual" ? (
                  <Field label="Descrição">
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Descreva os principais diferenciais do imóvel..."
                      className="min-h-32 rounded-[1.25rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                    />
                  </Field>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <CounterCard label="Quartos" value={bedrooms} onChange={setBedrooms} />
                  <CounterCard label="Banheiros" value={bathrooms} onChange={setBathrooms} />
                  <CounterCard label="Vagas" value={parking} onChange={setParking} />
                </div>
              </CardContent>
            </Card>
            ) : null}

          </div>

          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardContent className="p-6">
                <p className="text-sm leading-7 text-white/60">
                  {creationMode === "ai"
                    ? "Fluxo rápido: envie contexto, gere com IA e ajuste os dados antes de publicar."
                    : "Fluxo manual: preencha informações, descrição e fotos com controle total sobre o anúncio."}
                </p>
              </CardContent>
            </Card>
            {publishFeedback && !hasGenerated ? (
              <p className="text-center text-sm text-[#69F0AE]">{publishFeedback}</p>
            ) : null}
          </div>
        </div>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-white">
                {isGenerating ? "Gerando seu anúncio..." : "Preview do anúncio"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isGenerating ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] text-center">
                  <Spinner className="size-6 text-[#69F0AE]" />
                  <p className="mt-4 text-base font-medium text-white">Gerando seu anúncio...</p>
                  <p className="mt-2 text-sm text-white/50">
                    Organizamos as fotos e montamos uma descrição pronta para publicar.
                  </p>
                </div>
              ) : !hasPreviewData ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] px-4 text-center">
                  <Images className="size-9 text-white/35" />
                  <p className="mt-3 text-sm font-medium text-white/75">Preencha os dados para visualizar o anuncio.</p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="relative min-h-72 overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03]">
                    {previewImages[0] ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewImages[0]} alt="Preview do anúncio" className="h-full w-full object-cover" />
                      </>
                    ) : (
                      <div className="flex h-full min-h-72 flex-col items-center justify-center px-4 text-center">
                        <Images className="size-9 text-white/35" />
                        <p className="mt-3 text-sm font-medium text-white/75">Preview sem foto</p>
                        <p className="mt-1 text-sm text-white/45">Selecione imagens para visualizar o anúncio.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between gap-5 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#69F0AE]">{hasGenerated ? "Anúncio gerado com IA" : "Anúncio manual"}</p>
                      <h3 className="mt-3 text-2xl font-semibold text-white">{title}</h3>
                      <p className="mt-2 text-sm text-white/55">
                        {previewLocation}
                      </p>
                      <p className="mt-4 text-2xl font-semibold text-white">{price || "Consulte valor"}</p>
                      <p className="mt-5 text-sm leading-7 text-white/65">
                        {description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <InfoPill label={`${bedrooms} quartos`} />
                      <InfoPill label={`${bathrooms} banheiros`} />
                      <InfoPill label={`${parking} vagas`} />
                      {isPublished && <InfoPill label="Status: Publicado" />}
                    </div>

                    {aiHighlights.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {aiHighlights.map((highlight) => (
                          <span
                            key={highlight}
                            className="rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1 text-xs text-[#69F0AE]"
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div>
                      <Button
                        onClick={handlePublishToCatalog}
                        disabled={isPublished || hasReachedLimit || isPlanBlocked || isSubmitting}
                        className="h-11 w-full rounded-xl bg-[#00C853] text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30 disabled:opacity-70"
                      >
                        <ArrowUpFromLine className="size-4" />
                        {isPublished ? "Publicado no catálogo" : isSubmitting ? "Publicando..." : "Publicar no catálogo"}
                      </Button>
                      {publishFeedback && <p className="mt-3 text-sm text-[#69F0AE]">{publishFeedback}</p>}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          </>
        )}
        
      </div>
    </BrokerPageShell>
  )
}

function PropertyCreationChoice({ onChoose }: { onChoose: (mode: CreationMode) => void }) {
  return (
    <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
      <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Novo imovel</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Como voce quer criar este imovel?</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
        Escolha o melhor ponto de partida. Voce sempre podera revisar antes de publicar.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <CreationOption
          icon={Sparkles}
          title="Criar com IA"
          description="Envie fotos, audio ou uma descricao e gere um anuncio automaticamente."
          onClick={() => onChoose("ai")}
        />
        <CreationOption
          icon={Keyboard}
          title="Criar manualmente"
          description="Ideal para anuncios ja existentes ou preenchimento completo."
          onClick={() => onChoose("manual")}
        />
        <CreationOption
          icon={FileText}
          title="Importar imoveis"
          description="Importe imoveis via XML, planilha ou anuncio existente."
          onClick={() => onChoose("import")}
        />
      </div>
    </section>
  )
}

function CreationOption({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-52 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-colors hover:border-[#00C853]/30 hover:bg-[#00C853]/[0.06]"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/55">{description}</p>
    </button>
  )
}

function ImportPropertyPanel({
  feedback,
  preview,
  summary,
  report,
  isAnalyzing,
  isImporting,
  onImported,
  onBack,
  onXmlImport,
  onConfirmImport,
}: {
  feedback: string
  preview: ParsedXmlProperty[]
  summary: XmlImportSummary | null
  report: XmlImportReport | null
  isAnalyzing: boolean
  isImporting: boolean
  onImported: () => void | Promise<void>
  onBack: () => void
  onXmlImport: (files: FileList | null) => void | Promise<void>
  onConfirmImport: () => void | Promise<void>
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Importar imoveis</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Escolha uma origem</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
            Envie um arquivo XML de imoveis para revisar antes de importar.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onBack} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white">
          Voltar
        </Button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="min-h-48 cursor-pointer rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:border-[#00C853]/30 hover:bg-[#00C853]/[0.06]">
          <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={(event) => void onXmlImport(event.target.files)} />
          <Upload className="size-8 text-[#69F0AE]" />
          <h3 className="mt-5 text-lg font-semibold text-white">Importar XML</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Envie um arquivo XML de imoveis para revisar antes de importar.</p>
        </label>
        <div className="min-h-48 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-5">
          <Sparkles className="size-8 text-[#69F0AE]" />
          <h3 className="mt-5 text-lg font-semibold text-white">Importar de anuncio</h3>
          <p className="mt-2 text-sm leading-6 text-white/55">Cole texto, informe um link ou envie um print para extrair com IA.</p>
        </div>
      </div>
      <AdImportPanel onImported={onImported} />
      {isAnalyzing ? <p className="mt-5 text-sm text-white/55">Analisando XML...</p> : null}
      {summary ? (
        <XmlImportPreview
          preview={preview}
          summary={summary}
          report={report}
          isImporting={isImporting}
          onConfirmImport={onConfirmImport}
        />
      ) : null}
      {feedback ? <p className="mt-5 rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">{feedback}</p> : null}
    </section>
  )
}

function XmlImportPreview({
  preview,
  summary,
  report,
  isImporting,
  onConfirmImport,
}: {
  preview: ParsedXmlProperty[]
  summary: XmlImportSummary
  report: XmlImportReport | null
  isImporting: boolean
  onConfirmImport: () => void | Promise<void>
}) {
  return (
    <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Preview da importacao</h3>
          <p className="mt-1 text-sm text-white/55">
            {summary.total} encontrados · {summary.ready} prontos · {summary.needsReview} para revisar · {summary.invalid} invalidos
          </p>
        </div>
        <Button type="button" onClick={() => void onConfirmImport()} disabled={isImporting || summary.ready + summary.needsReview === 0} className="h-10 rounded-xl bg-[#00C853] px-4 text-sm font-semibold text-black hover:bg-[#00E676] disabled:opacity-60">
          {isImporting ? "Importando..." : "Confirmar importacao"}
        </Button>
      </div>
      <div className="grid gap-3">
        {preview.slice(0, 12).map((property, index) => (
          <div key={`${property.title}-${index}`} className="rounded-[1rem] border border-white/[0.08] bg-black/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">{property.title || "Imovel sem titulo"}</p>
                <p className="mt-1 text-sm text-white/50">{[property.neighborhood, property.city].filter(Boolean).join(", ") || "Localizacao pendente"}</p>
              </div>
              <ImportStatusBadge status={property.status} />
            </div>
            <p className="mt-2 text-sm text-white/70">{property.price || "Preco pendente"}</p>
            {property.issues.length > 0 ? <p className="mt-2 text-xs text-white/45">Revisar: {property.issues.join(", ")}</p> : null}
          </div>
        ))}
      </div>
      {report ? (
        <div className="rounded-[1rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#69F0AE]">
          Importados: {report.imported}. Duplicados ignorados: {report.duplicates}. Com erro: {report.errors}.
        </div>
      ) : null}
    </div>
  )
}

function ImportStatusBadge({ status }: { status: ParsedXmlProperty["status"] }) {
  const label =
    status === "ready" ? "Pronto para importar" : status === "needs_review" ? "Precisa revisar" : "Invalido"

  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/70">
      {label}
    </span>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  )
}

function CounterCard({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-medium text-white/70">{label}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
        >
          -
        </Button>
        <span className="text-2xl font-semibold text-white">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
        >
          +
        </Button>
      </div>
    </div>
  )
}

function InfoPill({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-white/70">
      {label}
    </div>
  )
}
