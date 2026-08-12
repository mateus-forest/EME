"use client"

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Check, ImagePlus, Library, LoaderCircle, Megaphone, Sparkles, Upload, Video } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { StudioObjectMaskEditor, type ObjectMaskValue } from "@/components/studio-object-mask-editor"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"
import { getStudioCapabilityProviders, STUDIO_PROVIDER_LABELS, type StudioCapabilityId } from "@/lib/studio-provider-catalog"
import type { StudioProviderId } from "@/lib/studio-providers/types"
import {
  getPropertyPreparationOperation,
  propertyPreparationBlurTargets,
  propertyPreparationCreativityLevels,
  propertyPreparationOperations,
  propertyPreparationRoomTypes,
  propertyPreparationSkyStyles,
  propertyPreparationStyles,
  type PropertyPreparationOperation,
} from "@/lib/studio-property-preparation"
import { cn } from "@/lib/utils"

type SourceMode = "property" | "upload"
type PreparationProvider = Extract<StudioProviderId, "pedra" | "openai" | "xai">

const providerDescriptions: Record<PreparationProvider, string> = {
  pedra: "Especializada em fotografia e transformação imobiliária.",
  openai: "Boa compreensão da instrução e edição generativa.",
  xai: "Edição generativa e interpretação visual criativa.",
}

function operationCapability(operation: PropertyPreparationOperation): StudioCapabilityId {
  return `property_preparation.${operation === "enhance_and_correct_perspective" ? "perspective" : operation}` as StudioCapabilityId
}

type UploadedImage = {
  file: File
  name: string
  url: string
}

type GenerationResponse = {
  campaign?: StudioCampaignRecord
  jobId?: string
  status?: string
  error?: string
  code?: string
}

async function readResponse(response: Response) {
  return await response.json().catch(() => null) as GenerationResponse | null
}

async function waitForGeneration(jobId: string) {
  const deadline = Date.now() + 95_000
  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 1_500))
    const response = await fetch(`/api/studio-ia/prepare-property?jobId=${encodeURIComponent(jobId)}`, {
      credentials: "include",
      cache: "no-store",
    })
    const data = await readResponse(response)
    if (response.status === 202) continue
    if (response.ok && data?.campaign) return data.campaign
    const error = new Error(data?.error || "Não foi possível concluir a preparação.") as Error & { code?: string }
    error.code = data?.code
    throw error
  }
  throw new Error("A preparação ainda está em andamento. Consulte a Biblioteca em alguns instantes.")
}

async function parseGenerationResponse(response: Response) {
  const data = await readResponse(response)
  if (response.status === 202 && data?.jobId) return waitForGeneration(data.jobId)
  if (!response.ok || !data?.campaign) {
    const error = new Error(data?.error || "Não foi possível preparar a imagem.") as Error & { code?: string }
    error.code = data?.code
    throw error
  }
  return data.campaign
}

