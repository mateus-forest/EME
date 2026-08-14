"use client"

import { type ChangeEvent, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Check, Library, Megaphone, Sparkles, Upload, Video } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"
import { cn } from "@/lib/utils"

type ProjectCase = "terrain" | "construction" | "design" | "custom"
type ProjectProvider = "openai" | "xai"

const cases: Array<{ value: ProjectCase; label: string; description: string }> = [
  { value: "terrain", label: "Construção no terreno", description: "Explore uma possibilidade de construção na fotografia do terreno." },
  { value: "construction", label: "Obra finalizada", description: "Represente conceitualmente como a obra pode ficar concluída." },
  { value: "design", label: "Projeto mais realista", description: "Converta render, fachada ou projeto visual em uma representação mais realista." },
  { value: "custom", label: "Personalizado", description: "Descreva outra visualização arquitetônica para a imagem." },
]

const providers: Array<{ value: ProjectProvider; label: string; description: string }> = [
  { value: "openai", label: "OpenAI", description: "Boa para representações conceituais e edição orientada." },
  { value: "xai", label: "Grok", description: "Boa para explorar diferentes interpretações visuais." },
]

async function readCampaign(response: Response) {
  const data = await response.json().catch(() => null) as { campaign?: StudioCampaignRecord; jobId?: string; error?: string } | null
  if (response.status === 202 && data?.jobId) {
    const deadline = Date.now() + 95_000
    while (Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500))
      const poll = await fetch(`/api/studio-ia/visualize-project?jobId=${encodeURIComponent(data.jobId)}`, { cache: "no-store" })
      if (poll.status === 202) continue
      return readCampaign(poll)
    }
    throw new Error("A visualização continua em processamento. Consulte a Biblioteca em instantes.")
  }
  if (!response.ok || !data?.campaign) throw new Error(data?.error || "Não foi possível gerar a visualização.")
  return data.campaign
}

