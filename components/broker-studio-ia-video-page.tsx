"use client"

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
  requiresTransformationPreview,
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
type StudioVideoMovement = "Automático" | "Aproximar" | "Afastar" | "Estático" | "Transição"
type StudioVideoMusic = "Automática" | "Cinematográfica" | "Chill" | "Upbeat" | "Acústica" | "Eletrônica"
type StudioVideoNarration = "Sem narração" | "Narração IA"

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

const formatOptions: Array<{ label: string; value: StudioVideoFormat }> = [
  { label: "Vertical 9:16", value: "Reel vertical 9:16" },
  { label: "Horizontal 16:9", value: "Paisagem 16:9" },
]

const movementOptions: StudioVideoMovement[] = ["Automático", "Aproximar", "Afastar", "Estático", "Transição"]
const movementToCurrentCamera: Record<StudioVideoMovement, StudioVideoCameraMovement> = {
  "Automático": "Gimbal",
  "Aproximar": "Dolly",
  "Afastar": "Travelling",
  "Estático": "Estatico elegante",
  "Transição": "Slow Motion",
}
const propertyInformationOptions = ["Preço", "Localização", "Dormitórios", "Banheiros", "Área", "Vagas"] as const
const musicOptions: StudioVideoMusic[] = ["Automática", "Cinematográfica", "Chill", "Upbeat", "Acústica", "Eletrônica"]
const narrationOptions: StudioVideoNarration[] = ["Sem narração", "Narração IA"]

export function BrokerStudioIaVideoPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<UploadPreview[]>([])
  const [timelineOrder, setTimelineOrder] = useState<string[]>([])
  const [format, setFormat] = useState<StudioVideoFormat>(studioVideoFormats[0])
  const [duration, setDuration] = useState<StudioVideoDuration>(studioVideoDefaultDuration)
  const [objective, setObjective] = useState<StudioVideoObjective>(studioVideoObjectives[0])
  const [style, setStyle] = useState<StudioVideoStyle>(studioVideoStyles[0])
  const [transformation, setTransformation] = useState<StudioVideoTransformation>(studioVideoTransformationOptions[0])
  const [rhythm, setRhythm] = useState<StudioVideoRhythm>(studioVideoRhythmOptions[1])
  const [cameraMovement, setCameraMovement] = useState<StudioVideoCameraMovement>(studioVideoCameraMovementOptions[3])
  const [movement, setMovement] = useState<StudioVideoMovement>("Automático")
  const [propertyInformation, setPropertyInformation] = useState<string[]>(["Preço", "Localização", "Dormitórios", "Banheiros", "Área", "Vagas"])
  const [music, setMusic] = useState<StudioVideoMusic>("Automática")
  const [narration, setNarration] = useState<StudioVideoNarration>("Sem narração")
  const [scriptMode, setScriptMode] = useState<"Automático" | "Personalizado">("Automático")
  const [captions, setCaptions] = useState(false)
  const [identityItems, setIdentityItems] = useState<string[]>([])
  const [endingTitle, setEndingTitle] = useState("")
  const [endingSubtitle, setEndingSubtitle] = useState("")
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  const [currentStep, setCurrentStep] = useState<StudioVideoStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [generationError, setGenerationError] = useState("")
  const [durationNotice, setDurationNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingResult, setIsSavingResult] = useState(false)
  const [isApprovingPreview, setIsApprovingPreview] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<GeneratedVideoResult | null>(null)
  const uploadedImagesRef = useRef<UploadPreview[]>([])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )

  const materialTimeline = useMemo(() => {
    const items = [
      ...selectedReferenceImages.map((url) => ({ id: `property:${url}`, url, label: "Foto do imóvel" })),
      ...uploadedImages.map((image) => ({ id: `upload:${image.url}`, url: image.url, label: image.name })),
    ]
    const byId = new Map(items.map((item) => [item.id, item]))
    return [
      ...timelineOrder.map((id) => byId.get(id)).filter((item): item is (typeof items)[number] => Boolean(item)),
      ...items.filter((item) => !timelineOrder.includes(item.id)),
    ]
  }, [selectedReferenceImages, timelineOrder, uploadedImages])

  const canAdvanceToConfiguration = Boolean(
    (selectedProperty && selectedReferenceImages.length > 0) || uploadedImages.length > 0,
  )

  const requiresPreviewFlow = requiresTransformationPreview(transformation)

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

  const sourcePreviewUrl = materialTimeline[0]?.url || selectedProperty?.images[0] || ""

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages
  }, [uploadedImages])

  useEffect(() => {
    return () => {
      uploadedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url))
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
    setSelectedReferenceImages(property?.images[0] ? [property.images[0]] : [])
    setTimelineOrder((current) => [
      ...(property?.images[0] ? [`property:${property.images[0]}`] : []),
      ...current.filter((id) => id.startsWith("upload:")),
    ])
    resetGeneratedState()
    setCurrentStep("selection")
  }

  function handleToggleReferenceImage(imageUrl: string) {
    const timelineId = `property:${imageUrl}`
    setSelectedReferenceImages((current) => {
      if (current.includes(imageUrl)) {
        setTimelineOrder((order) => order.filter((id) => id !== timelineId))
        return current.filter((image) => image !== imageUrl)
      }
      if (current.length >= 8) return current
      setTimelineOrder((order) => [...order.filter((id) => id !== timelineId), timelineId])
      return [...current, imageUrl]
    })
    resetGeneratedState()
  }

  function handleUploadedImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setUploadedImages((current) => {
      const nextEntries = files.slice(0, Math.max(0, 8 - current.length)).map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "image/jpeg",
        url: URL.createObjectURL(file),
        file,
      }))

      setTimelineOrder((order) => [...order, ...nextEntries.map((image) => `upload:${image.url}`)])
      return [...current, ...nextEntries]
    })

    resetGeneratedState()
    event.target.value = ""
  }

  function removeUploadedImage(imageUrl: string) {
    setUploadedImages((current) => {
      const image = current.find((item) => item.url === imageUrl)
      if (image) URL.revokeObjectURL(image.url)
      return current.filter((item) => item.url !== imageUrl)
    })
    setTimelineOrder((current) => current.filter((id) => id !== `upload:${imageUrl}`))
    resetGeneratedState()
  }

  function moveTimelineItem(itemId: string, direction: -1 | 1) {
    const normalizedOrder = materialTimeline.map((item) => item.id)
    const currentIndex = normalizedOrder.indexOf(itemId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= normalizedOrder.length) return
    const nextOrder = [...normalizedOrder]
    ;[nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]]
    setTimelineOrder(nextOrder)
    resetGeneratedState()
  }

  function removeTimelineItem(itemId: string) {
    if (itemId.startsWith("property:")) {
      setSelectedReferenceImages((current) => current.filter((url) => `property:${url}` !== itemId))
      setTimelineOrder((current) => current.filter((id) => id !== itemId))
      resetGeneratedState()
      return
    }
    const uploadedImage = uploadedImages.find((image) => `upload:${image.url}` === itemId)
    if (uploadedImage) removeUploadedImage(uploadedImage.url)
  }

  function buildPayload() {
    const orderedReferenceImages = materialTimeline.filter((item) => item.id.startsWith("property:")).map((item) => item.url)
    const orderedUploadedImages = materialTimeline
      .filter((item) => item.id.startsWith("upload:"))
      .map((item) => uploadedImages.find((image) => image.url === item.url))
      .filter((image): image is UploadPreview => Boolean(image))

    return studioVideoRequestSchema.parse({
      propertyId: selectedProperty?.id,
      referenceImageUrls: orderedReferenceImages,
      uploadedImages: orderedUploadedImages.map((image) => ({
        name: image.name,
        type: image.type,
        size: image.size,
      })),
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
      setGenerationError("Selecione imagens do imóvel ou envie referências para continuar.")
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
      materialTimeline
        .filter((item) => item.id.startsWith("upload:"))
        .map((item) => uploadedImages.find((image) => image.url === item.url))
        .filter((image): image is UploadPreview => Boolean(image))
        .forEach((image) => formData.append("images", image.file))

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
    uploadedImages.forEach((image) => URL.revokeObjectURL(image.url))
    setSelectedPropertyId("")
    setSelectedReferenceImages([])
    setUploadedImages([])
    setTimelineOrder([])
    setFormat(studioVideoFormats[0])
    setDuration(studioVideoDefaultDuration)
    setObjective(studioVideoObjectives[0])
    setStyle(studioVideoStyles[0])
    setTransformation(studioVideoTransformationOptions[0])
    setRhythm(studioVideoRhythmOptions[1])
    setCameraMovement(studioVideoCameraMovementOptions[3])
    setMovement("Automático")
    setPropertyInformation(["Preço", "Localização", "Dormitórios", "Banheiros", "Área", "Vagas"])
    setMusic("Automática")
    setNarration("Sem narração")
    setScriptMode("Automático")
    setCaptions(false)
    setIdentityItems([])
    setEndingTitle("")
    setEndingSubtitle("")
    setAdditionalInstructions("")
    setCurrentStep("selection")
    resetGeneratedState()
  }

  const summaryItems = useMemo(
    () => [
      { label: "Imóvel", value: selectedProperty?.title ?? "Não selecionado" },
      { label: "Material", value: `${materialTimeline.length} imagem(ns)` },
      { label: "Formato", value: formatOptions.find((item) => item.value === format)?.label ?? format },
      { label: "Movimento", value: movement },
      { label: "Informações", value: propertyInformation.length ? propertyInformation.join(", ") : "Sem informações" },
      { label: "Áudio", value: `${music} · ${narration}` },
      { label: "Créditos previstos", value: `${totalEstimatedCredits}` },
    ],
    [
      format,
      materialTimeline.length,
      movement,
      music,
      narration,
      propertyInformation,
      selectedProperty?.title,
      totalEstimatedCredits,
    ],
  )

  const creativeBriefPreview = useMemo(
    () =>
      [
        `Formato: ${formatOptions.find((item) => item.value === format)?.label ?? format}.`,
        `Movimento: ${movement}.`,
        propertyInformation.length ? `Informações selecionadas: ${propertyInformation.join(", ")}.` : "",
        scriptMode === "Personalizado" && additionalInstructions.trim() ? `Roteiro e orientações: ${additionalInstructions.trim()}` : "Roteiro automático.",
      ]
        .filter(Boolean)
        .join(" "),
    [
      additionalInstructions,
      format,
      movement,
      propertyInformation,
      scriptMode,
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
                Combine fotos do imóvel, formato, movimento e informações comerciais em uma apresentação visual.
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
          {stepLabels.map((step, index) => {
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
                {currentStep === "configuration" && "B–G. Personalize o vídeo"}
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
                        Escolha um imóvel existente para reaproveitar imagens e contexto comercial.
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Enviar imagens</p>
                      <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                        Envie fotos do imóvel para gerar o fluxo mesmo sem selecionar um cadastro existente.
                      </p>

                      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1rem] border border-dashed border-black/[0.08] bg-white px-4 py-8 text-center transition-colors hover:border-[#009b3a]/25 hover:bg-[#f8fdf9]">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                          <Upload className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-[#050505]">Adicionar imagens de apoio</p>
                          <p className="mt-1 text-sm leading-6 text-[#6B7280]">JPG, PNG ou WEBP, até 8 imagens.</p>
                        </div>
                        <Input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleUploadedImages} />
                      </label>
                    </div>
                  </div>

                  {selectedProperty?.images.length ? (
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Imagens do imóvel</p>
                          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                            Selecione as fotografias que deseja usar no vídeo.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#4B5563]">
                          {selectedReferenceImages.length} selecionada(s)
                        </span>
                      </div>

                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {selectedProperty.images.map((imageUrl, index) => {
                          const selected = selectedReferenceImages.includes(imageUrl)

                          return (
                            <button
                              key={imageUrl}
                              type="button"
                              onClick={() => handleToggleReferenceImage(imageUrl)}
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

                  {uploadedImages.length ? (
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Uploads desta sessão</p>
                      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {uploadedImages.map((image, index) => (
                          <div key={image.url} className="overflow-hidden rounded-[1rem] border border-black/[0.06] bg-white">
                            <div className="h-36 w-full bg-[#eef2f6]" style={{ backgroundImage: `url(${image.url})`, backgroundPosition: "center", backgroundSize: "cover" }} />
                            <div className="grid gap-2 px-3 py-3">
                              <div>
                                <p className="text-sm font-medium text-[#050505]">Upload {index + 1}</p>
                                <p className="mt-1 truncate text-xs text-[#6B7280]">{image.name}</p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => removeUploadedImage(image.url)}
                                className="h-9 rounded-xl border border-black/[0.06] bg-white px-3 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {materialTimeline.length ? (
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Seleção e ordem</p>
                          <p className="mt-2 text-sm leading-6 text-[#6B7280]">Revise, remova ou reorganize as imagens da apresentação.</p>
                        </div>
                        <span className="text-xs font-medium text-[#8B95A1]">{materialTimeline.length} imagem(ns)</span>
                      </div>
                      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                        {materialTimeline.map((item, index) => (
                          <div key={item.id} className="w-36 shrink-0 overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
                            <div className="relative aspect-[4/3] bg-[#eef2f6] bg-cover bg-center" style={{ backgroundImage: `url(${item.url})` }}>
                              <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/70 text-[11px] font-semibold text-white">{index + 1}</span>
                            </div>
                            <p className="truncate px-3 pt-2 text-xs font-medium text-[#4B5563]">{item.label}</p>
                            <div className="grid grid-cols-3 gap-1 p-2">
                              <button type="button" aria-label="Mover imagem para a esquerda" disabled={index === 0} onClick={() => moveTimelineItem(item.id, -1)} className="flex h-8 items-center justify-center rounded-lg border border-black/[0.06] text-[#4B5563] disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
                              <button type="button" aria-label="Mover imagem para a direita" disabled={index === materialTimeline.length - 1} onClick={() => moveTimelineItem(item.id, 1)} className="flex h-8 items-center justify-center rounded-lg border border-black/[0.06] text-[#4B5563] disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
                              <button type="button" aria-label="Remover imagem" onClick={() => removeTimelineItem(item.id)} className="h-8 rounded-lg border border-black/[0.06] text-[11px] font-medium text-[#7A4A4A]">×</button>
                            </div>
                          </div>
                        ))}
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
                    <p className="text-sm font-semibold text-[#050505]">Personalização comercial</p>
                    <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                      Escolha apenas o que deve aparecer na apresentação. As configurações técnicas permanecem fora da experiência.
                    </p>
                  </div>

                  <FieldCard label="B. Formato">
                    <ChoiceButtons options={formatOptions.map((item) => item.label)} value={formatOptions.find((item) => item.value === format)?.label ?? "Vertical 9:16"} onChange={(label) => setFormat(formatOptions.find((item) => item.label === label)?.value ?? formatOptions[0].value)} />
                  </FieldCard>

                  <FieldCard label="C. Informações do imóvel">
                    <p className="mb-3 text-sm leading-6 text-[#6B7280]">Selecione quais informações deverão compor a apresentação.</p>
                    <ToggleList options={[...propertyInformationOptions]} values={propertyInformation} onChange={setPropertyInformation} />
                    {selectedProperty ? <p className="mt-3 text-xs leading-5 text-[#8B95A1]">Imóvel selecionado: {selectedProperty.title}. O preenchimento automático completo fica preparado para a evolução deste fluxo.</p> : null}
                  </FieldCard>

                  <FieldCard label="D. Movimento">
                    <ChoiceButtons options={movementOptions} value={movement} onChange={(value) => { const nextMovement = value as StudioVideoMovement; setMovement(nextMovement); setCameraMovement(movementToCurrentCamera[nextMovement]) }} />
                  </FieldCard>

                  <FieldCard label="E. Áudio">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8B95A1]">Música</p>
                        <Select value={music} onValueChange={(value) => setMusic(value as StudioVideoMusic)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{musicOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8B95A1]">Narração</p>
                        <ChoiceButtons options={narrationOptions} value={narration} onChange={(value) => setNarration(value as StudioVideoNarration)} compact />
                      </div>
                    </div>
                    <div className="mt-4 border-t border-black/[0.06] pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#050505]">Roteiro</p>
                        <ChoiceButtons options={["Automático", "Personalizado"]} value={scriptMode} onChange={(value) => setScriptMode(value as "Automático" | "Personalizado")} compact />
                      </div>
                      {scriptMode === "Personalizado" ? (
                        <Textarea value={additionalInstructions} onChange={(event) => setAdditionalInstructions(event.target.value)} maxLength={600} placeholder="Escreva o roteiro ou indique a mensagem principal do vídeo." className="mt-4 min-h-28" />
                      ) : null}
                      <button type="button" onClick={() => setCaptions((current) => !current)} className={`mt-4 rounded-xl border px-3 py-2 text-sm font-medium ${captions ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#08752f]" : "border-black/[0.06] bg-white text-[#4B5563]"}`}>Legendas {captions ? "selecionadas" : "opcionais"}</button>
                    </div>
                  </FieldCard>

                  <FieldCard label="F. Identidade">
                    <ToggleList options={["Logo", "Foto do corretor", "Cor da marca"]} values={identityItems} onChange={setIdentityItems} />
                    <p className="mt-3 text-xs leading-5 text-[#8B95A1]">A identidade será vinculada ao perfil do corretor, sem dependência de contas externas.</p>
                  </FieldCard>

                  <FieldCard label="G. Encerramento">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={endingTitle} onChange={(event) => setEndingTitle(event.target.value)} placeholder="Título final" />
                      <Input value={endingSubtitle} onChange={(event) => setEndingSubtitle(event.target.value)} placeholder="Subtítulo ou CTA" />
                    </div>
                  </FieldCard>

                  <div className="rounded-[1.2rem] border border-[#eadfca] bg-[#fffaf1] p-4 text-sm leading-6 text-[#776349]">
                    Áudio, narração, legendas, identidade e encerramento estão estruturados para a próxima etapa do produto e ainda não alteram a geração atual. Material, formato, movimento e roteiro personalizado continuam usando o fluxo existente.
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
                        : "Animando a transformação e acompanhando o vídeo..."
                    }
                    compact={false}
                  />
                  <div className="mt-4 rounded-[1rem] border border-black/[0.06] bg-white p-4">
                    <p className="text-sm font-semibold text-[#050505]">Status da criação</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {generatedResult?.activeStage === "preview"
                        ? "A imagem de prévia está sendo criada com base na referência original."
                        : "As imagens selecionadas estão sendo transformadas em vídeo."}
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

function ToggleList({ options, values, onChange }: { options: readonly string[]; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = values.includes(option)
        return (
          <button key={option} type="button" onClick={() => onChange(selected ? values.filter((value) => value !== option) : [...values, option])} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${selected ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#08752f]" : "border-black/[0.06] bg-white text-[#4B5563] hover:border-black/[0.12]"}`}>
            {option}
          </button>
        )
      })}
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