export function BrokerStudioIaPreparePropertyPage() {
  const { properties } = useBrokerProperties()
  const activeRequestKey = useRef<string | null>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>("property")
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedImage, setSelectedImage] = useState("")
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null)
  const [operation, setOperation] = useState<PropertyPreparationOperation>("furnish")
  const [selectedProvider, setSelectedProvider] = useState<PreparationProvider>("pedra")
  const [roomType, setRoomType] = useState("Living room")
  const [style, setStyle] = useState("Modern")
  const [creativity, setCreativity] = useState("Medium")
  const [preserveWindows, setPreserveWindows] = useState(true)
  const [furnishRenovation, setFurnishRenovation] = useState(false)
  const [editPrompt, setEditPrompt] = useState("")
  const [highFidelity, setHighFidelity] = useState(true)
  const [preserveOriginalFraming, setPreserveOriginalFraming] = useState(false)
  const [skyStyle, setSkyStyle] = useState("sunny")
  const [blurTargets, setBlurTargets] = useState<string[]>(["faces", "license plates"])
  const [objectMask, setObjectMask] = useState<ObjectMaskValue | null>(null)
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )
  const selectedOperation = getPropertyPreparationOperation(operation)
  const availableProviders = useMemo(
    () => getStudioCapabilityProviders(operationCapability(operation), ["active", "adapter_ready"])
      .map((entry) => entry.provider)
      .filter((provider): provider is PreparationProvider => provider === "pedra" || provider === "openai" || provider === "xai"),
    [operation],
  )
  const resultAsset = campaign?.assets.find((asset) => asset.type === "IMAGE" && Boolean(asset.fileUrl)) ?? null
  const resultImageUrl = resultAsset?.fileUrl ?? null
  const sourcePreviewUrl = sourceMode === "property" ? selectedImage : uploadedImage?.url ?? ""
  const sourceReady = sourceMode === "property"
    ? Boolean(selectedPropertyId && selectedImage)
    : Boolean(uploadedImage)

  useEffect(() => () => {
    if (uploadedImage) URL.revokeObjectURL(uploadedImage.url)
  }, [uploadedImage])

  function handlePropertyChange(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId)
    setSelectedPropertyId(propertyId)
    setSelectedImage(property?.images[0] ?? "")
    setSourceMode("property")
    setObjectMask(null)
    setError(null)
  }

  function handleOperationChange(nextOperation: PropertyPreparationOperation) {
    setOperation(nextOperation)
    const nextProviders = getStudioCapabilityProviders(operationCapability(nextOperation), ["active", "adapter_ready"])
      .map((entry) => entry.provider)
    if (!nextProviders.includes(selectedProvider)) {
      const nextProvider = nextProviders[0]
      setSelectedProvider(nextProvider === "openai" || nextProvider === "xai" ? nextProvider : "pedra")
    }
    setObjectMask(null)
    setCampaign(null)
    setNotice(null)
    setError(null)
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Use uma imagem JPG, PNG ou WEBP.")
      event.target.value = ""
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 15 MB.")
      event.target.value = ""
      return
    }

    if (uploadedImage) URL.revokeObjectURL(uploadedImage.url)
    setUploadedImage({ file, name: file.name, url: URL.createObjectURL(file) })
    setSourceMode("upload")
    setObjectMask(null)
    setError(null)
    event.target.value = ""
  }

  function validateConfiguration() {
    if (operation === "edit_via_prompt" && editPrompt.trim().length < 5) {
      return "Descreva com um pouco mais de detalhe o que deseja alterar."
    }
    if (operation === "blur" && blurTargets.length === 0) {
      return "Selecione pelo menos um tipo de elemento para desfocar."
    }
    if (operation === "remove_object" && !objectMask) {
      return "Marque na imagem a área que deseja remover."
    }
    return null
  }

  function appendConfiguration(formData: FormData) {
    formData.set("operation", operation)
    if (operation === "furnish") {
      formData.set("roomType", roomType)
      formData.set("style", style)
      formData.set("creativity", creativity)
    } else if (operation === "renovation") {
      formData.set("style", style)
      formData.set("preserveWindows", String(preserveWindows))
      formData.set("furnish", String(furnishRenovation))
      formData.set("roomType", furnishRenovation ? roomType : "Auto")
      formData.set("creativity", creativity)
    } else if (operation === "edit_via_prompt") {
      formData.set("prompt", editPrompt.trim())
    } else if (operation === "enhance" || operation === "enhance_and_correct_perspective") {
      formData.set("highFidelity", String(highFidelity))
      formData.set("preserveOriginalFraming", String(preserveOriginalFraming))
    } else if (operation === "sky_blue") {
      formData.set("skyStyle", skyStyle)
    } else if (operation === "blur") {
      formData.set("objectsToBlur", blurTargets.join(", "))
    }
  }

  async function handleGenerate() {
    if (!sourceReady) {
      setError(sourceMode === "property" ? "Selecione um imóvel e uma fotografia." : "Envie uma imagem.")
      return
    }
    const configurationError = validateConfiguration()
    if (configurationError) {
      setError(configurationError)
      return
    }

    setIsGenerating(true)
    setError(null)
    setNotice(null)
    activeRequestKey.current ??= crypto.randomUUID()

    try {
      const formData = new FormData()
      formData.set("sourceType", sourceMode)
      formData.set("provider", selectedProvider)
      formData.set("idempotencyKey", activeRequestKey.current)
      appendConfiguration(formData)

      if (sourceMode === "property") {
        formData.set("propertyId", selectedPropertyId)
        formData.set("imageUrl", selectedImage)
      } else if (uploadedImage) {
        formData.set("image", uploadedImage.file)
      }
      if (operation === "remove_object" && objectMask) formData.set("mask", objectMask.file)

      const response = await fetch("/api/studio-ia/prepare-property", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      const nextCampaign = await parseGenerationResponse(response)
      setCampaign(nextCampaign)
      setNotice("Imagem gerada e salva na Biblioteca para sua revisão.")
      activeRequestKey.current = null
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível preparar a imagem.")
      activeRequestKey.current = null
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleApprove() {
    if (!resultAsset) return
    setIsApproving(true)
    setError(null)

    try {
      const nextCampaign = await studioCampaignsClient.updateAssetStatus(resultAsset.id, "APPROVED")
      setCampaign(nextCampaign)
      setNotice("Resultado aprovado e disponível na Biblioteca.")
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível aprovar o resultado.")
    } finally {
      setIsApproving(false)
    }
  }

  function renderCreativity() {
    return (
      <div className="grid gap-2">
        <p className="text-sm font-medium text-[#374151]">Composição</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {propertyPreparationCreativityLevels.map((item) => (
            <button key={item.value} type="button" onClick={() => setCreativity(item.value)} className={cn("rounded-xl border p-3 text-left transition", creativity === item.value ? "border-[#009b3a]/28 bg-[#f4fbf6]" : "border-black/[0.06] bg-white")}>
              <span className="flex items-center gap-2 text-sm font-semibold text-[#374151]">{creativity === item.value ? <Check className="size-4 text-[#009b3a]" /> : null}{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[#7B8491]">{item.description}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderStyle() {
    return (
      <label className="grid gap-2 text-sm font-medium text-[#374151]">
        Estilo
        <Select value={style} onValueChange={setStyle}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{propertyPreparationStyles.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </label>
    )
  }

  function renderRoomType() {
    return (
      <label className="grid gap-2 text-sm font-medium text-[#374151]">
        Ambiente
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{propertyPreparationRoomTypes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </label>
    )
  }

  function renderOperationControls() {
    if (operation === "furnish") return <>{renderRoomType()}{renderStyle()}{renderCreativity()}</>
    if (operation === "empty_room") {
      return <p className="rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#667085]">Nenhuma configuração adicional é necessária. A imagem será esvaziada preservando a estrutura do ambiente.</p>
    }
    if (operation === "renovation") {
      return <>
        {renderStyle()}
        <div className="grid gap-3 rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-4">
          <label className="flex items-center justify-between gap-4 text-sm font-medium text-[#374151]"><span><span className="block">Preservar janelas</span><span className="mt-1 block text-xs font-normal text-[#7B8491]">Mantém as janelas nas posições originais.</span></span><Switch checked={preserveWindows} onCheckedChange={setPreserveWindows} /></label>
          <label className="flex items-center justify-between gap-4 border-t border-black/[0.05] pt-3 text-sm font-medium text-[#374151]"><span><span className="block">Adicionar móveis</span><span className="mt-1 block text-xs font-normal text-[#7B8491]">Mobília o ambiente junto com a reforma.</span></span><Switch checked={furnishRenovation} onCheckedChange={setFurnishRenovation} /></label>
        </div>
        {furnishRenovation ? renderRoomType() : null}
        {renderCreativity()}
      </>
    }
    if (operation === "edit_via_prompt") {
      return <label className="grid gap-2 text-sm font-medium text-[#374151]">O que você deseja alterar?<Textarea value={editPrompt} onChange={(event) => setEditPrompt(event.target.value)} maxLength={800} rows={5} placeholder="Ex.: troque o piso por madeira clara e deixe as paredes brancas" className="resize-none" /><span className="text-right text-xs font-normal text-[#8B95A1]">{editPrompt.length}/800</span></label>
    }
    if (operation === "enhance" || operation === "enhance_and_correct_perspective") {
      return <div className="grid gap-3">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm font-medium text-[#374151]"><span><span className="block">Alta fidelidade</span><span className="mt-1 block text-xs font-normal leading-5 text-[#7B8491]">Preserva cores, materiais, proporções e enquadramento.</span></span><Switch checked={highFidelity} onCheckedChange={(checked) => { setHighFidelity(checked); if (checked) setPreserveOriginalFraming(false) }} /></label>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-4 text-sm font-medium text-[#374151]"><span><span className="block">Preservar enquadramento</span><span className="mt-1 block text-xs font-normal leading-5 text-[#7B8491]">Mantém proporção e resolução; pode ajustar cores e materiais.</span></span><Switch checked={preserveOriginalFraming} onCheckedChange={(checked) => { setPreserveOriginalFraming(checked); if (checked) setHighFidelity(false) }} /></label>
      </div>
    }
    if (operation === "sky_blue") {
      return <label className="grid gap-2 text-sm font-medium text-[#374151]">Clima do céu<Select value={skyStyle} onValueChange={setSkyStyle}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{propertyPreparationSkyStyles.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></label>
    }
    if (operation === "blur") {
      return <div className="grid gap-2"><p className="text-sm font-medium text-[#374151]">Elementos a desfocar</p>{propertyPreparationBlurTargets.map((item) => <label key={item.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-3 text-sm text-[#374151]"><Checkbox checked={blurTargets.includes(item.value)} onCheckedChange={(checked) => setBlurTargets((current) => checked ? [...new Set([...current, item.value])] : current.filter((value) => value !== item.value))} />{item.label}</label>)}</div>
    }
    if (!sourcePreviewUrl) {
      return <p className="rounded-xl border border-dashed border-black/[0.08] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#667085]">Escolha uma fotografia ou envie uma imagem para abrir o editor de seleção.</p>
    }
    return <StudioObjectMaskEditor imageUrl={sourcePreviewUrl} disabled={isGenerating} onChange={setObjectMask} />
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Fotografia imobiliária</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Preparar imóvel</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">Transforme fotografias reais e revise cada resultado antes de aprová-lo na Biblioteca.</p></div>
            <Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06] bg-white text-[#4B5563]"><Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link></Button>
          </div>
        </section>

        {error ? <section className="rounded-[1.25rem] border border-[#f2caca] bg-[#fff5f5] px-4 py-3 text-sm text-[#c24141]">{error}</section> : null}
        {notice ? <section className="rounded-[1.25rem] border border-[#009b3a]/16 bg-[#eef9f1] px-4 py-3 text-sm text-[#0a8f3d]">{notice}</section> : null}

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,.92fr)]">
          <Card className="min-w-0 rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5 sm:px-6"><CardTitle className="text-xl">1. Escolha o material</CardTitle></CardHeader>
            <CardContent className="grid gap-5 px-5 pb-6 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => { setSourceMode("property"); setObjectMask(null) }} className={cn("rounded-[1.2rem] border p-4 text-left transition", sourceMode === "property" ? "border-[#009b3a]/30 bg-[#f4fbf6]" : "border-black/[0.06] bg-[#fbfbf8]")}><span className="flex items-center gap-3 text-sm font-semibold text-[#050505]"><ImagePlus className="size-4 text-[#009b3a]" />Foto de um imóvel</span><span className="mt-2 block text-xs leading-5 text-[#6B7280]">Escolha uma fotografia já cadastrada no EME.</span></button>
                <button type="button" onClick={() => { setSourceMode("upload"); setObjectMask(null) }} className={cn("rounded-[1.2rem] border p-4 text-left transition", sourceMode === "upload" ? "border-[#009b3a]/30 bg-[#f4fbf6]" : "border-black/[0.06] bg-[#fbfbf8]")}><span className="flex items-center gap-3 text-sm font-semibold text-[#050505]"><Upload className="size-4 text-[#009b3a]" />Enviar imagem</span><span className="mt-2 block text-xs leading-5 text-[#6B7280]">Use uma imagem sem cadastrar um imóvel.</span></button>
              </div>

              {sourceMode === "property" ? <div className="grid gap-4">
                <Select value={selectedPropertyId} onValueChange={handlePropertyChange}><SelectTrigger className="w-full"><SelectValue placeholder="Escolha um imóvel" /></SelectTrigger><SelectContent>{properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.title}</SelectItem>)}</SelectContent></Select>
                {selectedProperty?.images.length ? <div><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#050505]">Fotografias do imóvel</p><span className="text-xs text-[#8B95A1]">Selecione uma</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedProperty.images.map((image, index) => <button key={image} type="button" onClick={() => { setSelectedImage(image); setObjectMask(null) }} className={cn("overflow-hidden rounded-2xl border text-left", selectedImage === image ? "border-[#009b3a]/35 ring-2 ring-[#009b3a]/12" : "border-black/[0.06]")}><div className="aspect-[4/3] bg-[#eef2f6] bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} /><p className="px-3 py-2 text-xs font-medium text-[#4B5563]">Foto {index + 1}</p></button>)}</div></div> : selectedProperty ? <div className="rounded-xl border border-[#eadfca] bg-[#fffaf1] p-4 text-sm text-[#776349]">Este imóvel ainda não possui fotografias cadastradas.</div> : null}
              </div> : <label className="cursor-pointer rounded-[1.2rem] border border-dashed border-black/[0.09] bg-[#fbfbf8] p-4 transition hover:border-[#009b3a]/25 hover:bg-[#f8fdf9]"><div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]"><Upload className="size-5" /></span><div><p className="text-sm font-semibold text-[#050505]">Escolher arquivo</p><p className="mt-1 text-xs text-[#6B7280]">JPG, PNG ou WEBP · até 15 MB</p></div></div><Input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} /></label>}

              {sourceMode === "upload" && uploadedImage ? <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-3"><div className="relative size-16 shrink-0 overflow-hidden rounded-xl"><Image src={uploadedImage.url} alt="Imagem enviada" fill unoptimized className="object-cover" /></div><div className="min-w-0"><p className="text-sm font-semibold text-[#050505]">Imagem enviada</p><p className="mt-1 truncate text-xs text-[#6B7280]">{uploadedImage.name}</p></div></div> : null}
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5 sm:px-6"><CardTitle className="text-xl">2. Escolha a preparação</CardTitle></CardHeader>
            <CardContent className="grid gap-5 px-5 pb-6 sm:px-6">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {propertyPreparationOperations.map((item) => <button key={item.value} type="button" onClick={() => handleOperationChange(item.value)} className={cn("rounded-xl border p-3 text-left transition", operation === item.value ? "border-[#009b3a]/28 bg-[#f4fbf6]" : "border-black/[0.06] bg-white")}><span className="flex items-center gap-2 text-sm font-semibold text-[#374151]">{operation === item.value ? <Check className="size-4 text-[#009b3a]" /> : null}{item.shortLabel}</span><span className="mt-1 block text-xs leading-5 text-[#7B8491]">{item.description}</span></button>)}
              </div>

              <div className="flex items-start gap-3 rounded-[1.2rem] border border-[#009b3a]/18 bg-[#f4fbf6] p-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#009b3a]"><Sparkles className="size-5" /></span><div><p className="text-sm font-semibold text-[#08752f]">{selectedOperation.label}</p><p className="mt-1 text-xs leading-5 text-[#4f715b]">{selectedOperation.description}</p></div></div>
              <div className="grid gap-2" data-testid="preparation-provider-options">
                <p className="text-sm font-medium text-[#374151]">IA</p>
                {availableProviders.map((provider) => <button key={provider} type="button" onClick={() => setSelectedProvider(provider)} aria-pressed={selectedProvider === provider} className={cn("rounded-xl border p-3 text-left transition", selectedProvider === provider ? "border-[#009b3a]/28 bg-[#f4fbf6]" : "border-black/[0.06] bg-white")}><span className="text-sm font-semibold text-[#374151]">{STUDIO_PROVIDER_LABELS[provider]}</span><span className="mt-1 block text-xs leading-5 text-[#7B8491]">{providerDescriptions[provider]}</span></button>)}
              </div>
              <div className="grid gap-4">{renderOperationControls()}</div>

              <Button type="button" disabled={!sourceReady || isGenerating || (operation === "remove_object" && !objectMask)} onClick={handleGenerate} className="h-11 rounded-xl">{isGenerating ? <><LoaderCircle className="size-4 animate-spin" />Processando imagem...</> : <><Sparkles className="size-4" />{selectedOperation.label}</>}</Button>
              <p className="text-xs leading-5 text-[#7B8491]">O processamento começa somente após o envio. Repetições da mesma solicitação em andamento reutilizam o processamento existente.</p>
            </CardContent>
          </Card>
        </section>

        {resultImageUrl && campaign ? <Card className="overflow-hidden rounded-[1.75rem] border-black/[0.06] bg-white/92 py-0"><CardHeader className="px-5 py-5 sm:px-6"><CardTitle className="text-xl">3. Revise o resultado</CardTitle></CardHeader><CardContent className="grid gap-5 px-5 pb-6 sm:px-6"><div className="grid gap-4 lg:grid-cols-2">{sourcePreviewUrl ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8B95A1]">Original</p><div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eef2f6]"><Image src={sourcePreviewUrl} alt="Imagem original" fill unoptimized className="object-cover" /></div></div> : null}<div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8B95A1]">Resultado</p><div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eef2f6]"><Image src={resultImageUrl} alt="Resultado da preparação" fill unoptimized className="object-cover" /></div></div></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-6 text-[#667085]">O resultado já está salvo na Biblioteca e aguarda sua aprovação.</p><div className="flex flex-col gap-2 sm:flex-row"><Button asChild variant="outline" className="rounded-xl"><Link href={`/corretor/studio-ia/biblioteca/${campaign.id}`}><Library className="size-4" />Abrir Biblioteca</Link></Button>{resultAsset?.status === "APPROVED" ? <><Button disabled className="rounded-xl"><Check className="size-4" />Aprovado</Button><Button asChild className="rounded-xl"><Link href={`/corretor/studio-ia/criar-video-do-imovel?sourceAssetId=${encodeURIComponent(resultAsset.id)}`}><Video className="size-4" />Criar vídeo</Link></Button><Button asChild variant="outline" className="rounded-xl"><Link href={`/corretor/studio-ia/atrair-compradores?sourceAssetId=${encodeURIComponent(resultAsset.id)}`}><Megaphone className="size-4" />Criar anúncio</Link></Button></> : <Button type="button" onClick={handleApprove} disabled={isApproving} className="rounded-xl">{isApproving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Aprovar resultado</Button>}</div></div></CardContent></Card> : null}
      </div>
    </BrokerPageShell>
  )
}
