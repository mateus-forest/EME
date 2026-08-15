"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Check, Film, Library, Sparkles } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getApprovedStudioPipelineAssets } from "@/lib/studio-asset-context"
import { studioCampaignsClient } from "@/lib/studio-campaigns-client"
import {
  studioVideoDefaultDuration,
  studioVideoRequestSchema,
  studioVideoResultSchema,
  type StudioVideoResult,
} from "@/lib/studio-ia-video-shared"
import { cn } from "@/lib/utils"

type Motion = "automatic" | "soft" | "cinematic"

const providers = [
  { value: "lumaai", label: "Luma", description: "Movimento generativo entre a imagem original e o resultado aprovado." },
] as const

const motions: Array<{ value: Motion; label: string; description: string }> = [
  { value: "automatic", label: "Automático", description: "O EME escolhe um movimento equilibrado." },
  { value: "soft", label: "Suave", description: "Movimento discreto e contínuo." },
  { value: "cinematic", label: "Cinematográfico", description: "Movimento com maior presença visual." },
]

function motionConfig(value: Motion) {
  if (value === "soft") return { rhythm: "Suave" as const, cameraMovement: "Gimbal" as const, style: "Minimalista" as const }
  if (value === "cinematic") return { rhythm: "Equilibrado" as const, cameraMovement: "Travelling" as const, style: "Cinematografico" as const }
  return { rhythm: "Equilibrado" as const, cameraMovement: "Gimbal" as const, style: "Cinematografico" as const }
}

