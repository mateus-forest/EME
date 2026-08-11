"use client"

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  Download,
  ImagePlus,
  MessageCircle,
  RefreshCcw,
  Save,
  Sparkles,
  Upload,
  Video,
} from "lucide-react"
import { z } from "zod"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  getStudioVideoDurationLabel,
  getStudioVideoEstimatedCredits,
  studioVideoCameraMovementOptions,
  studioVideoDefaultDuration,
  studioVideoFormats,
  studioVideoInvalidDurationMessage,
  studioVideoObjectives,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  studioVideoRhythmOptions,
  studioVideoSelectableDurationOptions,
  studioVideoStyles,
  studioVideoTransformationOptions,
} from "@/lib/studio-ia-video-shared"

type StudioVideoStep = "selection" | "configuration" | "review" | "processing" | "preview" | "result"
type StudioVideoFormat = (typeof studioVideoFormats)[number]
type StudioVideoDuration = (typeof studioVideoSelectableDurationOptions)[number]["value"]
type StudioVideoObjective = (typeof studioVideoObjectives)[number]
type StudioVideoStyle = (typeof studioVideoStyles)[number]
type StudioVideoTransformation = (typeof studioVideoTransformationOptions)[number]
type StudioVideoRhythm = (typeof studioVideoRhythmOptions)[number]
type StudioVideoCameraMovement = (typeof studioVideoCameraMovementOptions)[number]
type GeneratedVideoResult = z.infer<typeof studioVideoResultSchema>
type StudioVideoMovement = "Automático" | "Travelling suave" | "Aproximação suave" | "Órbita suave" | "Câmera lenta" | "Quase estático"
type StudioVideoSourceMode = "property" | "upload" | "prepared"

type UploadPreview = {
  name: string
  size: number
  type: string
  url: string
  file: File
}

const stepLabels: Array<{ id: StudioVideoStep; label: string }> = [
  { id: "selection", label: "Material" },
  { id: "configuration", label: "Personalização" },
  { id: "review", label: "Revisão" },
  { id: "processing", label: "Geração" },
  { id: "preview", label: "Aprovação" },
  { id: "result", label: "Resultado" },
]
const visibleStepLabels = stepLabels.filter((step) => step.id !== "preview")

const formatOptions: Array<{ label: string; value: StudioVideoFormat }> = [
  { label: "Vertical 9:16", value: "Reel vertical 9:16" },
  { label: "Horizontal 16:9", value: "Paisagem 16:9" },
]

const videoObjectiveOptions = studioVideoObjectives.filter((objective) => ![
  "Mobiliar ambiente",
  "Transformar obra em imovel pronto",
  "Melhorar iluminacao",
  "Decorar ambiente",
  "Home staging",
  "Modernizar decoracao",
  "Valorizar area externa",
  "Simular reforma",
].includes(objective))

const movementOptions: StudioVideoMovement[] = ["Automático", "Travelling suave", "Aproximação suave", "Órbita suave", "Câmera lenta", "Quase estático"]
const movementToCurrentCamera: Record<StudioVideoMovement, StudioVideoCameraMovement> = {
  "Automático": "Gimbal",
  "Travelling suave": "Travelling",
  "Aproximação suave": "Dolly",
  "Órbita suave": "Orbit",
  "Câmera lenta": "Slow Motion",
  "Quase estático": "Estatico elegante",
}

type InitialPreparedAsset = {
  id: string
  imageUrl: string
}

