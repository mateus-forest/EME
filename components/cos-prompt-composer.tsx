"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, RefObject } from "react"
import {
  FileText,
  Files,
  HelpCircle,
  ImageIcon,
  Mic,
  MessageSquarePlus,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Square,
  Video,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type CosComposerAttachment = {
  id: string
  name: string
  type: string
  size: number
  category: "image" | "document" | "video" | "files"
  dataUrl?: string
  textContent?: string
}

export type CosPromptComposerMenuAction = {
  id: string
  label: string
}

export type CosPromptComposerMenuGroup = {
  id: string
  label: string
  items: CosPromptComposerMenuAction[]
}

type CosPromptComposerProps = {
  prompt: string
  setPrompt: (value: string) => void
  onSubmit: (input?: { promptOverride?: string; attachments?: CosComposerAttachment[] }) => Promise<void> | void
  onNewConversation?: () => Promise<void> | void
  disabled?: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
  feedback?: string
  sticky?: boolean
  containerClassName?: string
  menuGroups?: CosPromptComposerMenuGroup[]
  onMenuAction?: (action: CosPromptComposerMenuAction) => Promise<void> | void
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

type AttachmentPickerMode = "image" | "document" | "video" | "files"

const ACCEPT_MAP: Record<AttachmentPickerMode, string> = {
  image: "image/*",
  document: ".pdf,.doc,.docx,.xml,.txt,.csv,.json",
  video: "video/*",
  files: "*",
}

export function CosPromptComposer({
  prompt,
  setPrompt,
  onSubmit,
  onNewConversation,
  disabled = false,
  inputRef,
  feedback,
  sticky = true,
  containerClassName,
  menuGroups,
  onMenuAction,
}: CosPromptComposerProps) {
  const [micState, setMicState] = useState<"idle" | "recording" | "processing" | "error">("idle")
  const [micError, setMicError] = useState("")
  const [attachments, setAttachments] = useState<CosComposerAttachment[]>([])
  const [pickerMode, setPickerMode] = useState<AttachmentPickerMode>("files")
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(false)
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null)
  const promptBeforeMicRef = useRef("")
  const micStateRef = useRef<"idle" | "recording" | "processing" | "error">("idle")
  const micHadErrorRef = useRef(false)
  const transcriptRef = useRef("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setMicError("Microfone indisponível neste navegador.")
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
            await onSubmit({ promptOverride: finalPrompt, attachments })
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
      setMicError("Não foi possível iniciar a gravação.")
    }
  }

  function openPicker(mode: AttachmentPickerMode) {
    setPickerMode(mode)
    window.setTimeout(() => fileInputRef.current?.click(), 0)
  }

  async function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    setIsPreparingAttachments(true)
    try {
      const nextAttachments = await Promise.all(files.map((file) => serializeAttachment(file, pickerMode)))
      setAttachments((current) => {
        const existingKeys = new Set(current.map((item) => `${item.name}:${item.size}:${item.type}`))
        const unique = nextAttachments.filter((item) => !existingKeys.has(`${item.name}:${item.size}:${item.type}`))
        return [...current, ...unique]
      })
    } finally {
      setIsPreparingAttachments(false)
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  async function handleSubmit() {
    await onSubmit({ attachments })
    setAttachments([])
  }

  async function handleMenuAction(action: CosPromptComposerMenuAction) {
    await onMenuAction?.(action)
  }

  return (
    <div
      className={cn(
        sticky && "pwa-sticky-composer",
        "mx-auto w-full max-w-[44rem] px-0 pt-1 sm:px-0",
        containerClassName,
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept={ACCEPT_MAP[pickerMode]}
        multiple
        onChange={(event) => void handleAttachmentSelection(event)}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
        className="flex min-w-0 flex-col gap-1.5"
      >
        {attachments.length > 0 ? (
          <div className="mb-1 flex flex-wrap gap-2 px-1">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-black/[0.06] bg-white/92 px-3 py-2 text-sm text-[#273444] shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
              >
                <AttachmentIcon category={attachment.category} className="size-4 shrink-0 text-[#6f7f97]" />
                <span className="truncate">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                  className="rounded-full p-0.5 text-[#7a8798] transition-colors hover:bg-black/[0.04] hover:text-[#111111]"
                  aria-label={`Remover ${attachment.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex min-w-0 items-end gap-2 rounded-[1.2rem] border border-black/[0.06] bg-white/94 px-2 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.05)] sm:rounded-[1.35rem] sm:border-black/[0.07] sm:bg-white sm:shadow-[0_10px_22px_rgba(15,23,42,0.06)] sm:gap-2.5 sm:px-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled || isPreparingAttachments}
                className="size-9 shrink-0 rounded-full border border-black/[0.05] bg-[#f7f4ef] text-[#5F6B7A] hover:bg-white hover:text-[#050505] disabled:opacity-60 sm:border-black/[0.06] sm:bg-[#fbfbf8]"
                aria-label="Abrir menu de ações do COS"
              >
                <Paperclip className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 rounded-2xl border-black/[0.06] bg-white/95 p-2 text-[#050505] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl"
            >
              {onNewConversation ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => void onNewConversation()}
                    className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]"
                  >
                    <MessageSquarePlus className="mr-2 size-4 text-[#7B8491]" />
                    Nova conversa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 bg-black/[0.06]" />
                </>
              ) : null}

              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]">
                  <Paperclip className="mr-2 size-4 text-[#7B8491]" />
                  Anexar
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56 rounded-2xl border-black/[0.06] bg-white/95 p-2 text-[#050505] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
                  <DropdownMenuItem onSelect={() => openPicker("image")} className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]">
                    <ImageIcon className="mr-2 size-4 text-[#7B8491]" />
                    Imagem
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openPicker("document")} className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]">
                    <FileText className="mr-2 size-4 text-[#7B8491]" />
                    Documento
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openPicker("video")} className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]">
                    <Video className="mr-2 size-4 text-[#7B8491]" />
                    Vídeo
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openPicker("files")} className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]">
                    <Files className="mr-2 size-4 text-[#7B8491]" />
                    Múltiplos arquivos
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              {menuGroups?.map((group) => (
                <DropdownMenuSub key={group.id}>
                  <DropdownMenuSubTrigger className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]">
                    {group.id === "skills" ? <Sparkles className="mr-2 size-4 text-[#7B8491]" /> : null}
                    {group.id === "queries" ? <Search className="mr-2 size-4 text-[#7B8491]" /> : null}
                    {group.id === "help" ? <HelpCircle className="mr-2 size-4 text-[#7B8491]" /> : null}
                    {group.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-64 rounded-2xl border-black/[0.06] bg-white/95 p-2 text-[#050505] shadow-[0_18px_60px_rgba(15,23,42,0.10)] backdrop-blur-xl">
                    {group.items.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onSelect={() => void handleMenuAction(item)}
                        className="rounded-xl text-[#050505] focus:bg-[#f6f7f4]"
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
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
            disabled={disabled || isPreparingAttachments}
            className={`size-9 shrink-0 rounded-full border border-black/[0.05] bg-[#f7f4ef] text-[#5F6B7A] hover:bg-white hover:text-[#050505] disabled:opacity-60 sm:border-black/[0.06] sm:bg-[#fbfbf8] ${
              micState === "recording" ? "border-[#009b3a]/30 bg-[#effaf3] text-[#009b3a]" : ""
            }`}
            aria-label="Gravar áudio para o COS"
          >
            {micState === "recording" ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>

          <Button
            type="submit"
            size="icon"
            disabled={disabled || isPreparingAttachments}
            className="size-10 shrink-0 rounded-full bg-[#111111] text-white shadow-none hover:bg-[#050505] disabled:opacity-60"
            aria-label="Enviar mensagem ao COS"
          >
            <Send className="size-4" />
          </Button>
        </div>

        <div className="hidden min-h-5 items-center justify-between gap-3 px-1 sm:flex">
          <p className={`text-xs leading-5 ${micState === "error" ? "text-[#b42318]" : "text-[#6f7f97]"}`}>
            {isPreparingAttachments
              ? "Preparando anexos..."
              : micState === "recording"
                ? "Gravando..."
                : micState === "processing"
                  ? "Processando áudio..."
                  : micState === "error"
                    ? micError
                    : feedback || ""}
          </p>
        </div>
      </form>
    </div>
  )
}

function AttachmentIcon({ category, className }: { category: CosComposerAttachment["category"]; className?: string }) {
  if (category === "image") return <ImageIcon className={className} />
  if (category === "video") return <Video className={className} />
  if (category === "document") return <FileText className={className} />
  return <Files className={className} />
}

async function serializeAttachment(file: File, category: AttachmentPickerMode): Promise<CosComposerAttachment> {
  const serialized: CosComposerAttachment = {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    category,
  }

  if (category === "image" && file.size <= 8 * 1024 * 1024) {
    serialized.dataUrl = await readFileAsDataUrl(file)
  }

  if (shouldReadAsText(file)) {
    const content = await file.text()
    serialized.textContent = content.slice(0, 120_000)
  }

  return serialized
}

function shouldReadAsText(file: File) {
  const name = file.name.toLowerCase()
  return (
    file.type.includes("xml") ||
    file.type.startsWith("text/") ||
    name.endsWith(".xml") ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".json")
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Não foi possível ler o anexo."))
    reader.readAsDataURL(file)
  })
}

function resolveMicErrorMessage(errorCode: string) {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") return "Permita o uso do microfone para continuar."
  if (errorCode === "no-speech") return "Nenhuma fala foi detectada."
  if (errorCode === "audio-capture") return "Não foi possível acessar o microfone."
  return "Não foi possível processar o áudio."
}