export function BrokerStudioIaVideoPage() {
  const [items, setItems] = useState<ReturnType<typeof getApprovedStudioPipelineAssets>>([])
  const [sourceAssetId, setSourceAssetId] = useState("")
  const [format, setFormat] = useState<"Reel vertical 9:16" | "Paisagem 16:9">("Reel vertical 9:16")
  const [motion, setMotion] = useState<Motion>("automatic")
  const [instruction, setInstruction] = useState("")
  const [result, setResult] = useState<StudioVideoResult | null>(null)
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = useMemo(() => items.find((item) => item.asset.id === sourceAssetId) ?? null, [items, sourceAssetId])

  useEffect(() => {
    let cancelled = false
    studioCampaignsClient.list({ limit: 100 }).then(({ campaigns }) => {
      if (cancelled) return
      const eligible = getApprovedStudioPipelineAssets(campaigns)
      setItems(eligible)
      const fromQuery = new URLSearchParams(window.location.search).get("sourceAssetId")
      setSourceAssetId(eligible.some((item) => item.asset.id === fromQuery) ? fromQuery! : eligible[0]?.asset.id ?? "")
    }).catch((caughtError) => !cancelled && setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a Biblioteca."))
      .finally(() => !cancelled && setIsLoadingLibrary(false))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!result?.requestId || result.generationStatus === "completed" || result.generationStatus === "failed") return
    let cancelled = false
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/studio-ia/video?requestId=${encodeURIComponent(result.requestId)}`, { cache: "no-store" })
        const body = await response.json().catch(() => null) as (StudioVideoResult & { error?: string }) | null
        if (!response.ok || !body) throw new Error(body?.error || "Não foi possível acompanhar o vídeo.")
        const next = studioVideoResultSchema.parse(body)
        if (!cancelled) {
          setResult(next)
          if (next.generationStatus === "completed" || next.generationStatus === "failed") setIsGenerating(false)
        }
      } catch (caughtError) {
        if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : "Não foi possível acompanhar o vídeo.")
      }
    }, 4000)
    return () => { cancelled = true; window.clearInterval(poll) }
  }, [result?.generationStatus, result?.requestId])

  async function generate() {
    if (!selected) return setError("Escolha um projeto aprovado da Biblioteca.")
    setIsGenerating(true)
    setError(null)
    setResult(null)
    try {
      const movement = motionConfig(motion)
      const payload = studioVideoRequestSchema.parse({
        provider: "lumaai",
        sourceAssetId: selected.asset.id,
        referenceImageUrls: [selected.resultUrl],
        uploadedImages: [],
        format,
        duration: studioVideoDefaultDuration,
        objective: "Apresentar o imovel",
        style: movement.style,
        transformation: "Nenhuma",
        rhythm: movement.rhythm,
        cameraMovement: movement.cameraMovement,
        additionalInstructions: instruction.trim(),
        version: 1,
      })
      const form = new FormData()
      form.set("payload", JSON.stringify(payload))
      const response = await fetch("/api/studio-ia/video", { method: "POST", body: form, cache: "no-store" })
      const body = await response.json().catch(() => null) as (StudioVideoResult & { error?: string }) | null
      if (!response.ok || !body) throw new Error(body?.error || "Não foi possível iniciar o vídeo.")
      const parsed = studioVideoResultSchema.parse(body)
      setResult(parsed)
      if (parsed.generationStatus === "completed" || parsed.generationStatus === "failed") setIsGenerating(false)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível iniciar o vídeo.")
      setIsGenerating(false)
    }
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 text-[#111827] sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#009b3a]">Vídeo imobiliário</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Criar vídeo</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">Anime a passagem da imagem original para um resultado aprovado do Studio.</p></div><Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06]"><Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link></Button></div></section>
        {error ? <div className="rounded-2xl border border-[#f2caca] bg-[#fff5f5] p-4 text-sm text-[#c24141]">{error}</div> : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>1. Projeto da Biblioteca</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6">
            {isLoadingLibrary ? <div className="flex items-center gap-2 text-sm text-[#4B5563]"><Spinner className="size-4" />Carregando projetos...</div> : items.length ? <Select value={sourceAssetId} onValueChange={setSourceAssetId}><SelectTrigger data-testid="video-library-project"><SelectValue placeholder="Escolha um projeto" /></SelectTrigger><SelectContent>{items.map((item) => <SelectItem key={item.asset.id} value={item.asset.id}>{item.campaign.title} · {item.asset.label || "Resultado aprovado"}</SelectItem>)}</SelectContent></Select> : <div className="rounded-xl border border-dashed border-black/[0.08] bg-[#fbfbf8] p-5 text-sm leading-6 text-[#4B5563]">Aprove uma imagem em Preparar imóvel ou Visualizar projeto para criar um vídeo.</div>}
            {selected ? <><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#6B7280]">Original</p><div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Image src={selected.originalUrl} alt="Frame inicial" fill unoptimized className="object-cover" /></div></div><div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#6B7280]">Resultado</p><div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Image src={selected.resultUrl} alt="Frame final" fill unoptimized className="object-cover" /></div></div></div>{selected.illustrative ? <p className="rounded-xl border border-[#009b3a]/14 bg-[#f4fbf6] px-4 py-3 text-xs text-[#356047]">Representação ilustrativa gerada por IA</p> : null}</> : null}
          </CardContent></Card>

          <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>2. Configuração</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6">
            <div className="grid gap-2"><p className="text-sm font-medium">IA</p>{providers.map((item) => <button key={item.value} type="button" aria-pressed="true" className="rounded-xl border border-[#009b3a]/28 bg-[#f4fbf6] p-3 text-left"><span className="flex items-center gap-2 text-sm font-semibold"><Check className="size-4 text-[#009b3a]" />{item.label}</span><span className="mt-1 block text-xs leading-5 text-[#4B5563]">{item.description}</span></button>)}</div>
            <label className="grid gap-2 text-sm font-medium">Formato<Select value={format} onValueChange={(value) => setFormat(value as typeof format)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Reel vertical 9:16">Reel 9:16</SelectItem><SelectItem value="Paisagem 16:9">Horizontal 16:9</SelectItem></SelectContent></Select></label>
            <div className="grid gap-2"><p className="text-sm font-medium">Movimento</p><div className="grid grid-cols-3 gap-2">{motions.map((item) => <button key={item.value} type="button" onClick={() => setMotion(item.value)} title={item.description} className={cn("rounded-xl border px-2 py-3 text-xs font-semibold", motion === item.value ? "border-[#009b3a]/28 bg-[#f4fbf6]" : "border-black/[0.06]")}>{item.label}</button>)}</div></div>
            <label className="grid gap-2 text-sm font-medium">Orientação adicional <span className="font-normal text-[#6B7280]">(opcional)</span><Textarea rows={3} maxLength={600} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Faça a transformação acontecer de forma progressiva enquanto a câmera se aproxima." /></label>
            <Button onClick={generate} disabled={!selected || isGenerating} className="h-11 rounded-xl">{isGenerating ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}{isGenerating ? "Criando vídeo..." : "Criar vídeo"}</Button>
          </CardContent></Card>
        </section>

        {result ? <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>Resultado</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6">{result.videoUrl ? <video src={result.videoUrl} controls className="max-h-[560px] w-full rounded-2xl bg-[#eef2f6]" /> : <div className="rounded-2xl border border-black/[0.06] bg-[#fbfbf8] p-5"><div className="flex items-center gap-3"><Film className="size-5 text-[#009b3a]" /><div><p className="font-semibold">{result.generationStatus === "failed" ? "Não foi possível concluir" : "Vídeo em processamento"}</p><p className="mt-1 text-sm text-[#4B5563]">Progresso: {result.progress}%.</p></div></div></div>}<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href="/corretor/studio-ia/biblioteca"><Library className="size-4" />Abrir Biblioteca</Link></Button></div></CardContent></Card> : null}
      </div>
    </BrokerPageShell>
  )
}


