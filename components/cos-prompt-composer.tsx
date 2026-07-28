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
import { Textarea } from "@/components/ui/textarea"

type QuickAction = {
  label: string
  message?: string
  onSelect?: () => void | Promise<void>
}

type CosPromptComposerProps = {
  prompt: string
  setPrompt: (value: string) => void
  onSubmit: (promptOverride?: string) => Promise<void> | void
  onNewConversation: () => Promise<void> | void
  quickActions: QuickAction[]
  disabled?: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
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
  const micStateRef = useRef<"idle" | "recording" | "processing" | "error">("idle")
  const micHadErrorRef = useRef(false)
  const transcriptRef = useRef("")

  function updateMicState(nextState: "idle" | "recording" | "processing" | "error") {
    micStateRef.current = nextState
    setMicState(nextState)
  }

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

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    textarea.style.height = "0px"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [inputRef, prompt])

  async function handleMicToggle() {
    if (micState === "recording") {
      recognitionRef.current?.stop()
      updateMicState("processing")
      return
    }

    if (!speechRecognitionCtor) {
      updateMicState("error")
      setMicError("Microfone indisponivel neste navegador.")
      return
    }

    try {
      promptBeforeMicRef.current = prompt
      transcriptRef.current = ""
      micHadErrorRef.current = false
      setMicError("")
      updateMicState("recording")

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
        transcriptRef.current = nextPrompt
        setPrompt(nextPrompt)
      }

      recognition.onerror = (event) => {
        micHadErrorRef.current = true
        updateMicState("error")
        setMicError(resolveMicErrorMessage(event?.error ?? "unknown"))
      }

      recognition.onend = () => {
        recognitionRef.current = null
        const finalPrompt = (inputRef.current?.value ?? transcriptRef.current).trim()
        if (micHadErrorRef.current || micStateRef.current === "error") return

        if (!finalPrompt) {
          updateMicState("idle")
          return
        }

        updateMicState("processing")
        window.setTimeout(async () => {
          if (!promptBeforeMicRef.current.trim()) {
            await onSubmit(finalPrompt)
          } else {
            setPrompt(finalPrompt)
          }
          updateMicState("idle")
        }, 350)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      updateMicState("error")
      setMicError("Nao foi possivel iniciar a gravacao.")
    }
  }

  return (
    <div className="pwa-sticky-composer mx-auto w-full max-w-[44rem] px-0 pt-1 sm:px-0">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit()
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        <div className="flex min-w-0 items-end gap-2 rounded-[1.2rem] border border-black/[0.06] bg-white/94 px-2 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.05)] sm:rounded-[1.35rem] sm:border-black/[0.07] sm:bg-white sm:shadow-[0_10px_22px_rgba(15,23,42,0.06)] sm:gap-2.5 sm:px-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className="size-9 shrink-0 rounded-full border border-black/[0.05] bg-[#f7f4ef] text-[#5F6B7A] hover:bg-white hover:text-[#050505] disabled:opacity-60 sm:border-black/[0.06] sm:bg-[#fbfbf8]"
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

          <Textarea
            ref={inputRef}
            rows={1}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onFocus={() => {
              window.setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
              }, 120)
            }}
            placeholder="Fale com o COS..."
            className="min-h-0 max-h-36 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-1 py-1.5 text-[15px] leading-6 text-[#111111] shadow-none outline-none placeholder:text-[#7a8798] focus-visible:ring-0"
          />

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => void handleMicToggle()}
            disabled={disabled}
            className={`size-9 shrink-0 rounded-full border border-black/[0.05] bg-[#f7f4ef] text-[#5F6B7A] hover:bg-white hover:text-[#050505] disabled:opacity-60 sm:border-black/[0.06] sm:bg-[#fbfbf8] ${
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
            className="size-10 shrink-0 rounded-full bg-[#111111] text-white shadow-none hover:bg-[#050505] disabled:opacity-60"
            aria-label="Enviar mensagem ao COS"
          >
            <Send className="size-4" />
          </Button>
        </div>

        <div className="hidden min-h-5 items-center justify-between gap-3 px-1 sm:flex">
          <p className={`text-xs leading-5 ${micState === "error" ? "text-[#b42318]" : "text-[#6f7f97]"}`}>
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
