"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUpFromLine, AudioLines, FileText, ImagePlus, Images, Keyboard, Sparkles, Upload, type LucideIcon } from "lucide-react"

import { AdImportPanel } from "@/components/ad-import-panel"
import { BrokerPageShell } from "@/components/broker-page-shell"
import { extractPropertyAd } from "@/lib/property-ad-import-client"
import { confirmPropertyXmlImport, previewPropertyXml, type XmlImportReport, type XmlImportSummary } from "@/lib/property-xml-import-client"
import type { ParsedXmlProperty } from "@/lib/property-xml-import"
import { isBillingBypassEnabled } from "@/lib/billing-config"
import { formatCurrencyInput } from "@/lib/currency"
import { useBrokerProperties, type BrokerPropertyPurpose } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

type CreationMode = "ai" | "manual" | "import"
type PropertyType = "Apartamento" | "Casa" | "Comercial" | "Terreno" | "Sala comercial" | "Loja" | "Cobertura"
type PropertyPurpose = BrokerPropertyPurpose
type PublishStatus = "Rascunho" | "Publicado"

type BrowserSpeechRecognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  stop: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

type SpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type AiPreviewSnapshot = {
  title: string
  city: string
  neighborhood: string
  price: string
  type: PropertyType
  bedrooms: number
  bathrooms: number
  parking: number
  description: string
  context: string
  image: File | null
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
  const [aiContext, setAiContext] = useState("")
  const [isRecordingAudio, setIsRecordingAudio] = useState(false)
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false)
  const [title, setTitle] = useState("")
  const [city, setCity] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [price, setPrice] = useState("")
  const [propertyType, setPropertyType] = useState<PropertyType>("Apartamento")
  const [propertyPurpose, setPropertyPurpose] = useState<PropertyPurpose>("Venda")
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
  const [xmlSourceUrl, setXmlSourceUrl] = useState("")
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const pendingTranscriptRef = useRef("")
  const stopRequestedRef = useRef(false)
  const autoGenerationKeyRef = useRef("")
  const activeGenerationIdRef = useRef(0)

  const totalPropertiesCount = useMemo(() => properties.length, [properties])
  const billingBypassEnabled = isBillingBypassEnabled()
  const isPlanBlocked = !billingBypassEnabled && subscription.isProfileResolved && subscription.requiresRegularization
  const hasReachedLimit =
    !billingBypassEnabled &&
    subscription.isProfileResolved &&
    !isPlanBlocked &&
    !subscription.isUpgraded &&
    totalPropertiesCount >= (subscription.propertyLimit ?? 5)

  const previewImages = useMemo(() => images, [images])
  const previewNeighborhood = neighborhood.trim() || "Bairro não identificado"
  const previewCity = city.trim() || "Cidade não identificada"
  const previewLocation = [previewNeighborhood, previewCity].filter(Boolean).join(", ")
  const previewPrice = price || "Valor não informado"
  const previewTitle = title.trim() || "Imóvel em revisão"
  const previewDescription =
    description.trim() || "A prévia será enriquecida automaticamente conforme você enviar mais contexto."
  const hasAiSource =
    Boolean(aiContext.trim() || title.trim() || city.trim() || neighborhood.trim() || price.trim()) ||
    selectedFiles.length > 0
  const hasPreviewData =
    creationMode === "ai"
      ? Boolean(hasGenerated || hasAiSource || previewImages[0] || description.trim())
      : Boolean(title.trim() || price.trim() || previewLocation || description.trim() || previewImages[0])
  const aiGenerationKey = useMemo(
    () =>
      JSON.stringify({
        title,
        city,
        neighborhood,
        price,
        propertyType,
        bedrooms,
        bathrooms,
        parking,
        aiContext,
        image:
          selectedFiles[0]
            ? {
                name: selectedFiles[0].name,
                size: selectedFiles[0].size,
                lastModified: selectedFiles[0].lastModified,
              }
            : null,
      }),
    [aiContext, bathrooms, bedrooms, city, neighborhood, parking, price, propertyType, selectedFiles, title],
  )

  const buildFallbackTitle = useCallback(() => {
    const location = [neighborhood.trim(), city.trim()].filter(Boolean).join(", ")
    const baseTitle = propertyType === "Sala comercial" ? "Sala comercial" : propertyType
    return [baseTitle, location ? `em ${location}` : ""].filter(Boolean).join(" ").trim()
  }, [city, neighborhood, propertyType])

  function buildAiNotes(snapshot: AiPreviewSnapshot) {
    return [
      "Contexto complementar do corretor para montar a prévia editável do imóvel.",
      snapshot.title.trim() ? `Título informado: ${snapshot.title.trim()}` : "",
      snapshot.type ? `Tipo do imóvel: ${snapshot.type}` : "",
      snapshot.city.trim() ? `Cidade informada: ${snapshot.city.trim()}` : "",
      snapshot.neighborhood.trim() ? `Bairro informado: ${snapshot.neighborhood.trim()}` : "",
      snapshot.price.trim() ? `Valor informado: ${snapshot.price.trim()}` : "",
      `Dormitórios informados: ${snapshot.bedrooms}`,
      `Banheiros informados: ${snapshot.bathrooms}`,
      `Garagens informadas: ${snapshot.parking}`,
      snapshot.context.trim() ? `Contexto adicional em texto/áudio: ${snapshot.context.trim()}` : "",
      snapshot.image ? "Existe uma imagem do imóvel anexada para análise visual." : "",
      "Se algum dado estiver ausente, mantenha a prévia mesmo assim e marque os campos faltantes.",
    ]
      .filter(Boolean)
      .join("\n")
  }

  const applyAiPreview = useCallback((snapshot: AiPreviewSnapshot, draft: Awaited<ReturnType<typeof extractPropertyAd>>["drafts"][number]) => {
    setTitle(draft.title.trim() || snapshot.title.trim() || buildFallbackTitle())
    setCity(draft.city.trim() || snapshot.city.trim())
    setNeighborhood(draft.neighborhood.trim() || snapshot.neighborhood.trim())
    setPrice(draft.price.trim() || snapshot.price.trim())
    setPropertyType(draft.type || snapshot.type)
    setBedrooms(draft.bedrooms > 0 ? draft.bedrooms : snapshot.bedrooms)
    setBathrooms(draft.bathrooms > 0 ? draft.bathrooms : snapshot.bathrooms)
    setParking(draft.parking > 0 ? draft.parking : snapshot.parking)
    setDescription(draft.description.trim() || snapshot.description.trim())
    setAiHighlights((draft.features.length > 0 ? draft.features : draft.tags).slice(0, 3))
    setHasGenerated(true)
    setPublishFeedback(
      draft.missingFields.length > 0
        ? `Prévia atualizada. Revise: ${draft.missingFields.join(", ")}.`
        : "Prévia atualizada automaticamente.",
    )
  }, [buildFallbackTitle])

  const generateAiPreview = useCallback(async (options?: { force?: boolean; feedback?: string }) => {
    if (creationMode !== "ai" || isPlanBlocked || hasReachedLimit || !hasAiSource) return

    const snapshot: AiPreviewSnapshot = {
      title,
      city,
      neighborhood,
      price,
      type: propertyType,
      bedrooms,
      bathrooms,
      parking,
      description,
      context: aiContext,
      image: selectedFiles[0] ?? null,
    }

    if (!options?.force) {
      autoGenerationKeyRef.current = aiGenerationKey
    }

    const generationId = activeGenerationIdRef.current + 1
    activeGenerationIdRef.current = generationId
    setIsGenerating(true)
    setIsPublished(false)
    setPublishFeedback(options?.feedback || (hasGenerated ? "Atualizando prévia..." : "Gerando primeira prévia..."))

    try {
      const generated = await extractPropertyAd({
        adText: snapshot.context.trim(),
        notes: buildAiNotes(snapshot),
        image: snapshot.image,
      })

      if (activeGenerationIdRef.current !== generationId) return
      if (generated.drafts[0]) {
        applyAiPreview(snapshot, generated.drafts[0])
      } else {
        throw new Error("Não foi possível montar uma prévia editável para este imóvel.")
      }
    } catch (caughtError) {
      if (activeGenerationIdRef.current !== generationId) return
      setPublishFeedback(
        caughtError instanceof Error ? caughtError.message : "Não foi possível atualizar a prévia do imóvel.",
      )
    } finally {
      if (activeGenerationIdRef.current === generationId) {
        setIsGenerating(false)
      }
    }
  }, [
    applyAiPreview,
    aiContext,
    aiGenerationKey,
    bathrooms,
    bedrooms,
    city,
    creationMode,
    description,
    hasAiSource,
    hasGenerated,
    hasReachedLimit,
    isPlanBlocked,
    neighborhood,
    parking,
    price,
    propertyType,
    selectedFiles,
    title,
  ])

  function validateManualProperty(titleOverride?: string) {
    const resolvedTitle = titleOverride?.trim() || title.trim()

    if (!resolvedTitle || !city.trim() || !neighborhood.trim() || !price.trim()) {
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
    setIsPublished(false)
    setPublishFeedback("")
  }

  async function handleXmlImport(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const isXml = file.name.toLowerCase().endsWith(".xml") || ["text/xml", "application/xml"].includes(file.type)
    if (!isXml) {
      setPublishFeedback("Envie um arquivo XML válido para revisar antes de importar.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setPublishFeedback("O XML deve ter até 5 MB.")
      return
    }

    setIsAnalyzingXml(true)
    setPublishFeedback("")
    setXmlPreview([])
    setXmlSummary(null)
    setXmlReport(null)

    try {
      const result = await previewPropertyXml({ file })
      setXmlPreview(result.properties)
      setXmlSummary(result.summary)
      setPublishFeedback("XML analisado. Revise os imóveis antes de importar.")
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível analisar o XML.")
    } finally {
      setIsAnalyzingXml(false)
    }
  }

  async function handleXmlImportUrl() {
    if (!xmlSourceUrl.trim()) {
      setPublishFeedback("Informe a URL do XML para analisar antes de importar.")
      return
    }

    setIsAnalyzingXml(true)
    setPublishFeedback("")
    setXmlPreview([])
    setXmlSummary(null)
    setXmlReport(null)

    try {
      const result = await previewPropertyXml({ sourceUrl: xmlSourceUrl.trim() })
      setXmlPreview(result.properties)
      setXmlSummary(result.summary)
      setPublishFeedback("XML analisado. Revise os imóveis antes de importar.")
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível analisar o XML.")
    } finally {
      setIsAnalyzingXml(false)
    }
  }

  async function handleConfirmXmlImport() {
    const importableProperties = xmlPreview.filter((property) => property.status !== "invalid")
    if (importableProperties.length === 0) {
      setPublishFeedback("Nenhum imóvel está pronto para importar.")
      return
    }

    setIsImportingXml(true)
    setPublishFeedback("")

    try {
      const result = await confirmPropertyXmlImport(importableProperties)
      setXmlReport(result.report)
      setPublishFeedback("Importação finalizada.")
      await refreshProperties()
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível importar os imóveis.")
    } finally {
      setIsImportingXml(false)
    }
  }

  function handleAudioSelection(files: FileList | null) {
    const file = files?.[0] ?? null
    setAudioFile(file)
    setAudioPreviewUrl(file ? URL.createObjectURL(file) : "")
    setIsPublished(false)
    setPublishFeedback("")
  }

  function stopAudioCapture() {
    stopRequestedRef.current = true
    recognitionRef.current?.stop()
    setPublishFeedback("Transcrevendo áudio e atualizando a prévia...")
  }

  function handleAudioDescription() {
    if (isRecordingAudio) {
      stopAudioCapture()
      return
    }

    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : undefined

    if (!SpeechRecognition) {
      setPublishFeedback("Transcrição por áudio não está disponível neste navegador.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "pt-BR"
    recognition.interimResults = false
    recognition.continuous = true
    pendingTranscriptRef.current = ""
    stopRequestedRef.current = false
    recognitionRef.current = recognition

    setIsRecordingAudio(true)
    setIsTranscribingAudio(true)
    setPublishFeedback("Gravando áudio do imóvel. Clique em Parar quando terminar.")

    recognition.onresult = (event) => {
      pendingTranscriptRef.current = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim()
    }

    recognition.onerror = () => {
      recognitionRef.current = null
      pendingTranscriptRef.current = ""
      stopRequestedRef.current = false
      setIsRecordingAudio(false)
      setIsTranscribingAudio(false)
      setPublishFeedback("Não foi possível gravar o áudio. Tente novamente ou descreva o imóvel em texto.")
    }

    recognition.onend = () => {
      const transcript = pendingTranscriptRef.current.trim()
      const shouldProcessTranscript = stopRequestedRef.current && Boolean(transcript)
      recognitionRef.current = null
      pendingTranscriptRef.current = ""
      stopRequestedRef.current = false
      setIsRecordingAudio(false)
      setIsTranscribingAudio(false)

      if (!shouldProcessTranscript) {
        setPublishFeedback(transcript ? "A gravação foi encerrada. Clique em Áudio novamente para continuar." : "")
        return
      }

      setAiContext((current) => [current.trim(), transcript].filter(Boolean).join("\n\n"))
      setPublishFeedback("Áudio transcrito. Atualizando a prévia do imóvel...")
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

    if (!hasAiSource) {
      setPublishFeedback("Envie uma imagem, grave um áudio ou escreva algum contexto para iniciar a prévia.")
      return
    }

    await generateAiPreview({
      force: true,
      feedback: hasGenerated ? "Atualizando prévia..." : "Gerando primeira prévia...",
    })
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
      const resolvedTitle = title.trim() || (creationMode === "ai" ? buildFallbackTitle() : "")

      if (!validateManualProperty(resolvedTitle)) {
        return
      }

      if (!title.trim() && resolvedTitle) {
        setTitle(resolvedTitle)
      }

      const createdProperty = await addProperty({
        titulo: title,
        preco: price,
        tipo: propertyType,
        corretorId: "",
        imobiliariaId: null,
        title: resolvedTitle,
        city,
        neighborhood,
        location: `${neighborhood}, ${city}`,
        ownerName: "",
        price,
        images: [],
        bedrooms,
        bathrooms,
        parking,
        status: publishStatus,
        views: "0",
        leads: "0",
        type: propertyType,
        purpose: propertyPurpose,
        description,
        audioUrl: "",
        legal: {
          code: "",
          registryNumber: "",
          registryOffice: "",
          registryBook: "",
          registryPage: "",
          municipalRegistration: "",
          taxRegistration: "",
          cep: "",
          street: "",
          number: "",
          complement: "",
          district: "",
          city: "",
          state: "",
          privateArea: "",
          totalArea: "",
          idealFraction: "",
          condominiumName: "",
          condominiumFee: "",
          iptuValue: "",
          additionalFees: "",
          legalNotes: "",
        },
        documents: [],
        completion: {
          score: 0,
          pending: [],
        },
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

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (creationMode === "ai") return
    if (recognitionRef.current) {
      stopRequestedRef.current = true
      recognitionRef.current.stop()
    }
  }, [creationMode])

  useEffect(() => {
    if (creationMode !== "ai") return
    if (!hasAiSource || isRecordingAudio || isTranscribingAudio) return
    if (autoGenerationKeyRef.current === aiGenerationKey) return

    const timeoutId = window.setTimeout(() => {
      void generateAiPreview()
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [aiGenerationKey, creationMode, generateAiPreview, hasAiSource, isRecordingAudio, isTranscribingAudio])

  return (
    <BrokerPageShell title="Novo imóvel">
      <div className="grid gap-6">
        {billingBypassEnabled ? (
          <div className="rounded-[1.25rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
            Ambiente local com billing em modo de teste. Os bloqueios de plano estão temporariamente desativados.
          </div>
        ) : null}

        {isPlanBlocked ? (
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#ffb74d]/20 bg-[#ffb74d]/10 px-4 py-4 text-sm text-[#ffd180]">
            <p>Seu plano Corretor não está ativo para criar novos imóveis. Regularize sua assinatura para continuar.</p>
            <div>
              <Button
                asChild
                className="h-9 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                <Link href="/corretor/plano">Regularizar plano</Link>
              </Button>
            </div>
          </div>
        ) : hasReachedLimit ? (
          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-4 text-sm text-[#009b3a]">
            <p>Seu plano atual atingiu o limite permitido de 3 imóveis. Faça upgrade para continuar.</p>
            <div>
              <Button
                asChild
                className="h-9 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30"
              >
                <Link href="/corretor/plano">Assinar plano</Link>
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
            xmlSourceUrl={xmlSourceUrl}
            onXmlSourceUrlChange={setXmlSourceUrl}
            onXmlImport={handleXmlImport}
            onXmlImportUrl={handleXmlImportUrl}
            onConfirmImport={handleConfirmXmlImport}
          />
        ) : (
          <>

        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 px-6 py-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#7B8491]">Novo imóvel</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">
            {creationMode === "ai" ? "Use fotos, áudio ou texto para gerar o anúncio" : "Preencha os dados do imóvel com controle total"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
            {creationMode === "ai"
              ? "A IA monta a primeira versão do anúncio e você revisa tudo antes de publicar."
              : "Cadastre cada detalhe do imóvel com calma, sem depender da geração automática."}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCreationMode(null)}
            className="mt-5 h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
          >
            Voltar
          </Button>
        </section>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-[#050505]">{creationMode === "ai" ? "Fotos para acelerar a IA" : "Fotos do imóvel"}</CardTitle>
            <p className="text-sm text-[#6B7280]">
              {creationMode === "ai"
                ? "Envie fotos reais para apoiar a criação do anúncio. Você revisa o resultado antes de publicar."
                : "Adicione fotos reais do imóvel para compor o anúncio manual."}
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-0">
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[#009b3a]/28 bg-[#009b3a]/[0.05] px-6 text-center transition-colors hover:bg-[#009b3a]/[0.08]">
              <input
                type="file"
                multiple
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleImageSelection(event.target.files)}
              />
              <div className="flex size-14 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <ImagePlus className="size-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[#050505]">
                Arraste imagens aqui ou selecione do dispositivo
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[#6B7280]">
                {creationMode === "ai"
                  ? "Use fotos, áudio ou texto para a IA montar uma primeira versão do anúncio."
                  : "Selecione imagens reais para o cadastro tradicional do imóvel."}
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/80 px-4 py-2 text-sm text-[#4B5563]">
                <Upload className="size-4" />
                Selecionar imagens
              </div>
            </label>

            {previewImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {previewImages.map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative aspect-[4/3] max-h-32 overflow-hidden rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-28 flex-col items-center justify-center rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] px-4 text-center">
                <Images className="size-8 text-[#8B95A1]" />
                <p className="mt-3 text-sm font-medium text-[#4B5563]">Nenhuma foto selecionada</p>
                <p className="mt-1 text-sm text-[#7B8491]">As imagens reais aparecerão aqui antes da publicação.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            {creationMode === "ai" ? (
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#050505]">{creationMode === "ai" ? "Descrição, áudio e IA" : "Descrição do imóvel"}</CardTitle>
                <p className="text-sm text-[#6B7280]">
                  {creationMode === "ai"
                    ? "Descreva ou grave os pontos principais. A IA transforma isso em um anúncio revisável."
                    : "Escreva a descrição do imóvel diretamente, com os detalhes que deseja publicar."}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 pt-0">
                <Textarea
                  value={aiContext}
                  onChange={(event) => setAiContext(event.target.value)}
                  placeholder="Descreva o imóvel em texto livre. Cada nova informação melhora a mesma prévia."
                  className="min-h-40 rounded-[1.25rem] border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
                />

                {creationMode === "ai" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleAudioDescription}
                    className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505] disabled:opacity-60"
                  >
                    <AudioLines className="size-4" />
                    {isRecordingAudio ? "Parar" : "Áudio"}
                  </Button>

                  <label className="inline-flex h-10 cursor-pointer items-center justify-start gap-2 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] transition-colors hover:bg-white hover:text-[#050505]">
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
                    className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:opacity-60"
                  >
                    {isGenerating ? <Spinner className="size-4 text-white" /> : <Sparkles className="size-4" />}
                    {isGenerating ? "Atualizando..." : hasGenerated ? "Atualizar agora" : "Gerar primeira prévia"}
                  </Button>
                </div>
                ) : null}

                {creationMode === "ai" && audioFile ? (
                  <div className="grid gap-3 rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] px-4 py-3 text-sm text-[#5F6B7A]">
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
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-[#050505]">{creationMode === "manual" ? "Dados do imóvel" : "Revisão do imóvel"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 pt-0">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Título do imóvel">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Ex.: Apartamento com varanda no Jardins"
                      className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
                    />
                  </Field>
                  <Field label="Valor">
                    <Input
                      value={price}
                      onChange={(event) => setPrice(formatCurrencyInput(event.target.value))}
                      placeholder="R$ 500.000,00"
                      className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
                    />
                  </Field>
                  <Field label="Tipo">
                    <Select value={propertyType} onValueChange={(value) => setPropertyType(value as PropertyType)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.06] bg-white/80 text-[#050505]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-black/[0.06] bg-white text-[#111111]">
                        <SelectItem value="Apartamento">Apartamento</SelectItem>
                        <SelectItem value="Casa">Casa</SelectItem>
                        <SelectItem value="Comercial">Comercial</SelectItem>
                        <SelectItem value="Terreno">Terreno</SelectItem>
                        <SelectItem value="Sala comercial">Sala comercial</SelectItem>
                        <SelectItem value="Loja">Loja</SelectItem>
                        <SelectItem value="Cobertura">Cobertura</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Finalidade">
                    <Select value={propertyPurpose} onValueChange={(value) => setPropertyPurpose(value as PropertyPurpose)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.06] bg-white/80 text-[#050505]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-black/[0.06] bg-white text-[#111111]">
                        <SelectItem value="Venda">Venda</SelectItem>
                        <SelectItem value="Locação">Locação</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Status">
                    <Select value={publishStatus} onValueChange={(value) => setPublishStatus(value as PublishStatus)}>
                      <SelectTrigger className="h-10 w-full rounded-xl border-black/[0.06] bg-white/80 text-[#050505]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-black/[0.06] bg-white text-[#111111]">
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
                      className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
                    />
                  </Field>
                  <Field label="Bairro">
                    <Input
                      value={neighborhood}
                      onChange={(event) => setNeighborhood(event.target.value)}
                      placeholder="Jardins"
                      className="h-10 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
                    />
                  </Field>
                </div>

                <Field label={creationMode === "manual" ? "Descrição" : "Descrição do anúncio"}>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={
                      creationMode === "manual"
                        ? "Descreva os principais diferenciais do imóvel..."
                        : "Revise a descrição gerada pela IA antes de publicar."
                    }
                    className="min-h-32 rounded-[1.25rem] border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#8B95A1]"
                  />
                </Field>

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
            <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <CardContent className="p-6">
                <p className="text-sm leading-7 text-[#5F6B7A]">
                  {creationMode === "ai"
                    ? "Fluxo rápido: envie contexto, gere com IA e ajuste os dados antes de publicar."
                    : "Fluxo manual: preencha informações, descrição e fotos com controle total sobre o anúncio."}
                </p>
              </CardContent>
            </Card>
            {publishFeedback && !hasGenerated ? (
              <p className="text-center text-sm text-[#009b3a]">{publishFeedback}</p>
            ) : null}
          </div>
        </div>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <CardHeader className="px-6 py-5">
              <CardTitle className="text-xl text-[#050505]">
                {isGenerating ? "Gerando seu anúncio..." : "Preview do anúncio"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {isGenerating && !hasGenerated ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] text-center">
                  <Spinner className="size-6 text-[#009b3a]" />
                  <p className="mt-4 text-base font-medium text-[#050505]">Gerando sua prévia...</p>
                  <p className="mt-2 text-sm text-[#6B7280]">
                    A IA está usando tudo o que você já enviou para enriquecer o mesmo draft.
                  </p>
                </div>
              ) : !hasPreviewData ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] px-4 text-center">
                  <Images className="size-9 text-[#8B95A1]" />
                  <p className="mt-3 text-sm font-medium text-[#4B5563]">Envie qualquer contexto para visualizar a prévia do imóvel.</p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="relative aspect-[4/3] max-h-80 overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8]">
                    {previewImages[0] ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewImages[0]} alt="Preview do anúncio" className="h-full w-full object-cover" />
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <Images className="size-9 text-[#8B95A1]" />
                        <p className="mt-3 text-sm font-medium text-[#4B5563]">Preview sem foto</p>
                        <p className="mt-1 text-sm text-[#7B8491]">Selecione imagens para visualizar o anúncio.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-between gap-5 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-[#009b3a]">{hasGenerated ? "Anúncio gerado com IA" : "Anúncio manual"}</p>
                      {isGenerating ? (
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs text-[#009b3a]">
                          <Spinner className="size-3" />
                          Atualizando prévia
                        </div>
                      ) : null}
                      <h3 className="mt-3 text-2xl font-semibold text-[#050505]">{previewTitle}</h3>
                      <p className="mt-2 text-sm text-[#6B7280]">
                        {previewLocation}
                      </p>
                      <p className="mt-4 text-2xl font-semibold text-[#050505]">{previewPrice}</p>
                      <p className="mt-5 text-sm leading-7 text-[#5F6B7A]">
                        {previewDescription}
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
                            className="rounded-full border border-[#009b3a]/20 bg-[#009b3a]/10 px-3 py-1 text-xs text-[#009b3a]"
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
                        className="h-11 w-full rounded-xl bg-[#009b3a] text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30 disabled:opacity-70"
                      >
                        <ArrowUpFromLine className="size-4" />
                        {isPublished ? "Publicado no catálogo" : isSubmitting ? "Publicando..." : "Publicar no catálogo"}
                      </Button>
                      {publishFeedback && <p className="mt-3 text-sm text-[#009b3a]">{publishFeedback}</p>}
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
    <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#7B8491]">Novo imóvel</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Como você quer criar este imóvel?</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
        Escolha o melhor ponto de partida. Você sempre poderá revisar antes de publicar.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <CreationOption
          icon={Sparkles}
          title="Criar com IA"
          description="Descreva o imóvel e deixe o EME montar o anúncio para você."
          onClick={() => onChoose("ai")}
        />
        <CreationOption
          icon={Keyboard}
          title="Criar manualmente"
          description="Preencha os dados do imóvel passo a passo."
          onClick={() => onChoose("manual")}
        />
        <CreationOption
          icon={FileText}
          title="Importar"
          description="Importe informações de outro anúncio ou arquivo."
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
      className="group min-h-52 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5 text-left transition-colors hover:border-[#009b3a]/30 hover:bg-[#009b3a]/[0.06]"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-[#050505]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#6B7280]">{description}</p>
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
  xmlSourceUrl,
  onXmlSourceUrlChange,
  onXmlImport,
  onXmlImportUrl,
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
  xmlSourceUrl: string
  onXmlSourceUrlChange: (value: string) => void
  onXmlImport: (files: FileList | null) => void | Promise<void>
  onXmlImportUrl: () => void | Promise<void>
  onConfirmImport: () => void | Promise<void>
}) {
  void feedback
  void preview
  void summary
  void report
  void isAnalyzing
  void isImporting
  void xmlSourceUrl
  void onXmlSourceUrlChange
  void onXmlImport
  void onXmlImportUrl
  void onConfirmImport
  void XmlImportPreview
  void ImportStatusBadge

  return (
    <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#7B8491]">Importar imóveis</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Escolha uma origem</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
            Use XML, URL de XML, link do anúncio ou imagem para chegar sempre na mesma prévia revisável.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onBack} className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]">
          Voltar
        </Button>
      </div>
      <div className="mt-6">
        <AdImportPanel onImported={onImported} />
      </div>
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
    <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#050505]">Preview da importação</h3>
          <p className="mt-1 text-sm text-[#6B7280]">
            {summary.total} encontrados · {summary.ready} prontos · {summary.needsReview} para revisar · {summary.invalid} inválidos
          </p>
        </div>
        <Button type="button" onClick={() => void onConfirmImport()} disabled={isImporting || summary.ready + summary.needsReview === 0} className="h-10 rounded-xl bg-[#009b3a] px-4 text-sm font-semibold text-white hover:bg-[#008633] disabled:opacity-60">
          {isImporting ? "Importando..." : "Confirmar importação"}
        </Button>
      </div>
      <div className="grid gap-3">
        {preview.slice(0, 12).map((property, index) => (
          <div key={`${property.title}-${index}`} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-[#050505]">{property.title || "Imóvel sem título"}</p>
                <p className="mt-1 text-sm text-[#6B7280]">{[property.neighborhood, property.city].filter(Boolean).join(", ") || "Localização pendente"}</p>
              </div>
              <ImportStatusBadge status={property.status} />
            </div>
            <p className="mt-2 text-sm text-[#5F6B7A]">{property.price || "Preço pendente"}</p>
            {property.issues.length > 0 ? <p className="mt-2 text-xs text-[#7B8491]">Revisar: {property.issues.join(", ")}</p> : null}
          </div>
        ))}
      </div>
      {report ? (
        <div className="rounded-[1rem] border border-[#009b3a]/20 bg-[#009b3a]/10 px-4 py-3 text-sm text-[#009b3a]">
          Importados: {report.imported}. Duplicados ignorados: {report.duplicates}. Com erro: {report.errors}.
        </div>
      ) : null}
    </div>
  )
}

function ImportStatusBadge({ status }: { status: ParsedXmlProperty["status"] }) {
  const label =
    status === "ready" ? "Pronto para importar" : status === "needs_review" ? "Precisa revisar" : "Inválido"

  return (
    <span className="rounded-full border border-black/[0.06] bg-white/80 px-3 py-1 text-xs text-[#5F6B7A]">
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
      <span className="text-sm font-medium text-[#5F6B7A]">{label}</span>
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
    <div className="rounded-[1.25rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm font-medium text-[#5F6B7A]">{label}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="h-9 w-9 rounded-xl border border-black/[0.06] bg-white/80 text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
        >
          -
        </Button>
        <span className="text-2xl font-semibold text-[#050505]">{value}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 rounded-xl border border-black/[0.06] bg-white/80 text-[#5F6B7A] hover:bg-white hover:text-[#050505]"
        >
          +
        </Button>
      </div>
    </div>
  )
}

function InfoPill({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-black/[0.06] bg-[#fbfbf8] px-3 py-1.5 text-sm text-[#5F6B7A]">
      {label}
    </div>
  )
}
