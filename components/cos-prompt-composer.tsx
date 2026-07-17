"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { Mic, Plus, Send, Sparkles, Square, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"

type QuickAction = {
  label: string
  message?: string
  onSelect?: () => void | Promise<void>
}

type CosPromptComposerProps = {
  prompt: string
  setPrompt: (value: string) => void
  onSubmit: () => Promise<void> | void
  onNewConversation: () => Promise<void> | void
  quickActions: QuickAction[]
  disabled?: boolean
  inputRef: RefObject<HTMLInputElement | null>
  feedback?: string
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance

type BrowserSpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: {
      transcript: string
    }
    isFinal: boolean
    length: number
  }>
}

export function CosPromptComposer({
  prompt,
  setPrompt,
  onSubmit,
  onNewConversation,
  quickActions,
  disabled = false,
  inputRef,
  feedback,
}: CosPromptComposerProps) {
  const [micState, setMicState] = useState<"idle" | "recording" | "processing" | "error">("idle")
  const [micError, setMicError] = useState("")
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null)
  const promptBeforeMicRef = useRef("")

  const speechRecognitionCtor = useMemo(() => {
    if (typeof window === "undefined") return null

    const speechWindow = window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
    }

    return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  async function handleMicToggle() {
    if (micState === "recording") {
      recognitionRef.current?.stop()
      setMicState("processing")
      return
    }

    if (!speechRecognitionCtor) {
      setMicState("error")
      setMicError("Microfone indisponivel neste navegador.")
      return
    }

    try {
      promptBeforeMicRef.current = prompt
      setMicError("")
      setMicState("recording")

      const recognition = new speechRecognitionCtor() as BrowserSpeechRecognitionInstance
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = "pt-BR"

      recognition.onresult = (event) => {
        let transcript = ""

        for (let index = 0; index < event.results.length; index += 1) {
          transcript += event.results[index]?.[0]?.transcript ?? ""
        }

        const normalized = transcript.trim()
        if (!normalized) return

        const nextPrompt = [promptBeforeMicRef.current.trim(), normalized].filter(Boolean).join(" ").trim()
        setPrompt(nextPrompt)
      }

      recognition.onerror = () => {
        setMicState("error")
        setMicError(resolveMicErrorMessage("unknown"))
      }

      recognition.onend = () => {
        const finalPrompt = (inputRef.current?.value ?? "").trim()
        if (micState === "error") return

        if (!finalPrompt) {
          setMicState("idle")
          return
        }

        setMicState("processing")
        window.setTimeout(async () => {
          if (!promptBeforeMicRef.current.trim()) {
            await onSubmit()
          } else {
            setPrompt(finalPrompt)
          }
          setMicState("idle")
        }, 120)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setMicState("error")
      setMicError("Nao foi possivel iniciar a gravacao.")
    }
  }

  return (
    <div className="border-t border-black/[0.05] px-6 py-5">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit()
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3 rounded-full bg-[#fbfbf8] px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                className="size-10 shrink-0 rounded-full border border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-white hover:text-[#050505] disabled:opacity-60"
                aria-label="Abrir acoes do COS"
              >
                <Plus className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 rounded-2xl border-black/[0.06] bg-white/95 p-2 text-[#050505] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <DropdownMenuItem
                onSelect={() => void onNewConversation()}
                className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]"
              >
                <Sparkles className="mr-2 size-4" />
                Nova conversa
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-black/[0.06]" />
              <DropdownMenuLabel className="text-[#6B7280]">Acoes rapidas</DropdownMenuLabel>
              {quickActions.map((action) => (
                <DropdownMenuItem
                  key={action.label}
                  onSelect={() => {
                    if (action.onSelect) {
                      void action.onSelect()
                      return
                    }

                    if (action.message) {
                      setPrompt(action.message)
                      window.setTimeout(() => inputRef.current?.focus(), 0)
                    }
                  }}
                  className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]"
                >
                  <Wand2 className="mr-2 size-4 text-[#7B8491]" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Input
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Fale com o COS..."
            className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-[15px] text-[#111111] shadow-none outline-none placeholder:text-[#7a8798] focus-visible:ring-0"
          />

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => void handleMicToggle()}
            disabled={disabled}
            className={`size-10 shrink-0 rounded-full border border-black/[0.06] bg-white text-[#5F6B7A] hover:bg-white hover:text-[#050505] disabled:opacity-60 ${
              micState === "recording" ? "border-[#009b3a]/30 bg-[#effaf3] text-[#009b3a]" : ""
            }`}
            aria-label="Gravar audio para o COS"
          >
            {micState === "recording" ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>

          <Button
            type="submit"
            size="icon"
            disabled={disabled}
            className="size-11 shrink-0 rounded-full bg-[#111111] text-white shadow-none hover:bg-[#050505] disabled:opacity-60"
            aria-label="Enviar mensagem ao COS"
          >
            <Send className="size-4" />
          </Button>
        </div>

        <div className="flex min-h-6 items-center justify-between gap-3">
          <p className="text-sm text-[#6f7f97]">
            {micState === "recording"
              ? "Gravando..."
              : micState === "processing"
                ? "Processando audio..."
                : micState === "error"
                  ? micError
                  : feedback || ""}
          </p>
        </div>
      </form>
    </div>
  )
}

function resolveMicErrorMessage(errorCode: string) {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") return "Permita o uso do microfone para continuar."
  if (errorCode === "no-speech") return "Nenhuma fala foi detectada."
  if (errorCode === "audio-capture") return "Nao foi possivel acessar o microfone."
  return "Nao foi possivel processar o audio."
}
