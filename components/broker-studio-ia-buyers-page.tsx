"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Library, Megaphone, Sparkles } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { studioCampaignsClient, type StudioCampaignRecord } from "@/lib/studio-campaigns-client"

type Result = { title: string; primaryText: string; cta: string; audience: string; approach: string; campaign?: StudioCampaignRecord }
type Material = { campaign: StudioCampaignRecord; asset: StudioCampaignRecord["assets"][number] }

const channels = ["Instagram / Meta", "WhatsApp", "Portal imobiliario", "Geral"] as const
const objectives = ["Vender", "Gerar contatos", "Agendar visitas"] as const

export function BrokerStudioIaBuyersPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [sourceAssetId, setSourceAssetId] = useState("")
  const [channel, setChannel] = useState<(typeof channels)[number]>("Instagram / Meta")
  const [objective, setObjective] = useState<(typeof objectives)[number]>("Vender")
  const [result, setResult] = useState<Result | null>(null)
  const [campaign, setCampaign] = useState<StudioCampaignRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = useMemo(() => materials.find((item) => item.asset.id === sourceAssetId) ?? null, [materials, sourceAssetId])

  useEffect(() => {
    let cancelled = false
    studioCampaignsClient.list({ limit: 100 }).then(({ campaigns }) => {
      if (cancelled) return
      const next = campaigns.flatMap((entry) => entry.assets.flatMap((asset) =>
        asset.status === "APPROVED" && asset.fileUrl && ["IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL"].includes(asset.type)
          ? [{ campaign: entry, asset }]
          : [],
      ))
      setMaterials(next)
      const queryId = new URLSearchParams(window.location.search).get("sourceAssetId")
      setSourceAssetId(next.some((item) => item.asset.id === queryId) ? queryId! : next[0]?.asset.id ?? "")
    }).catch((caughtError) => setError(caughtError instanceof Error ? caughtError.message : "Não foi possível carregar a Biblioteca."))
      .finally(() => setIsLoading(false))
    return () => { cancelled = true }
  }, [])

  async function generate() {
    if (!sourceAssetId) return setError("Escolha um material aprovado da Biblioteca.")
    setIsGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/studio-ia/buyers", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ sourceAssetId, channel, objective, version: (campaign?.version ?? 0) + 1 }),
      })
      const body = await response.json().catch(() => null) as (Result & { error?: string }) | null
      if (!response.ok || !body) throw new Error(body?.error || "Não foi possível gerar o anúncio.")
      setResult(body)
      setCampaign(body.campaign ?? null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar o anúncio.")
    } finally { setIsGenerating(false) }
  }

  async function approve() {
    if (!campaign) return
    setIsApproving(true)
    try { setCampaign(await studioCampaignsClient.approveCampaign(campaign.id)) }
    catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : "Não foi possível aprovar o anúncio.") }
    finally { setIsApproving(false) }
  }

  return (
    <BrokerPageShell title="Studio IA">
      <div className="grid min-w-0 gap-4 text-[#111827] sm:gap-5">
        <section className="rounded-[1.75rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6 lg:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#009b3a]">Promoção imobiliária</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Criar anúncio</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5F6B7A]">Transforme um material aprovado em título, texto, CTA e abordagem comercial.</p></div><Button asChild variant="ghost" className="w-fit rounded-xl border border-black/[0.06]"><Link href="/corretor/studio-ia"><ArrowLeft className="size-4" />Voltar ao Estúdio</Link></Button></div></section>
        {error ? <div className="rounded-2xl border border-[#f2caca] bg-[#fff5f5] p-4 text-sm text-[#c24141]">{error}</div> : null}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>1. Material</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6">{isLoading ? <p className="flex items-center gap-2 text-sm text-[#4B5563]"><Spinner className="size-4" />Carregando Biblioteca...</p> : materials.length ? <Select value={sourceAssetId} onValueChange={setSourceAssetId}><SelectTrigger data-testid="ad-library-material"><SelectValue placeholder="Escolha um material" /></SelectTrigger><SelectContent>{materials.map((item) => <SelectItem key={item.asset.id} value={item.asset.id}>{item.campaign.title} · {item.asset.label || item.asset.type}</SelectItem>)}</SelectContent></Select> : <div className="rounded-xl border border-dashed border-black/[0.08] bg-[#fbfbf8] p-5 text-sm text-[#4B5563]">Aprove uma imagem ou vídeo na Biblioteca para criar um anúncio.</div>}{selected?.asset.fileUrl ? selected.asset.type === "VIDEO" ? <video src={selected.asset.fileUrl} controls className="max-h-80 w-full rounded-2xl bg-[#eef2f6]" /> : <img src={selected.asset.fileUrl} alt="Material selecionado" className="max-h-80 w-full rounded-2xl object-contain bg-[#f5f6f4]" /> : null}</CardContent></Card>
          <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>2. Direção do anúncio</CardTitle></CardHeader><CardContent className="grid gap-4 px-5 pb-6"><label className="grid gap-2 text-sm font-medium">Onde pretende anunciar?<Select value={channel} onValueChange={(value) => setChannel(value as typeof channel)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{channels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><label className="grid gap-2 text-sm font-medium">Objetivo<Select value={objective} onValueChange={(value) => setObjective(value as typeof objective)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{objectives.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></label><div className="rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-4 text-xs leading-5 text-[#4B5563]">A OpenAI gera somente o conteúdo comercial. O material selecionado permanece vinculado ao anúncio.</div><Button onClick={generate} disabled={!sourceAssetId || isGenerating} className="h-11 rounded-xl">{isGenerating ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}{isGenerating ? "Gerando anúncio..." : "Gerar anúncio"}</Button></CardContent></Card>
        </section>
        {result ? <Card className="rounded-[1.5rem] border-black/[0.06] bg-white text-[#111827] py-0"><CardHeader className="px-5 py-5"><CardTitle>Resultado utilizável</CardTitle></CardHeader><CardContent className="grid gap-3 px-5 pb-6"><ResultBlock label="Título" value={result.title} /><ResultBlock label="Texto principal" value={result.primaryText} /><ResultBlock label="CTA" value={result.cta} /><ResultBlock label="Público sugerido" value={result.audience} /><ResultBlock label="Abordagem" value={result.approach} /><div className="mt-2 flex flex-wrap gap-2">{campaign?.status === "APPROVED" ? <Button disabled><Check className="size-4" />Aprovado</Button> : <Button onClick={approve} disabled={isApproving}>{isApproving ? <Spinner className="size-4" /> : <Check className="size-4" />}Aprovar anúncio</Button>}<Button asChild variant="outline"><Link href="/corretor/studio-ia/biblioteca"><Library className="size-4" />Abrir Biblioteca</Link></Button></div></CardContent></Card> : null}
      </div>
    </BrokerPageShell>
  )
}

function ResultBlock({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-black/[0.06] bg-[#fbfbf8] p-4"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8B95A1]">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#374151]">{value}</p></div>
}


