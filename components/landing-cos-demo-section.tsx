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
    label: "Criar anuncio",
    icon: ImageIcon,
    placeholder: "Descreva o imovel para criar um anuncio incrivel...",
    example: "Exemplo: Apartamento 2 quartos, suite, sacada gourmet, 1 vaga, condominio com piscina em Canoas.",
  },
  {
    id: "generate_video",
    label: "Gerar video",
    icon: Video,
    placeholder: "Descreva o imovel e o estilo do video que voce quer gerar...",
    example: "Exemplo: Video vertical de 30s para apartamento com vista, foco em Instagram e visitas agendadas.",
  },
  {
    id: "create_catalog",
    label: "Criar catalogo",
    icon: ClipboardList,
    placeholder: "Explique o tipo de catalogo que voce quer montar...",
    example: "Exemplo: Catalogo premium com imoveis de alto padrao em Balneario Camboriu para enviar por WhatsApp.",
  },
  {
    id: "search_property",
    label: "Procurar imovel",
    icon: Search,
    placeholder: "Conte o tipo de imovel que voce esta procurando...",
    example: "Exemplo: Apartamento 3 quartos, suite, ate R$ 900 mil, em Porto Alegre.",
  },
  {
    id: "chat_cos",
    label: "Conversar com o COS",
    icon: Bot,
    placeholder: "Pergunte qualquer coisa ao COS...",
    example: "Exemplo: Como eu posso divulgar melhor um imovel esta semana?",
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
      setError("Escreva uma solicitacao para testar o COS.")
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
        setError(payload.error ?? "Nao foi possivel falar com o COS agora.")
        setResponse(payload)
        return
      }

      setResponse(payload)
    } catch {
      setError("Nao foi possivel falar com o COS agora.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-[920px] text-center">
      <h2 className="text-[2.15rem] font-semibold tracking-[-0.055em] text-[#111111] sm:text-[3rem]">
        Experimente o <span className="text-[#16a34a]">EME agora</span>
      </h2>
      <p className="mt-3 text-[0.98rem] text-[#68737d]">Faca uma solicitacao e veja o EME trabalhando para voce.</p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
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
            className={`landing-hover-button inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${
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
        className="mt-7 rounded-[24px] border border-black/[0.05] bg-white p-3.5 shadow-[0_14px_36px_rgba(15,23,42,0.045)]"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="landing-cos-demo-input">
            Solicitacao para o COS
          </label>
          <input
            id="landing-cos-demo-input"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={selectedAction.placeholder}
            disabled={isSending}
            className="h-[62px] flex-1 rounded-[18px] border border-black/[0.05] bg-[#fdfdfb] px-5 text-left text-base text-[#1b1f23] outline-none transition-colors placeholder:text-[#8b949c] focus:border-[#cfe7d6]"
          />
          <button
            type="submit"
            disabled={isSending}
            className="landing-hover-button inline-flex h-[62px] items-center justify-center gap-3 rounded-[18px] bg-[#16a34a] px-7 text-[15px] font-medium text-white shadow-[0_14px_28px_rgba(22,163,74,0.18)] transition-all hover:bg-[#14803d] disabled:cursor-not-allowed disabled:bg-[#7fc999]"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isSending ? "COS processando..." : "Gerar com IA"}
          </button>
        </div>

        <div className="mt-3 flex flex-col items-start gap-2.5 text-left">
          <p className="text-[13px] text-[#6f7982] sm:text-center sm:self-center">{selectedAction.example}</p>
          <p className="rounded-full bg-[#f4f8f5] px-3 py-1 text-[11px] font-medium text-[#5f6973]">
            Demonstracao publica: o COS responde na propria Landing sem acessar dados reais nem executar acoes.
          </p>
        </div>
      </form>

      {(response?.response || error) && (
        <div className="mt-5 rounded-[24px] border border-black/[0.05] bg-white px-5 py-4 text-left shadow-[0_14px_36px_rgba(15,23,42,0.045)]">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#16a34a]">
            <Bot className="size-4" />
            COS
            <span className="text-[#7a848d]">na Landing</span>
          </div>
          <div className="mt-3 whitespace-pre-line text-[14px] leading-6 text-[#27313a]">
            {error ? error : response?.response}
          </div>
          {response?.rateLimited ? (
            <p className="mt-3 text-[13px] text-[#a16207]">
              Limite temporario de demonstracao atingido. Tente novamente em instantes.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
