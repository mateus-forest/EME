"use client"

import type { FormEvent } from "react"
import { useMemo, useState } from "react"
import { Bot, ClipboardList, ImageIcon, Loader2, Search, Sparkles, Video } from "lucide-react"

type LandingDemoMode = "create_ad" | "generate_video" | "create_catalog" | "search_property" | "chat_cos"

type DemoAction = {
  id: LandingDemoMode
  label: string
  icon: typeof ImageIcon
  placeholder: string
  example: string
}

type DemoResponse = {
  response?: string
  action?: string
  demo?: boolean
  rateLimited?: boolean
  error?: string
}

const demoActions: DemoAction[] = [
  {
    id: "create_ad",
    label: "Criar anúncio",
    icon: ImageIcon,
    placeholder: "Descreva o imóvel para criar um anúncio incrível...",
    example: "Exemplo: Apartamento 2 quartos, suíte, sacada gourmet, 1 vaga, condomínio com piscina em Canoas.",
  },
  {
    id: "generate_video",
    label: "Gerar vídeo",
    icon: Video,
    placeholder: "Descreva o imóvel e o estilo do vídeo que você quer gerar...",
    example: "Exemplo: Vídeo vertical de 30s para apartamento com vista, foco em Instagram e visitas agendadas.",
  },
  {
    id: "create_catalog",
    label: "Criar catálogo",
    icon: ClipboardList,
    placeholder: "Explique o tipo de catálogo que você quer montar...",
    example: "Exemplo: Catálogo premium com imóveis de alto padrão em Balneário Camboriú para enviar por WhatsApp.",
  },
  {
    id: "search_property",
    label: "Procurar imóvel",
    icon: Search,
    placeholder: "Conte o tipo de imóvel que você está procurando...",
    example: "Exemplo: Apartamento 3 quartos, suíte, até R$ 900 mil, em Porto Alegre.",
  },
  {
    id: "chat_cos",
    label: "Conversar com o COS",
    icon: Bot,
    placeholder: "Pergunte qualquer coisa ao COS...",
    example: "Exemplo: Como eu posso divulgar melhor um imóvel esta semana?",
  },
] as const

export function LandingCosDemoSection() {
  const [selectedMode, setSelectedMode] = useState<LandingDemoMode>("create_ad")
  const [message, setMessage] = useState("")
  const [response, setResponse] = useState<DemoResponse | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAction = useMemo(
    () => demoActions.find((action) => action.id === selectedMode) ?? demoActions[0],
    [selectedMode],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setError("Escreva uma solicitação para testar o COS.")
      return
    }

    setIsSending(true)
    setError(null)
    setResponse(null)

    try {
      const apiResponse = await fetch("/api/assistant/eme-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          mode: selectedMode,
        }),
      })

      const payload = (await apiResponse.json()) as DemoResponse

      if (!apiResponse.ok) {
        setError(payload.error ?? "Não foi possível falar com o COS agora.")
        setResponse(payload)
        return
      }

      setResponse(payload)
    } catch {
      setError("Não foi possível falar com o COS agora.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[980px] text-center">
      <h2 className="text-[2.55rem] font-semibold tracking-[-0.055em] text-[#111111] sm:text-[3.45rem]">
        Experimente o <span className="text-[#16a34a]">EME agora</span>
      </h2>
      <p className="mt-4 text-[1.05rem] text-[#68737d]">Faça uma solicitação e veja o EME trabalhando para você.</p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {demoActions.map((action) => {
          const Icon = action.icon
          const isActive = action.id === selectedMode

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setSelectedMode(action.id)
                setError(null)
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[#dceddf] bg-[#eef8f1] text-[#157945]"
                  : "border-transparent bg-transparent text-[#39424a] hover:bg-white"
              }`}
            >
              <Icon className="size-4" />
              {action.label}
            </button>
          )
        })}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-9 rounded-[28px] border border-black/[0.055] bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]"
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="sr-only" htmlFor="landing-cos-demo-input">
            Solicitação para o COS
          </label>
          <input
            id="landing-cos-demo-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={selectedAction.placeholder}
            disabled={isSending}
            className="h-[72px] flex-1 rounded-[22px] border border-black/[0.055] bg-[#fdfdfb] px-6 text-left text-lg text-[#1b1f23] outline-none transition-colors placeholder:text-[#8b949c] focus:border-[#cfe7d6]"
          />
          <button
            type="submit"
            disabled={isSending}
            className="inline-flex h-[72px] items-center justify-center gap-3 rounded-[22px] bg-[#16a34a] px-8 text-base font-medium text-white shadow-[0_16px_32px_rgba(22,163,74,0.2)] transition-all hover:bg-[#14803d] disabled:cursor-not-allowed disabled:bg-[#7fc999]"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isSending ? "COS processando..." : "Gerar com IA"}
          </button>
        </div>

        <div className="mt-4 flex flex-col items-start gap-3 text-left">
          <p className="text-[15px] text-[#6f7982] sm:text-center sm:self-center">{selectedAction.example}</p>
          <p className="rounded-full bg-[#f4f8f5] px-3 py-1 text-xs font-medium text-[#5f6973]">
            Demonstração pública: o COS responde na própria Landing sem acessar dados reais nem executar ações.
          </p>
        </div>
      </form>

      {(response?.response || error) && (
        <div className="mt-6 rounded-[28px] border border-black/[0.055] bg-white px-6 py-5 text-left shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-2 text-sm font-medium text-[#16a34a]">
            <Bot className="size-4" />
            COS
            <span className="text-[#7a848d]">na Landing</span>
          </div>
          <div className="mt-4 whitespace-pre-line text-[15px] leading-7 text-[#27313a]">
            {error ? error : response?.response}
          </div>
          {response?.rateLimited ? (
            <p className="mt-4 text-sm text-[#a16207]">Limite temporário de demonstração atingido. Tente novamente em instantes.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
