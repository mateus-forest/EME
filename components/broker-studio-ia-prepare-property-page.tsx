"use client"

import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Aperture,
  Brush,
  CloudSun,
  Crop,
  Eraser,
  EyeOff,
  ImagePlus,
  Paintbrush,
  Sparkles,
  Upload,
} from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const capabilities = [
  { title: "Mobiliar ambiente", icon: Sparkles },
  { title: "Esvaziar ambiente", icon: Eraser },
  { title: "Reformar ou redecorar", icon: Paintbrush },
  { title: "Editar imagem", icon: Brush },
  { title: "Remover objeto", icon: Eraser },
  { title: "Melhorar fotografia", icon: Aperture },
  { title: "Corrigir perspectiva", icon: Crop },
  { title: "Melhorar céu", icon: CloudSun },
  { title: "Desfocar informações sensíveis", icon: EyeOff },
] as const

export function BrokerStudioIaPreparePropertyPage() {
  const { properties } = useBrokerProperties()
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [selectedImage, setSelectedImage] = useState("")
  const [uploadedImage, setUploadedImage] = useState<{ name: string; url: string } | null>(null)
  const [selectedCapability, setSelectedCapability] = useState<string>(capabilities[0].title)

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )

  useEffect(() => () => {
    if (uploadedImage) URL.revokeObjectURL(uploadedImage.url)
  }, [uploadedImage])

  function handlePropertyChange(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId)
    setSelectedPropertyId(propertyId)
    setSelectedImage(property?.images[0] ?? "")
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadedImage({ name: file.name, url: URL.createObjectURL(file) })
    event.target.value = ""
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Fotografia imobiliária</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Preparar imóvel</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">
                Reúna a imagem e a transformação desejada em um fluxo simples de preparação visual.
              </p>
            </div>
            <Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06] bg-white text-[#4B5563]">
              <Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link>
            </Button>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(19rem,.75fr)]">
          <Card className="min-w-0 rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5 sm:px-6"><CardTitle className="text-xl">1. Escolha o material</CardTitle></CardHeader>
            <CardContent className="grid gap-5 px-5 pb-6 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.2rem] border border-black/[0.06] bg-[#fbfbf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Selecionar imóvel</p>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">Use uma fotografia já cadastrada no EME.</p>
                  <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                    <SelectTrigger className="mt-4 w-full"><SelectValue placeholder="Escolha um imóvel" /></SelectTrigger>
                    <SelectContent>
                      {properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <label className="cursor-pointer rounded-[1.2rem] border border-dashed border-black/[0.09] bg-[#fbfbf8] p-4 transition hover:border-[#009b3a]/25 hover:bg-[#f8fdf9]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B95A1]">Enviar imagem</p>
                  <div className="mt-4 flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef9f1] text-[#009b3a]"><Upload className="size-5" /></span>
                    <div><p className="text-sm font-semibold text-[#050505]">Escolher arquivo</p><p className="mt-1 text-xs text-[#6B7280]">JPG, PNG ou WEBP</p></div>
                  </div>
                  <Input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
                </label>
              </div>

              {selectedProperty?.images.length ? (
                <div>
                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#050505]">Fotografias do imóvel</p><span className="text-xs text-[#8B95A1]">Selecione uma</span></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedProperty.images.map((image, index) => (
                      <button key={image} type="button" onClick={() => setSelectedImage(image)} className={`overflow-hidden rounded-2xl border text-left ${selectedImage === image ? "border-[#009b3a]/35 ring-2 ring-[#009b3a]/12" : "border-black/[0.06]"}`}>
                        <div className="aspect-[4/3] bg-[#eef2f6] bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
                        <p className="px-3 py-2 text-xs font-medium text-[#4B5563]">Foto {index + 1}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {uploadedImage ? (
                <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-3">
                  <div className="size-16 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${uploadedImage.url})` }} />
                  <div className="min-w-0"><p className="text-sm font-semibold text-[#050505]">Imagem enviada</p><p className="mt-1 truncate text-xs text-[#6B7280]">{uploadedImage.name}</p></div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="min-w-0 rounded-[1.5rem] border-black/[0.06] bg-white/90 py-0">
            <CardHeader className="px-5 py-5 sm:px-6"><CardTitle className="text-xl">2. O que preparar</CardTitle></CardHeader>
            <CardContent className="grid gap-4 px-5 pb-6 sm:px-6">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {capabilities.map((capability) => {
                  const Icon = capability.icon
                  const active = selectedCapability === capability.title
                  return (
                    <button key={capability.title} type="button" onClick={() => setSelectedCapability(capability.title)} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${active ? "border-[#009b3a]/25 bg-[#eef9f1] text-[#08752f]" : "border-black/[0.06] bg-white text-[#4B5563] hover:border-black/[0.12]"}`}>
                      <Icon className="size-4 shrink-0" />{capability.title}
                    </button>
                  )
                })}
              </div>
              <div className="rounded-xl border border-[#eadfca] bg-[#fffaf1] p-4 text-sm leading-6 text-[#776349]">
                A experiência está preparada, mas estas transformações ainda não estão conectadas a uma geração nesta fase.
              </div>
              <Button type="button" disabled className="h-11 rounded-xl disabled:opacity-45">Continuar em breve</Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </BrokerPageShell>
  )
}
