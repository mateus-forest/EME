"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ArrowUpFromLine, AudioLines, ImagePlus, Images, Sparkles, Upload } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { requestPropertyAi } from "@/lib/property-ai-client"
import { isBillingBypassEnabled } from "@/lib/billing-config"
import { formatCurrencyInput } from "@/lib/currency"
import { useBrokerProperties } from "@/components/use-broker-properties"
import { useBrokerSubscription } from "@/components/use-broker-subscription"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

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
  const { properties, addProperty, uploadPropertyImages, uploadPropertyAudio } = useBrokerProperties()
  const { subscription } = useBrokerSubscription()
  const [images, setImages] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("")
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false)
  const [title, setTitle] = useState("")
  const [city, setCity] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [price, setPrice] = useState("")
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

  const totalPropertiesCount = useMemo(() => properties.length, [properties])
  const billingBypassEnabled = isBillingBypassEnabled()
  const isPlanBlocked = !billingBypassEnabled && subscription.isProfileResolved && subscription.requiresRegularization
  const hasReachedLimit =
    !billingBypassEnabled &&
    subscription.isProfileResolved &&
    !isPlanBlocked &&
    !subscription.isUpgraded &&
    !subscription.isAgencyLinked &&
    totalPropertiesCount >= (subscription.propertyLimit ?? 3)

  const previewImages = useMemo(() => images, [images])
  const previewLocation = [neighborhood.trim(), city.trim()].filter(Boolean).join(", ")

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
        type: "Apartamento",
        city,
        neighborhood,
        price,
        bedrooms,
        bathrooms,
        parkingSpots: parking,
        description,
      })

      setDescription(generated.description)

      if (!title.trim() && generated.suggestedTitle) {
        setTitle(generated.suggestedTitle)
      }

      setAiHighlights(generated.highlights)
      setHasGenerated(true)
    } catch (caughtError) {
      setPublishFeedback(caughtError instanceof Error ? caughtError.message : "Não foi possível gerar o anúncio com IA.")
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
        tipo: "Apartamento",
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
        status: "Publicado",
        views: "0",
        leads: "0",
        type: "Apartamento",
        description,
        audioUrl: "",
      })

      if (selectedFiles.length > 0) {
        await uploadPropertyImages(createdProperty.id, selectedFiles)
      }

      if (audioFile) {
        await uploadPropertyAudio(createdProperty.id, audioFile)
      }

      setIsPublished(true)
      setPublishFeedback("Publicado com sucesso")
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

        <section className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] px-6 py-6 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">Novo imóvel</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Capture, descreva e publique em segundos
          </h2>
        </section>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="text-xl text-white">Fotos do imóvel</CardTitle>
            <p className="text-sm text-white/50">Adicione fotos para gerar o anúncio. Essa etapa é obrigatória.</p>
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
                Descreva o imóvel com texto ou áudio. A IA pode transformar sua descrição em um anúncio profissional.
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
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Descrição do anúncio</CardTitle>
                <p className="text-sm text-white/50">
                  Descreva o imóvel com texto ou áudio. A IA pode transformar sua descrição em um anúncio profissional.
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 p-5 pt-0">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Fale sobre ambientes, diferenciais, lazer, localização ou qualquer detalhe relevante."
                  className="min-h-40 rounded-[1.25rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/30"
                />

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

                {audioFile ? (
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

            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardHeader className="px-6 py-5">
                <CardTitle className="text-xl text-white">Informações do imóvel</CardTitle>
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <CounterCard label="Quartos" value={bedrooms} onChange={setBedrooms} />
                  <CounterCard label="Banheiros" value={bathrooms} onChange={setBathrooms} />
                  <CounterCard label="Vagas" value={parking} onChange={setParking} />
                </div>
              </CardContent>
            </Card>

          </div>

          <div className="grid gap-6">
            <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.9))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.14)]">
              <CardContent className="p-6">
                <p className="text-sm leading-7 text-white/60">
                  A descrição é o centro do anúncio: combine texto, áudio transcrito e IA antes de revisar o preview.
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
                      <h3 className="mt-3 text-2xl font-semibold text-white">{title || "Titulo do imovel"}</h3>
                      <p className="mt-2 text-sm text-white/55">
                        {previewLocation || "Cidade e bairro"}
                      </p>
                      <p className="mt-4 text-2xl font-semibold text-white">{price || "Valor do imovel"}</p>
                      <p className="mt-5 text-sm leading-7 text-white/65">
                        {description || "A descricao preenchida aparecera aqui."}
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
        
      </div>
    </BrokerPageShell>
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