export function BrokerStudioIaVisualizeProjectPage() {
  const requestKey = useRef<string | null>(null)
  const [image, setImage] = useState<{ file: File; url: string } | null>(null)
  const [projectCase, setProjectCase] = useState<ProjectCase>("terrain")
  const [provider, setProvider] = useState<ProjectProvider>("openai")
  const [prompt, setPrompt] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const results = useMemo(() => campaign?.assets.filter((asset) => asset.type === "IMAGE" && asset.fileUrl) ?? [], [campaign])

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 15 * 1024 * 1024) {
      setError("Envie uma imagem JPG, PNG ou WEBP de até 15 MB.")
      return
    }
    if (image) URL.revokeObjectURL(image.url)
    setImage({ file, url: URL.createObjectURL(file) })
    setCampaign(null)
    setError(null)
  }

  async function generate() {
    if (!image || prompt.trim().length < 8) return setError("Envie uma imagem e descreva o que deseja visualizar.")
    setIsGenerating(true)
    setError(null)
    requestKey.current ??= crypto.randomUUID()
    try {
      const form = new FormData()
      form.set("image", image.file)
      form.set("case", projectCase)
      form.set("provider", provider)
      form.set("prompt", prompt.trim())
      form.set("quantity", quantity)
      form.set("idempotencyKey", requestKey.current)
      const response = await fetch("/api/studio-ia/visualize-project", { method: "POST", body: form })
      setCampaign(await readCampaign(response))
      requestKey.current = null
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar a visualização.")
      requestKey.current = null
    } finally {
      setIsGenerating(false)
    }
  }

  async function approve(assetId: string) {
    setIsApproving(assetId)
    setError(null)
    try { setCampaign(await studioCampaignsClient.updateAssetStatus(assetId, "APPROVED")) }
    catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Não foi possível aprovar a visualização.") }
    finally { setIsApproving(null) }
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 text-[#111827] sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#009b3a]">Representação de projetos</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#050505]">Visualizar projeto</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">Explore possibilidades futuras a partir de terrenos, obras, renders e fachadas.</p></div><Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06] bg-white text-[#4B5563]"><Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link></Button></div>
        </section>
        {error ? <div className="rounded-2xl border border-[#f2caca] bg-[#fff5f5] p-4 text-sm text-[#c24141]">{error}</div> : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>1. Imagem e objetivo</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6">
            <label className="cursor-pointer rounded-2xl border border-dashed border-black/[0.09] bg-[#fbfbf8] p-4"><div className="flex items-center gap-3"><Upload className="size-5 text-[#009b3a]" /><div><p className="text-sm font-semibold">Enviar imagem</p><p className="text-xs text-[#4B5563]">Terreno, obra, render, projeto ou fachada · até 15 MB</p></div></div><Input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} /></label>
            {image ? <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#eef2f6]"><Image src={image.url} alt="Imagem original" fill unoptimized className="object-cover" /></div> : null}
            <div className="grid gap-2 sm:grid-cols-2">{cases.map((item) => <button key={item.value} type="button" onClick={() => setProjectCase(item.value)} className={cn("rounded-xl border p-3 text-left", projectCase === item.value ? "border-[#009b3a]/28 bg-[#f4fbf6]" : "border-black/[0.06]")}><span className="text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-[#4B5563]">{item.description}</span></button>)}</div>
            <label className="grid gap-2 text-sm font-medium">O que você quer visualizar?<Textarea rows={4} maxLength={800} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: crie uma farmácia contemporânea neste terreno, com estacionamento frontal." /></label>
          </CardContent></Card>

          <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>2. IA e alternativas</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6">
            {providers.map((item) => <button key={item.value} type="button" data-testid={`project-provider-${item.value}`} onClick={() => setProvider(item.value)} className={cn("rounded-xl border p-4 text-left", provider === item.value ? "border-[#009b3a]/28 bg-[#f4fbf6]" : "border-black/[0.06]")}><span className="text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-5 text-[#4B5563]">{item.description}</span></button>)}
            <label className="grid gap-2 text-sm font-medium">Quantidade<Select value={quantity} onValueChange={setQuantity}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 opção</SelectItem><SelectItem value="2">2 opções</SelectItem><SelectItem value="3">3 opções</SelectItem></SelectContent></Select><span className="text-xs font-normal text-[#4B5563]">Cada alternativa executa uma geração externa. Você escolhe antes de gerar.</span></label>
            <Button onClick={generate} disabled={!image || prompt.trim().length < 8 || isGenerating} className="h-11 rounded-xl">{isGenerating ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}{isGenerating ? "Gerando visualização..." : "Gerar visualização"}</Button>
          </CardContent></Card>
        </section>

        {campaign && results.length ? <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>3. Original e visualizações</CardTitle></CardHeader><CardContent className="grid gap-5 px-5 pb-6"><div className="rounded-xl border border-[#009b3a]/14 bg-[#f4fbf6] px-4 py-3 text-sm text-[#356047]">Representação ilustrativa gerada por IA</div><div className="grid gap-4 md:grid-cols-2">{image ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#6B7280]">Original</p><div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Image src={image.url} alt="Original" fill unoptimized className="object-cover" /></div></div> : null}{results.map((asset) => <div key={asset.id}><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#6B7280]">{asset.label}</p><div className="relative aspect-[4/3] overflow-hidden rounded-2xl"><Image src={asset.fileUrl!} alt={asset.label || "Visualização"} fill unoptimized className="object-cover" /></div><div className="mt-3 flex flex-wrap gap-2">{asset.status === "APPROVED" ? <><Button disabled size="sm"><Check className="size-4" />Aprovada</Button><Button asChild size="sm"><Link href={`/corretor/studio-ia/criar-video-do-imovel?sourceAssetId=${encodeURIComponent(asset.id)}`}><Video className="size-4" />Criar vídeo</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/corretor/studio-ia/atrair-compradores?sourceAssetId=${encodeURIComponent(asset.id)}`}><Megaphone className="size-4" />Criar anúncio</Link></Button></> : <Button size="sm" onClick={() => approve(asset.id)} disabled={isApproving === asset.id}>{isApproving === asset.id ? <Spinner className="size-4" /> : <Check className="size-4" />}Aprovar</Button>}</div></div>)}</div><Button asChild variant="outline" className="w-fit rounded-xl"><Link href={`/corretor/studio-ia/biblioteca/${campaign.id}`}><Library className="size-4" />Abrir Biblioteca</Link></Button></CardContent></Card> : null}
      </div>
    </BrokerPageShell>
  )
}


