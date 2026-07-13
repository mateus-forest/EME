"use client"

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clapperboard,
  MessageCircle,
  RefreshCcw,
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
  studioVideoDurations,
  studioVideoEstimatedCredits,
  studioVideoFormats,
  studioVideoObjectives,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  studioVideoStyles,
} from "@/lib/studio-ia-video"

type StudioVideoStep = "selection" | "configuration" | "review" | "processing" | "result"
type StudioVideoFormat = (typeof studioVideoFormats)[number]
type StudioVideoDuration = (typeof studioVideoDurations)[number]
type StudioVideoObjective = (typeof studioVideoObjectives)[number]
type StudioVideoStyle = (typeof studioVideoStyles)[number]
type GeneratedVideoResult = z.infer<typeof studioVideoResultSchema>

type UploadPreview = {
  name: string
  size: number
  type: string
  url: string
}

const stepLabels: Array<{ id: StudioVideoStep; label: string }> = [
  { id: "selection", label: "Selecao" },
  { id: "configuration", label: "Configuracao" },
  { id: "review", label: "Resumo" },
  { id: "processing", label: "Geracao" },
  { id: "result", label: "Resultado" },
]

export function BrokerStudioIaVideoPage() {
  const { properties, isLoading } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<string[]>([])
  const [uploadedImages, setUploadedImages] = useState<UploadPreview[]>([])
  const [format, setFormat] = useState<StudioVideoFormat>(studioVideoFormats[0])
  const [duration, setDuration] = useState<StudioVideoDuration>(studioVideoDurations[1])
  const [objective, setObjective] = useState<StudioVideoObjective>(studioVideoObjectives[0])
  const [style, setStyle] = useState<StudioVideoStyle>(studioVideoStyles[0])
  const [additionalInstructions, setAdditionalInstructions] = useState("")
  const [currentStep, setCurrentStep] = useState<StudioVideoStep>("selection")
  const [resultVersion, setResultVersion] = useState(0)
  const [generationError, setGenerationError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedResult, setGeneratedResult] = useState<GeneratedVideoResult | null>(null)
  const uploadedImagesRef = useRef<UploadPreview[]>([])

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )

  const canAdvanceToConfiguration = Boolean(
    (selectedProperty && selectedReferenceImages.length > 0) || uploadedImages.length > 0,
  )

  const estimatedCredits = generatedResult?.estimatedCredits ?? studioVideoEstimatedCredits

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages
  }, [uploadedImages])

  useEffect(() => {
    return () => {
      uploadedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.url))
    }
  }, [])

  function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId)
    const property = properties.find((item) => item.id === propertyId) ?? null
    setSelectedReferenceImages(property?.images[0] ? [property.images[0]] : [])
    setGenerationError("")
    setGeneratedResult(null)
    setResultVersion(0)
    setCurrentStep("selection")
  }

  function handleToggleReferenceImage(imageUrl: string) {
    setSelectedReferenceImages((current) => (
      current.includes(imageUrl)
        ? current.filter((image) => image !== imageUrl)
        : [...current, imageUrl].slice(0, 8)
    ))
    setGenerationError("")
    setGeneratedResult(null)
    setResultVersion(0)
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
      }))

      return [...current, ...nextEntries]
    })

    setGenerationError("")
    setGeneratedResult(null)
    setResultVersion(0)
    event.target.value = ""
  }

  function removeUploadedImage(imageUrl: string) {
    setUploadedImages((current) => {
      const image = current.find((item) => item.url === imageUrl)
      if (image) {
        URL.revokeObjectURL(image.url)
      }

      return current.filter((item) => item.url !== imageUrl)
    })
    setGenerationError("")
    setGeneratedResult(null)
    setResultVersion(0)
  }

  function goToConfiguration() {
    if (!canAdvanceToConfiguration) {
      setGenerationError("Selecione imagens do imovel ou envie referencias para continuar.")
      return
    }

    setGenerationError("")
    setCurrentStep("configuration")
  }

  function goToReview() {
    try {
      studioVideoRequestSchema.parse({
        propertyId: selectedProperty?.id,
        referenceImageUrls: selectedReferenceImages,
        uploadedImages: uploadedImages.map((image) => ({
          name: image.name,
          type: image.type,
          size: image.size,
        })),
        format,
        duration,
        objective,
        style,
        additionalInstructions,
        version: resultVersion + 1,
      })

      setGenerationError("")
      setCurrentStep("review")
    } catch (caughtError) {
      const issue = caughtError instanceof z.ZodError ? caughtError.issues[0]?.message : null
      setGenerationError(issue || "Revise os campos antes de continuar.")
    }
  }

  async function startGeneration() {
    try {
      const payload = studioVideoRequestSchema.parse({
        propertyId: selectedProperty?.id,
        referenceImageUrls: selectedReferenceImages,
        uploadedImages: uploadedImages.map((image) => ({
          name: image.name,
          type: image.type,
          size: image.size,
        })),
        format,
        duration,
        objective,
        style,
        additionalInstructions,
        version: resultVersion + 1,
      })

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
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => null)) as
        | (GeneratedVideoResult & { error?: string })
        | { error?: string; estimatedCredits?: number }
        | null

      if (!response.ok || !data) {
        throw new Error(data?.error || "Nao foi possivel preparar a geracao do video.")
      }

      const parsed = studioVideoResultSchema.parse(data)
      setGeneratedResult(parsed)
      setResultVersion(payload.version)
      setCurrentStep("result")
    } catch (caughtError) {
      setGenerationError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel preparar a geracao do video.")
      setCurrentStep("review")
    } finally {
      setIsSubmitting(false)
    }
  }

  function restartFlow() {
    uploadedImages.forEach((image) => URL.revokeObjectURL(image.url))
    setSelectedPropertyId("")
    setSelectedReferenceImages([])
    setUploadedImages([])
    setFormat(studioVideoFormats[0])
    setDuration(studioVideoDurations[1])
    setObjective(studioVideoObjectives[0])
    setStyle(studioVideoStyles[0])
    setAdditionalInstructions("")
    setCurrentStep("selection")
    setResultVersion(0)
    setGenerationError("")
    setGeneratedResult(null)
    setIsSubmitting(false)
  }

  const summaryItems = useMemo(
    () => [
      { label: "Imovel", value: selectedProperty?.title ?? "Nao selecionado" },
      { label: "Formato", value: format },
      { label: "Duracao", value: duration },
      { label: "Objetivo", value: objective },
      { label: "Estilo", value: style },
      { label: "Referencias", value: `${selectedReferenceImages.length + uploadedImages.length} imagem(ns)` },
      { label: "Creditos IA", value: `${estimatedCredits} estimados` },
    ],
    [duration, estimatedCredits, format, objective, selectedProperty, selectedReferenceImages.length, style, uploadedImages.length],
  )

  if (isLoading) {
    return (
      <BrokerPageShell title="Studio IA">
        <EmeLoading message="Carregando fluxo de video do Studio IA..." />
      </BrokerPageShell>
    )
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#009b3a]/18 bg-[#eef9f1] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#009b3a]">
                <Video className="size-3.5" />
                Fluxo disponivel
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[#050505]">Criar video do imovel</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#5F6B7A]">
                Monte o briefing completo do video com referencias visuais, objetivo comercial, formato, duracao e instrucoes extras. A interface ja esta pronta para futura integracao do provedor e consumo de creditos IA.
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
                <Link href="/corretor/corretor-m">
                  <MessageCircle className="size-4" />
                  Abrir Assessor EME atual
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-2 md:grid-cols-5">
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
                <p className="font-semibold">Nao foi possivel avancar no fluxo.</p>
                <p className="mt-1 leading-6">{generationError}</p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_24rem]">
          <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5">
              <CardTitle className="text-xl text-[#050505]">
                {currentStep === "selection" && "1. Escolha o imovel ou envie imagens"}
                {currentStep === "configuration" && "2. Defina o briefing do video"}
                {currentStep === "review" && "3. Revise antes da geracao"}
                {currentStep === "processing" && "4. Preparando a geracao"}
                {currentStep === "result" && "5. Estrutura retornada pelo provedor"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-5 pt-0">
              {currentStep === "selection" ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Selecionar imovel</p>
                      <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                        Escolha um imovel existente para reaproveitar imagens e contexto comercial.
                      </p>

                      <div className="mt-4 grid gap-3">
                        <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Escolha um imovel" />
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
                        Envie fotos de referencia sem alterar banco ou storage. Elas ficam apenas neste briefing.
                      </p>

                      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[1rem] border border-dashed border-black/[0.08] bg-white px-4 py-8 text-center transition-colors hover:border-[#009b3a]/25 hover:bg-[#f8fdf9]">
                        <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                          <Upload className="size-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-[#050505]">Adicionar imagens de apoio</p>
                          <p className="mt-1 text-sm leading-6 text-[#6B7280]">JPG ou PNG, ate 8 imagens, usadas somente no fluxo atual.</p>
                        </div>
                        <Input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleUploadedImages} />
                      </label>
                    </div>
                  </div>

                  {selectedProperty?.images.length ? (
                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Imagens do imovel</p>
                          <p className="mt-2 text-sm leading-6 text-[#6B7280]">Selecione as referencias que devem orientar o video.</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#4B5563]">
                          {selectedReferenceImages.length} selecionada(s)
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Uploads desta sessao</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={goToConfiguration}
                      className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white hover:bg-[#008633]"
                    >
                      Continuar briefing
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "configuration" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldCard label="Formato do video">
                      <Select value={format} onValueChange={(value) => setFormat(value as StudioVideoFormat)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {studioVideoFormats.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldCard>

                    <FieldCard label="Duracao">
                      <Select value={duration} onValueChange={(value) => setDuration(value as StudioVideoDuration)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {studioVideoDurations.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldCard>

                    <FieldCard label="Objetivo">
                      <Select value={objective} onValueChange={(value) => setObjective(value as StudioVideoObjective)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {studioVideoObjectives.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldCard>

                    <FieldCard label="Estilo">
                      <Select value={style} onValueChange={(value) => setStyle(value as StudioVideoStyle)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {studioVideoStyles.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldCard>
                  </div>

                  <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Instrucoes adicionais</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      Indique ritmo, destaques, tom comercial ou observacoes que o provedor futuro deve respeitar.
                    </p>
                    <Textarea
                      value={additionalInstructions}
                      onChange={(event) => setAdditionalInstructions(event.target.value)}
                      maxLength={600}
                      placeholder="Ex.: priorizar varanda, usar tom sofisticado, destacar vista e condominio, abrir com fachada e fechar com CTA para visita."
                      className="mt-4 min-h-32"
                    />
                    <p className="mt-2 text-right text-xs text-[#98A2B3]">{additionalInstructions.length}/600</p>
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
                      Revisar antes de gerar
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "review" ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        <p className="font-semibold text-[#050505]">Estrutura pronta para creditos IA</p>
                        <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                          Este fluxo ja envia a estimativa de consumo para a camada de geracao. Quando o provedor definitivo for conectado, o mesmo contrato podera reservar e consumir creditos sem alterar a interface.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                    <p className="text-sm font-semibold text-[#050505]">Observacoes finais</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      {additionalInstructions.trim().length > 0 ? additionalInstructions : "Nenhuma instrucao adicional informada."}
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
                      Iniciar geracao
                    </Button>
                  </div>
                </>
              ) : null}

              {currentStep === "processing" ? (
                <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-6">
                  <EmeLoading message="Preparando o pedido de video do Studio IA..." compact={false} />
                  <div className="mt-4 rounded-[1rem] border border-black/[0.06] bg-white p-4">
                    <p className="text-sm font-semibold text-[#050505]">Briefing em processamento</p>
                    <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                      Validando referencias, configuracao do provedor e estrutura de creditos antes da geracao final.
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStep === "result" ? (
                generatedResult ? (
                  <>
                    <div className="rounded-[1.2rem] border border-[#dbe8df] bg-[#f8fdf9] p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]">
                          <Clapperboard className="size-4.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#050505]">Pedido aceito pelo provedor</p>
                          <p className="mt-2 text-sm leading-6 text-[#5F6B7A]">
                            Status atual: {generatedResult.generationStatus}. Request ID: {generatedResult.requestId}.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <ResultListCard title="Storyboard" items={generatedResult.storyboard} />
                      <ResultListCard title="Plano de cenas" items={generatedResult.shotPlan} />
                    </div>

                    <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                      <p className="text-sm font-semibold text-[#050505]">Script inicial</p>
                      <p className="mt-2 text-sm leading-7 text-[#5F6B7A]">{generatedResult.script}</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
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
                ) : null
              ) : null}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="px-5 py-5">
                <CardTitle className="text-xl text-[#050505]">Resumo rapido</CardTitle>
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

            <Card className="overflow-hidden rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
              <CardHeader className="px-5 py-5">
                <CardTitle className="text-xl text-[#050505]">Estado do fluxo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 pt-0">
                <StatusTile
                  title="Disponibilidade"
                  description="Fluxo liberado para briefing completo, validacao e chamada futura do provedor."
                  value="Ativo"
                />
                <StatusTile
                  title="Geracao"
                  description="Endpoint exclusivo criado e pronto para integrar o provedor definitivo."
                  value={generatedResult ? generatedResult.generationStatus : "Aguardando envio"}
                />
                <StatusTile
                  title="Creditos IA"
                  description="Estrutura preparada para reserva e consumo posterior sem mexer na experiencia."
                  value={`${estimatedCredits} estimados`}
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

function StatusTile({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[1.15rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">{title}</p>
      <p className="mt-2 text-sm font-semibold text-[#050505]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
    </div>
  )
}

function videoStepOrder(step: StudioVideoStep) {
  return stepLabels.findIndex((item) => item.id === step)
}