export function BrokerStudioIaVideoPage({ initialPreparedAsset = null }: { initialPreparedAsset?: InitialPreparedAsset | null }) {
  const { properties, isLoading } = useBrokerProperties()
  const [sourceMode, setSourceMode] = useState<StudioVideoSourceMode>(initialPreparedAsset ? "prepared" : "property")
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedReferenceImage, setSelectedReferenceImage] = useState("")
  const [uploadedImage, setUploadedImage] = useState<UploadPreview | null>(null)
  const [preparedAsset, setPreparedAsset] = useState<InitialPreparedAsset | null>(initialPreparedAsset)
  const [format, setFormat] = useState<StudioVideoFormat>(studioVideoFormats[0])
  const [duration, setDuration] = useState<StudioVideoDuration>(studioVideoDefaultDuration)
  const [objective, setObjective] = useState<StudioVideoObjective>(studioVideoObjectives[0])
  const [style, setStyle] = useState<StudioVideoStyle>(studioVideoStyles[0])
  const transformation: StudioVideoTransformation = "Nenhuma"
  const [rhythm, setRhythm] = useState<StudioVideoRhythm>(studioVideoRhythmOptions[1])
  const [cameraMovement, setCameraMovement] = useState<StudioVideoCameraMovement>(studioVideoCameraMovementOptions[3])
  const [movement, setMovement] = useState<StudioVideoMovement>("Automático")
  const [scriptMode, setScriptMode] = useState<"Automático" | "Personalizado">("Automático")
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  const [currentStep, setCurrentStep] = useState<StudioVideoStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [generationError, setGenerationError] = useState("")
  const [durationNotice, setDurationNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingResult, setIsSavingResult] = useState(false)
  const [isApprovingPreview, setIsApprovingPreview] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<GeneratedVideoResult | null>(null)
  const uploadedImageRef = useRef<UploadPreview | null>(null)

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )

  const canAdvanceToConfiguration = Boolean(
    (sourceMode === "property" && selectedProperty && selectedReferenceImage) ||
    (sourceMode === "upload" && uploadedImage) ||
    (sourceMode === "prepared" && preparedAsset),
  )

  const requiresPreviewFlow = false

  const estimatedStageCredits = useMemo(() => {
    if (generatedResult?.stageEstimatedCredits != null) {
      return generatedResult.stageEstimatedCredits
    }

    if (requiresPreviewFlow) {
      if (generatedResult?.previewApproved || currentStep === "preview") {
        return getStudioVideoEstimatedCredits({
          duration,
          objective,
          transformation,
          stage: "video",
          model: generatedResult?.providerModel || "ray-2",
        })
      }

      return getStudioVideoEstimatedCredits({
        duration,
        objective,
        transformation,
        stage: "preview",
      })
    }

    return getStudioVideoEstimatedCredits({
      duration,
      objective,
      transformation,
      stage: "direct",
    })
  }, [currentStep, duration, generatedResult?.previewApproved, generatedResult?.providerModel, generatedResult?.stageEstimatedCredits, objective, requiresPreviewFlow, transformation])

  const totalEstimatedCredits = useMemo(() => {
    if (generatedResult?.estimatedCredits != null) {
      return generatedResult.estimatedCredits
    }

    if (requiresPreviewFlow) {
      return getStudioVideoEstimatedCredits({
        duration,
        objective,
        transformation,
        stage: "preview",
      }) +
        getStudioVideoEstimatedCredits({
          duration,
          objective,
          transformation,
          stage: "video",
          model: generatedResult?.providerModel || "ray-2",
        })
    }

    return getStudioVideoEstimatedCredits({
      duration,
      objective,
      transformation,
      stage: "direct",
    })
  }, [duration, generatedResult?.estimatedCredits, generatedResult?.providerModel, objective, requiresPreviewFlow, transformation])

  const sourcePreviewUrl = sourceMode === "property"
    ? selectedReferenceImage
    : sourceMode === "upload"
      ? uploadedImage?.url ?? ""
      : preparedAsset?.imageUrl ?? ""

  useEffect(() => {
    uploadedImageRef.current = uploadedImage
  }, [uploadedImage])

  useEffect(() => {
    return () => {
      if (uploadedImageRef.current) URL.revokeObjectURL(uploadedImageRef.current.url)
    }
  }, [])

  useEffect(() => {
    if (generatedResult?.noticeMessage) {
      setDurationNotice(generatedResult.noticeMessage)
    }
  }, [generatedResult?.noticeMessage])

  useEffect(() => {
    if (!generatedResult?.requestId || currentStep !== "processing") return

    let cancelled = false
    let consecutiveFailures = 0
    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/studio-ia/video?requestId=${encodeURIComponent(generatedResult.requestId)}`, {
          credentials: "include",
          cache: "no-store",
        })
        const data = (await response.json().catch(() => null)) as (GeneratedVideoResult & { error?: string }) | null
        if (!response.ok || !data) {
          throw new Error(data?.error || "Não foi possível atualizar o processamento do fluxo.")
        }

        const parsed = studioVideoResultSchema.parse(data)
        if (cancelled) return
        consecutiveFailures = 0

        setGeneratedResult(parsed)

        if (parsed.jobStage === "preview_ready" || parsed.jobStage === "preview_approved") {
          setCurrentStep("preview")
          setIsSubmitting(false)
          setGenerationError(parsed.previewErrorMessage || "")
          window.clearInterval(intervalId)
          return
        }

        if (parsed.jobStage === "completed") {
          setCurrentStep("result")
          setIsSubmitting(false)
          setGenerationError("")
          window.clearInterval(intervalId)
          return
        }

        if (parsed.jobStage === "failed") {
          setCurrentStep(parsed.requestKind === "transformation_pipeline" ? "preview" : "review")
          setIsSubmitting(false)
          setGenerationError(
            parsed.previewErrorMessage || parsed.errorMessage || "O provedor não conseguiu concluir esta etapa. Os créditos foram preservados.",
          )
          window.clearInterval(intervalId)
        }
      } catch (caughtError) {
        if (cancelled) return

        // Uma unica falha na consulta de status (rede instavel, blip do provedor) nao deve
        // derrubar o fluxo inteiro — so desiste apos algumas tentativas seguidas falharem. Isso e
        // so uma checagem de status: as tentativas extras nao geram nova cobranca de creditos.
        consecutiveFailures += 1
        if (consecutiveFailures < 3) return

        setCurrentStep(generatedResult.requestKind === "transformation_pipeline" ? "preview" : "review")
        setIsSubmitting(false)
        setGenerationError(formatStudioVideoPollingError(caughtError))
        window.clearInterval(intervalId)
      }
    }, 4000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [currentStep, generatedResult?.requestId, generatedResult?.requestKind])

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    const property = properties.find((item) => item.id === propertyId) ?? null
    setSelectedReferenceImage(property?.images[0] ?? "")
    setSourceMode("property")
    resetGeneratedState()
    setCurrentStep("selection")
  }

  function handleSelectPropertyImage(imageUrl: string) {
    setSelectedReferenceImage(imageUrl)
    setSourceMode("property")
    resetGeneratedState()
  }

  function handleUploadedImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (uploadedImage) URL.revokeObjectURL(uploadedImage.url)
    setUploadedImage({
      name: file.name,
      size: file.size,
      type: file.type || "image/jpeg",
      url: URL.createObjectURL(file),
      file,
    })
    setSourceMode("upload")
    resetGeneratedState()
    event.target.value = ""
  }

  function buildPayload() {
    return studioVideoRequestSchema.parse({
      propertyId: sourceMode === "property" ? selectedProperty?.id : undefined,
      sourceAssetId: sourceMode === "prepared" ? preparedAsset?.id : undefined,
      referenceImageUrls: sourceMode === "property" && selectedReferenceImage
        ? [selectedReferenceImage]
        : sourceMode === "prepared" && preparedAsset
          ? [preparedAsset.imageUrl]
          : [],
      uploadedImages: sourceMode === "upload" && uploadedImage ? [{
        name: uploadedImage.name,
        type: uploadedImage.type,
        size: uploadedImage.size,
      }] : [],
      format,
      duration,
      objective,
      style,
      transformation,
      rhythm,
      cameraMovement,
      additionalInstructions: scriptMode === "Personalizado" ? additionalInstructions : "",
      version: resultVersion + 1,
    })
  }

  function resetGeneratedState() {
    setGenerationError("")
    setDurationNotice("")
    setGeneratedResult(null)
    setResultVersion(0)
    setIsSubmitting(false)
    setIsSavingResult(false)
    setIsApprovingPreview(false)
  }

  function goToConfiguration() {
    if (!canAdvanceToConfiguration) {
      setGenerationError("Selecione uma fotografia do imóvel ou envie uma imagem para continuar.")
      return
    }

    setGenerationError("")
    setDurationNotice("")
    setCurrentStep("configuration")
  }

  function goToReview() {
    try {
      buildPayload()
      setGenerationError("")
      setDurationNotice("")
      setCurrentStep("review")
    } catch (caughtError) {
      const issue =
        caughtError instanceof z.ZodError
          ? caughtError.issues.some((item) => item.path.includes("duration"))
            ? studioVideoInvalidDurationMessage
            : caughtError.issues[0]?.message
          : null
      setGenerationError(issue || "Revise os campos antes de continuar.")
    }
  }

  async function startGeneration() {
    try {
      const payload = buildPayload()
      const formData = new FormData()
      formData.append("payload", JSON.stringify(payload))
      if (sourceMode === "upload" && uploadedImage) formData.append("images", uploadedImage.file)

      setGenerationError("")
      setDurationNotice("")
      setCurrentStep("processing")
      setIsSubmitting(true)

      const response = await fetch("/api/studio-ia/video", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        body: formData,
      })

      const data = (await response.json().catch(() => null)) as
        | (GeneratedVideoResult & { error?: string; creditsBlocked?: boolean; technicalLimitReached?: boolean })
        | { error?: string }
        | null

      if (!response.ok || !data) {
        throw new Error(data?.error || "Não foi possível iniciar o fluxo.")
      }

      const parsed = studioVideoResultSchema.parse(data)
      setGeneratedResult(parsed)
      setResultVersion(payload.version)

      if (parsed.jobStage === "preview_ready" || parsed.jobStage === "preview_approved") {
        setCurrentStep("preview")
        setIsSubmitting(false)
        return
      }

      if (parsed.jobStage === "completed") {
        setCurrentStep("result")
        setIsSubmitting(false)
      }
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível iniciar o fluxo.")
      setCurrentStep("review")
      setIsSubmitting(false)
    }
  }

  // Retoma a checagem de status do mesmo job (mesmo requestId) sem criar uma nova geracao —
  // usado quando a consulta de status falhou mas o briefing/previa ja gerados nao devem ser
  // perdidos. Nao cobra credito: e so uma nova tentativa de leitura de status.
  function retryStatusCheck() {
    if (!generatedResult?.requestId) return
    setGenerationError("")
    setIsSubmitting(true)
    setCurrentStep("processing")
  }

  async function approvePreview() {
    if (!generatedResult?.requestId) return

    try {
      setIsApprovingPreview(true)
      setGenerationError("")
      const response = await fetch("/api/studio-ia/video", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          requestId: generatedResult.requestId,
          action: "approve-preview",
        }),
      })

      const data = (await response.json().catch(() => null)) as (GeneratedVideoResult & { error?: string }) | null
      if (!response.ok || !data) {
        throw new Error(data?.error || "Não foi possível aprovar a prévia.")
      }

      setGeneratedResult(studioVideoResultSchema.parse(data))
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível aprovar a prévia.")
    } finally {
      setIsApprovingPreview(false)
    }
  }

  async function regeneratePreview() {
    if (!generatedResult?.requestId) return

    try {
      setGenerationError("")
      setCurrentStep("processing")
      setIsSubmitting(true)
      const response = await fetch("/api/studio-ia/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          requestId: generatedResult.requestId,
          action: "regenerate-preview",
        }),
      })

      const data = (await response.json().catch(() => null)) as (GeneratedVideoResult & { error?: string }) | null
      if (!response.ok || !data) {
        throw new Error(data?.error || "Não foi possível regenerar a prévia.")
      }

      setGeneratedResult(studioVideoResultSchema.parse(data))
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível regenerar a prévia.")
      setCurrentStep("preview")
      setIsSubmitting(false)
    }
  }

  async function createTransformationVideo() {
    if (!generatedResult?.requestId) return

    try {
      setGenerationError("")
      setCurrentStep("processing")
      setIsSubmitting(true)
      const response = await fetch("/api/studio-ia/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          requestId: generatedResult.requestId,
          action: "create-video",
        }),
      })

      const data = (await response.json().catch(() => null)) as (GeneratedVideoResult & { error?: string }) | null
      if (!response.ok || !data) {
        throw new Error(data?.error || "Não foi possível criar o vídeo da transformação.")
      }

      setGeneratedResult(studioVideoResultSchema.parse(data))
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível criar o vídeo da transformação.")
      setCurrentStep("preview")
      setIsSubmitting(false)
    }
  }

  async function saveToMyFiles() {
    if (!generatedResult?.requestId || generatedResult.fileSaved) return

    try {
      setIsSavingResult(true)
      setGenerationError("")

      const response = await fetch("/api/studio-ia/video", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ requestId: generatedResult.requestId, action: "save-video" }),
      })

      const data = (await response.json().catch(() => null)) as { saved?: boolean; error?: string } | null
      if (!response.ok) {
        throw new Error(data?.error || "Não foi possível salvar o vídeo em Meus arquivos.")
      }

      setGeneratedResult((current) => (current ? { ...current, fileSaved: true } : current))
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar o vídeo.")
    } finally {
      setIsSavingResult(false)
    }
  }

  function restartFlow() {
    if (uploadedImage) URL.revokeObjectURL(uploadedImage.url)
    setSourceMode("property")
    setSelectedPropertyId("")
    setSelectedReferenceImage("")
    setUploadedImage(null)
    setPreparedAsset(null)
    setFormat(studioVideoFormats[0])
    setDuration(studioVideoDefaultDuration)
    setObjective(studioVideoObjectives[0])
    setStyle(studioVideoStyles[0])
    setRhythm(studioVideoRhythmOptions[1])
    setCameraMovement(studioVideoCameraMovementOptions[3])
    setMovement("Automático")
    setScriptMode("Automático")
    setAdditionalInstructions("")
    setCurrentStep("selection")
    resetGeneratedState()
  }

  const summaryItems = useMemo(
    () => [
      { label: "Origem", value: sourceMode === "property" ? selectedProperty?.title ?? "Imóvel" : sourceMode === "upload" ? "Upload" : "Preparar imóvel" },
      { label: "Material", value: sourcePreviewUrl ? "1 imagem principal" : "Não selecionado" },
      { label: "Formato", value: formatOptions.find((item) => item.value === format)?.label ?? format },
      { label: "Estilo", value: style },
      { label: "Ritmo", value: rhythm },
      { label: "Movimento", value: movement },
      { label: "Duração", value: "9 segundos" },
      { label: "Créditos previstos", value: `${totalEstimatedCredits}` },
    ],
    [
      format,
      movement,
      rhythm,
      selectedProperty?.title,
      sourceMode,
      sourcePreviewUrl,
      style,
      totalEstimatedCredits,
    ],
  )

  const creativeBriefPreview = useMemo(
    () =>
      [
        `Formato: ${formatOptions.find((item) => item.value === format)?.label ?? format}.`,
        `Estilo: ${style}.`,
        `Ritmo: ${rhythm}.`,
        `Movimento: ${movement}.`,
        scriptMode === "Personalizado" && additionalInstructions.trim() ? `Orientações: ${additionalInstructions.trim()}` : "Sem orientações adicionais.",
      ]
        .filter(Boolean)
        .join(" "),
    [
      additionalInstructions,
      format,
      movement,
      rhythm,
      scriptMode,
      style,
    ],
  )

  if (isLoading) {
    return (
      <BrokerPageShell title="Studio IA">
        <EmeLoading message="Carregando fluxo de vídeo do Studio IA..." />
      </BrokerPageShell>
    )
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="min-w-0 grid gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Video className="size-3.5" />
                Apresentação do imóvel
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Criar vídeo</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Anime uma fotografia do imóvel com direção visual simples e duração de 9 segundos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                <Link href="/corretor/studio-ia">
                  <ChevronLeft className="size-4" />
                  Voltar para Studio IA
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
              >
                <Link href="/corretor/documentos">
                  <MessageCircle className="size-4" />
                  Abrir Meus arquivos
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="studio-step-grid">
          {visibleStepLabels.map((step, index) => {
            const isActive = step.id === currentStep
            const isComplete = videoStepOrder(step.id) < videoStepOrder(currentStep)

            return (
              <div
                key={step.id}
                className={`rounded-[1.15rem] border px-4 py-3 text-sm ${isActive ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#009b3a]" : isComplete ? "border-black/[0.06] bg-white text-[#050505]" : "border-black/[0.06] bg-[#fbfbf8] text-[#7B8491]"}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${isActive ? "bg-[#009b3a] text-white" : isComplete ? "bg-[#050505] text-white" : "bg-white text-[#7B8491]"}`}>
                    {isComplete ? <CheckCircle2 className="size-3.5" /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </div>
              </div>
            )
          })}
        </section>

        {generationError ? (
          <div className="rounded-[1.15rem] border border-[#f3d0d0] bg-[#fff6f6] px-4 py-3 text-sm text-[#a32626]">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível concluir o fluxo.</p>
                <p className="mt-1 leading-6">{generationError}</p>
              </div>
            </div>
          </div>
        ) : null}

        {durationNotice ? (
          <div className="rounded-[1.15rem] border border-[#dbe8df] bg-[#f8fdf9] px-4 py-3 text-sm text-[#4f6b59]">
            {durationNotice}
          </div>
        ) : null}

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
          <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">
                {currentStep === "selection" && "A. Material"}
                {currentStep === "configuration" && "B–F. Direcione o vídeo"}
                {currentStep === "review" && "3. Revise antes de enviar"}
                {currentStep === "processing" && "4. Acompanhando a etapa atual"}
                {currentStep === "preview" && "5. Aprove a prévia transformada"}
                {currentStep === "result" && "6. Vídeo final pronto"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:p-5 sm:pt-0">
              {currentStep === "selection" ? (
                <>
                  <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Selecionar imóvel</p>
                      <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                        Escolha um imóvel e uma única fotografia como imagem principal.
                      </p>

                      <div className="mt-4 grid gap-3">
                        <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Escolha um imóvel" />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {selectedProperty ? (
                          <div className="rounded-[1rem] border border-black/[0.06] bg-white p-4">
                            <p className="font-semibold text-[#050505]">{selectedProperty.title}</p>
                            <p className="mt-1 text-sm text-[#6B7280]">{selectedProperty.location}</p>
                            <p className="mt-1 text-sm text-[#6B7280]">{selectedProperty.price}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Enviar imagem</p>
                      <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                        Use uma imagem própria sem precisar selecionar um imóvel cadastrado.
                      </p>

                      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1rem] border border-dashed border-black/[0.08] bg-white px-4 py-8 text-center transition-colors hover:border-[#009b3a]/25 hover:bg-[#f8fdf9]">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                          <Upload className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-[#050505]">Escolher imagem principal</p>
                          <p className="mt-1 text-sm leading-6 text-[#6B7280]">JPG, PNG ou WEBP · uma imagem.</p>
                        </div>
                        <Input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUploadedImage} />
                      </label>
                    </div>
                  </div>

                  {selectedProperty?.images.length ? (
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Imagens do imóvel</p>
                          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                            Selecione a fotografia que iniciará o vídeo.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#4B5563]">
                          Uma imagem principal
                        </span>
                      </div>

                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedProperty.images.map((imageUrl, index) => {
                          const selected = sourceMode === "property" && selectedReferenceImage === imageUrl

                          return (
                            <button
                              key={imageUrl}
                              type="button"
                              onClick={() => handleSelectPropertyImage(imageUrl)}
                              className={`overflow-hidden rounded-[1rem] border text-left transition ${selected ? "border-[#009b3a]/35 ring-2 ring-[#009b3a]/12" : "border-black/[0.06] hover:border-black/[0.12]"}`}
                            >
                              <div className="h-36 w-full bg-[#eef2f6]" style={{ backgroundImage: `url(${imageUrl})`, backgroundPosition: "center", backgroundSize: "cover" }} />
                              <div className="flex items-center justify-between px-3 py-2 text-sm">
                                <span className="font-medium text-[#050505]">Imagem {index + 1}</span>
                                <span className={selected ? "text-[#009b3a]" : "text-[#98A2B3]"}>{selected ? "Selecionada" : "Selecionar"}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}

                  {sourcePreviewUrl ? (
                    <div className="rounded-[1.2rem] border border-[#009b3a]/20 bg-[#f8fdf9] p-4" data-testid="active-video-source">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="h-28 w-full shrink-0 rounded-2xl bg-[#eef2f6] bg-cover bg-center sm:w-40" style={{ backgroundImage: `url(${sourcePreviewUrl})` }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#009b3a]">Imagem principal ativa</p>
                          <p className="mt-2 font-semibold text-[#050505]">
                            {sourceMode === "property" ? "Fotografia do imóvel" : sourceMode === "upload" ? "Imagem enviada" : "Resultado aprovado de Preparar imóvel"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                            Esta é a única imagem que será enviada para a geração atual.
                          </p>
                          {sourceMode === "upload" && uploadedImage ? <p className="mt-1 truncate text-xs text-[#7B8491]">{uploadedImage.name}</p> : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={goToConfiguration}
                      className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                    >
                      Continuar
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "configuration" ? (
                <>
                  <div className="rounded-[1.2rem] border border-[#dbe8df] bg-[#f8fdf9] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Direção da geração</p>
                    <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                      Formato e duração seguem parâmetros do gerador. Estilo, ritmo, movimento e orientações são enviados no prompt e podem variar no resultado.
                    </p>
                  </div>

                  <FieldCard label="B. Formato">
                    <ChoiceButtons options={formatOptions.map((item) => item.label)} value={formatOptions.find((item) => item.value === format)?.label ?? "Vertical 9:16"} onChange={(label) => setFormat(formatOptions.find((item) => item.label === label)?.value ?? formatOptions[0].value)} />
                  </FieldCard>

                  <FieldCard label="C. Objetivo">
                    <Select value={objective} onValueChange={(value) => setObjective(value as StudioVideoObjective)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{videoObjectiveOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                    </Select>
                  </FieldCard>

                  <FieldCard label="D. Estilo e ritmo">
                    <div className="grid gap-4">
                      <Select value={style} onValueChange={(value) => setStyle(value as StudioVideoStyle)}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{studioVideoStyles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                      </Select>
                      <ChoiceButtons options={studioVideoRhythmOptions} value={rhythm} onChange={(value) => setRhythm(value as StudioVideoRhythm)} />
                    </div>
                  </FieldCard>

                  <FieldCard label="E. Movimento sugerido">
                    <ChoiceButtons options={movementOptions} value={movement} onChange={(value) => { const nextMovement = value as StudioVideoMovement; setMovement(nextMovement); setCameraMovement(movementToCurrentCamera[nextMovement]) }} />
                    <p className="mt-3 text-xs leading-5 text-[#8B95A1]">A escolha orienta a câmera por linguagem natural; o gerador pode adaptar o movimento à imagem.</p>
                  </FieldCard>

                  <FieldCard label="F. Orientações adicionais">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#050505]">Direção livre</p>
                        <ChoiceButtons options={["Automático", "Personalizado"]} value={scriptMode} onChange={(value) => setScriptMode(value as "Automático" | "Personalizado")} compact />
                      </div>
                      {scriptMode === "Personalizado" ? (
                        <Textarea value={additionalInstructions} onChange={(event) => setAdditionalInstructions(event.target.value)} maxLength={600} placeholder="Ex.: valorize a luz natural e preserve os materiais do ambiente." className="mt-4 min-h-28" />
                      ) : null}
                    </div>
                  </FieldCard>

                  <div className="rounded-[1.2rem] border border-[#eadfca] bg-[#fffaf1] p-4 text-sm leading-6 text-[#776349]">
                    Duração atual: 9 segundos. O vídeo não adiciona música, narração, legendas, logo, dados sobrepostos ou tela de encerramento.
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCurrentStep("selection")}
                      className="h-11 rounded-xl border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      onClick={goToReview}
                      className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                    >
                      Revisar vídeo
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "review" ? (
                <>
                  <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {summaryItems.map((item) => (
                      <div key={item.label} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{item.label}</p>
                        <p className="mt-2 text-sm font-semibold text-[#050505]">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1.2rem] border border-[#dbe8df] bg-[#f8fdf9] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                        <Sparkles className="size-4.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#050505]">
                          {requiresPreviewFlow ? "Primeiro será criada a prévia transformada" : "Créditos validados antes do envio final"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                          {requiresPreviewFlow
                            ? "A etapa inicial gera uma imagem transformada, valida a diferença em relação ao original e só depois libera a animação."
                            : "O Studio IA verifica o saldo antes de iniciar a geração e preserva o consumo caso o processamento falhe."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Resumo da apresentação</p>
                    <p className="mt-2 text-sm leading-7 text-[#5F6B7A]">{creativeBriefPreview}</p>
                  </div>

                  <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Política de custo desta execução</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {requiresPreviewFlow
                        ? `A prévia mobiliada debita ${estimatedStageCredits} créditos nesta etapa. A animação final será cobrada somente depois da aprovação da imagem.`
                        : `O vídeo será criado em uma única etapa com ${estimatedStageCredits} créditos estimados.`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCurrentStep("configuration")}
                      className="h-11 rounded-xl border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      Ajustar briefing
                    </Button>
                    <Button
                      type="button"
                      onClick={startGeneration}
                      disabled={isSubmitting}
                      className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                    >
                      {requiresPreviewFlow ? "Criar prévia mobiliada" : "Gerar vídeo"}
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "processing" ? (
                <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-6">
                  <EmeLoading
                    message={
                      generatedResult?.activeStage === "preview"
                        ? "Gerando ambiente transformado para aprovação..."
                        : "Animando a imagem principal e acompanhando o vídeo..."
                    }
                    compact={false}
                  />
                  <div className="mt-4 rounded-[1rem] border border-black/[0.06] bg-white p-4">
                    <p className="text-sm font-semibold text-[#050505]">Status da criação</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {generatedResult?.activeStage === "preview"
                        ? "A imagem de prévia está sendo criada com base na referência original."
                        : "A imagem principal está sendo transformada em vídeo."}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {generatedResult?.activeStage === "preview"
                        ? "Etapa atual: Gerando ambiente mobiliado."
                        : "Etapa atual: Criando o vídeo final."}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[#009b3a]">
                      Progresso: {generatedResult?.progress ?? 0}%
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStep === "preview" && generatedResult ? (
                <>
                  <div className="rounded-[1.2rem] border border-[#dbe8df] bg-[#f8fdf9] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                        <ImagePlus className="size-4.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#050505]">
                          {generatedResult.previewApproved ? "Prévia aprovada para animação" : "Prévia transformada pronta para revisão"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                          Compare a imagem original com a prévia final. O vídeo só será criado depois da aprovação.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <PreviewImageCard title="Imagem original" imageUrl={sourcePreviewUrl} emptyMessage="Nenhuma imagem original disponível nesta sessão." />
                    <PreviewImageCard title="Prévia mobiliada" imageUrl={generatedResult.previewImageUrl} emptyMessage="A prévia ainda não foi gerada." />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <StatusTile
                      title="Qualidade da previa"
                      value={generatedResult.previewQualityScore != null ? `${Math.round(generatedResult.previewQualityScore * 100)}% de diferença` : "Aguardando análise"}
                      description="O backend compara a imagem original e a prévia para evitar vídeos caros quando a transformação não ficou visível."
                    />
                    <StatusTile
                      title="Crédito da próxima etapa"
                      value={`${generatedResult.previewApproved ? getStudioVideoEstimatedCredits({
                        duration,
                        objective,
                        transformation,
                        stage: "video",
                        model: generatedResult.providerModel || "ray-2",
                      }) : getStudioVideoEstimatedCredits({
                        duration,
                        objective,
                        transformation,
                        stage: "preview_regeneration",
                      })}`}
                      description={generatedResult.previewApproved ? "Animação final validada somente após sua aprovação." : "Regenerar a imagem custa apenas a etapa de prévia."}
                    />
                  </div>

                  {generatedResult.previewPrompt ? (
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-sm font-semibold text-[#050505]">Prompt da previa</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#5F6B7A]">{generatedResult.previewPrompt}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCurrentStep("configuration")}
                      className="h-11 rounded-xl border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      Ajustar briefing
                    </Button>
                    {!generatedResult.previewApproved ? (
                      <Button
                        type="button"
                        onClick={approvePreview}
                        disabled={isApprovingPreview || !generatedResult.previewImageUrl}
                        className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                      >
                        {isApprovingPreview ? "Aprovando..." : "Aprovar previa"}
                      </Button>
                    ) : null}
                    {generationError && !generatedResult.previewImageUrl ? (
                      <Button
                        type="button"
                        onClick={retryStatusCheck}
                        disabled={isSubmitting}
                        className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                      >
                        <RefreshCcw className="size-4" />
                        Tentar novamente
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={regeneratePreview}
                      disabled={isSubmitting}
                      className="h-11 rounded-xl border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      <RefreshCcw className="size-4" />
                      Gerar novamente
                    </Button>
                    <Button
                      type="button"
                      onClick={createTransformationVideo}
                      disabled={isSubmitting || !generatedResult.previewApproved}
                      className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                    >
                      Animar transformação
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "result" && generatedResult ? (
                <>
                  <div className="rounded-[1.2rem] border border-[#dbe8df] bg-[#f8fdf9] p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                        <Clapperboard className="size-4.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#050505]">Vídeo concluído</p>
                        <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                          Request ID: {generatedResult.requestId}. Status final: {generatedResult.generationStatus}. Duração: {getStudioVideoDurationLabel(generatedResult.duration)}.
                        </p>
                      </div>
                    </div>
                  </div>

                  {(sourcePreviewUrl || generatedResult.previewImageUrl) ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <PreviewImageCard title="Frame inicial" imageUrl={sourcePreviewUrl} emptyMessage="Sem frame inicial disponível." />
                      <PreviewImageCard title="Frame final aprovado" imageUrl={generatedResult.previewImageUrl} emptyMessage="Sem frame final aprovado." />
                    </div>
                  ) : null}

                  {generatedResult.videoUrl ? (
                    <div className="overflow-hidden rounded-[1.2rem] border border-black/[0.06] bg-black">
                      <video src={generatedResult.videoUrl} controls className="h-full max-h-[540px] w-full object-contain" />
                    </div>
                  ) : null}

                  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                    <ResultListCard title="Storyboard" items={generatedResult.storyboard} />
                    <ResultListCard title="Plano de cenas" items={generatedResult.shotPlan} />
                  </div>

                  <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Script de direção</p>
                    <p className="mt-2 text-sm leading-7 text-[#5F6B7A]">{generatedResult.script}</p>
                  </div>

                  <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Prompt final enviado</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#5F6B7A]">{generatedResult.promptPreview}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {generatedResult.videoUrl ? (
                      <Button asChild type="button" className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]">
                        <a href={generatedResult.videoUrl} download>
                          <Download className="size-4" />
                          Baixar vídeo
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isSavingResult || generatedResult.fileSaved}
                      onClick={saveToMyFiles}
                      className="h-11 rounded-xl border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      <Save className="size-4" />
                      {generatedResult.fileSaved ? "Salvo em Meus arquivos" : isSavingResult ? "Salvando..." : "Salvar em Meus arquivos"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={restartFlow}
                      className="h-11 rounded-xl border border-black/[0.06] bg-white px-5 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                    >
                      <RefreshCcw className="size-4" />
                      Reiniciar fluxo
                    </Button>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="px-5 py-5">
                <CardTitle className="text-xl text-[#050505]">Resumo rápido</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0">
                {summaryItems.map((item) => (
                  <div key={item.label} className="rounded-[1rem] border border-black/[0.06] bg-[#fbfbf8] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{item.label}</p>
                    <p className="mt-2 text-sm font-semibold text-[#050505]">{item.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="min-w-0 overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="px-5 py-5">
                <CardTitle className="text-xl text-[#050505]">Estado do fluxo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0">
                <StatusTile
                  title="Disponibilidade"
                  description="Seleção de material, personalização, revisão e opção de salvar o resultado."
                  value="Ativo"
                />
                <StatusTile
                  title="Geração"
                  description="Acompanhamento do processamento até a conclusão do vídeo."
                  value={generatedResult ? generatedResult.jobStage : "Aguardando envio"}
                />
                <StatusTile
                  title="Créditos IA"
                  description="Consumo separado por etapa, validado antes da chamada e protegido com estorno em caso de falha."
                  value={`${generatedResult?.totalCreditsConsumed ?? 0} consumidos / ${totalEstimatedCredits} previstos`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={restartFlow}
                  className="h-10 rounded-xl border border-black/[0.06] bg-white px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  Reiniciar fluxo
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </BrokerPageShell>
  )
}

function FieldCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="mb-3 text-sm font-semibold text-[#050505]">{label}</p>
      {children}
    </div>
  )
}

function ResultListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-sm font-semibold text-[#050505]">{title}</p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="rounded-[1rem] border border-black/[0.06] bg-white px-3 py-3 text-sm leading-6 text-[#5F6B7A]">
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceButtons({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: readonly string[]
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "sm:justify-end" : ""}`}>
      {options.map((option) => (
        <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${value === option ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#08752f]" : "border-black/[0.06] bg-white text-[#4B5563] hover:border-black/[0.12]"}`}>
          {option}
        </button>
      ))}
    </div>
  )
}

function StatusTile({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{title}</p>
      <p className="mt-2 text-sm font-semibold text-[#050505]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  )
}

function PreviewImageCard({
  title,
  imageUrl,
  emptyMessage,
}: {
  title: string
  imageUrl?: string
  emptyMessage: string
}) {
  return (
    <div className="overflow-hidden rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
        <p className="text-sm font-semibold text-[#050505]">{title}</p>
      </div>
      {imageUrl ? (
        <div className="aspect-[4/3] w-full bg-[#eef2f6]" style={{ backgroundImage: `url(${imageUrl})`, backgroundPosition: "center", backgroundSize: "cover" }} />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm leading-6 text-[#6B7280]">
          {emptyMessage}
        </div>
      )}
    </div>
  )
}

function videoStepOrder(step: StudioVideoStep) {
  return stepLabels.findIndex((item) => item.id === step)
}

// Mensagens técnicas cruas (ex.: "Not Found" de uma falha de rede) não ajudam o
// corretor a entender o que fazer. Falhas com uma explicação útil continuam sendo mostradas.
function formatStudioVideoPollingError(caughtError: unknown) {
  const message = caughtError instanceof Error ? caughtError.message : ""
  const isGenericTechnicalMessage = !message || /^(not found|erro \d+|internal server error)$/i.test(message.trim())

  if (isGenericTechnicalMessage) {
    return "Não conseguimos confirmar o status desta etapa agora. Tente novamente em instantes — seu briefing e a prévia já geradas não foram perdidos."
  }

  return message
}
