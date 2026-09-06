"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, Home, Plus, UserRound } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { CosLaunchCards } from "@/components/cos-launch-cards"
import { CosLaunchInlineForm } from "@/components/cos-launch-inline-form"
import { CosLaunchOperationHealth } from "@/components/cos-launch-operation-health"
import { CosPromptComposer } from "@/components/cos-prompt-composer"
import { COS_CONVERSATIONS_REFRESH_EVENT } from "@/components/use-cos-conversations"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { cosLaunchMenuGroups } from "@/lib/cos-launch/menu"
import type { CosLaunchAction, CosLaunchCard, CosLaunchForm, CosLaunchResponse } from "@/lib/cos-launch/types"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  cards?: CosLaunchCard[]
  form?: CosLaunchForm
  actions?: CosLaunchAction[]
  elapsedMs?: number
}

type PersistedConversationMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type ConversationDetailResponse = {
  messages?: PersistedConversationMessage[]
  error?: string
  code?: string
}

type ConversationCreateResponse = {
  conversation?: { id: string }
  error?: string
}

const welcome: Message = {
  id: "welcome",
  role: "assistant",
  text: "Consulte seus dados ou escolha uma ação para começar.",
}
const quickActions = [
  { id: "query:properties", label: "Meus imóveis", icon: Home },
  { id: "query:clients", label: "Meus clientes", icon: UserRound },
  { id: "query:agenda", label: "Agenda de hoje", icon: CalendarDays },
  { id: "form:client", label: "Cadastrar cliente", icon: Plus },
]

export function CosLaunchPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedConversationId = searchParams.get("conversa")?.trim() || ""
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [prompt, setPrompt] = useState("")
  const [busy, setBusy] = useState(false)
  const [isConversationLoading, setIsConversationLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const activeConversationIdRef = useRef("")
  const createConversationPromiseRef = useRef<Promise<string> | null>(null)
  const conversationLoadRequestRef = useRef(0)
  const requestInFlightRef = useRef(false)
  const bootstrapStartedRef = useRef(false)
  const skipNextLoadConversationIdRef = useRef("")
  const { profile } = useBrokerProfile()
  const firstName = profile.fullName.trim().split(/\s+/)[0] || "corretor"

  const notifyConversationRefresh = useCallback(() => {
    window.dispatchEvent(new Event(COS_CONVERSATIONS_REFRESH_EVENT))
  }, [])

  const createConversation = useCallback(async () => {
    if (createConversationPromiseRef.current) return createConversationPromiseRef.current

    const creation = (async () => {
      conversationLoadRequestRef.current += 1
      setIsConversationLoading(true)
      const response = await fetch("/api/assistant/eme/conversations", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationCreateResponse | null
      if (!response.ok || !data?.conversation?.id) {
        throw new Error(data?.error || "Não foi possível criar a conversa.")
      }

      const conversationId = data.conversation.id
      activeConversationIdRef.current = conversationId
      skipNextLoadConversationIdRef.current = conversationId
      setMessages([{ ...welcome, id: crypto.randomUUID() }])
      setFeedback(null)
      router.replace(`/corretor?conversa=${encodeURIComponent(conversationId)}`, { scroll: false })
      notifyConversationRefresh()
      window.setTimeout(() => inputRef.current?.focus(), 0)
      return conversationId
    })()

    createConversationPromiseRef.current = creation
    try {
      return await creation
    } finally {
      if (createConversationPromiseRef.current === creation) createConversationPromiseRef.current = null
      setIsConversationLoading(false)
    }
  }, [notifyConversationRefresh, router])

  const loadConversation = useCallback(async (conversationId: string) => {
    const requestId = ++conversationLoadRequestRef.current
    setIsConversationLoading(true)
    setFeedback(null)
    setMessages([])

    try {
      const response = await fetch(`/api/assistant/eme/conversations/${encodeURIComponent(conversationId)}`, {
        credentials: "include",
        cache: "no-store",
      })
      const data = (await response.json().catch(() => null)) as ConversationDetailResponse | null
      if (!response.ok) {
        if (response.status === 404 && data?.code === "COS_CONVERSATION_NOT_FOUND") {
          activeConversationIdRef.current = ""
          await createConversation()
          return
        }
        throw new Error(data?.error || "Não foi possível abrir a conversa.")
      }
      if (requestId !== conversationLoadRequestRef.current || activeConversationIdRef.current !== conversationId) return

      const restored = (data?.messages ?? []).map<Message>((message) => ({
        id: message.id,
        role: message.role,
        text: message.content,
      }))
      setMessages(restored.length > 0 ? restored : [{ ...welcome, id: crypto.randomUUID() }])
    } catch (error) {
      if (requestId !== conversationLoadRequestRef.current) return
      const message = error instanceof Error ? error.message : "Não foi possível abrir a conversa."
      setMessages([{ ...welcome, id: crypto.randomUUID() }])
      setFeedback(message)
    } finally {
      if (requestId === conversationLoadRequestRef.current) setIsConversationLoading(false)
    }
  }, [createConversation])

  useEffect(() => {
    if (requestedConversationId) {
      activeConversationIdRef.current = requestedConversationId
      if (skipNextLoadConversationIdRef.current === requestedConversationId) {
        skipNextLoadConversationIdRef.current = ""
        return
      }
      void loadConversation(requestedConversationId)
      return
    }

    if (bootstrapStartedRef.current) return
    bootstrapStartedRef.current = true
    void createConversation().catch((error: unknown) => {
      setFeedback(error instanceof Error ? error.message : "Não foi possível criar a conversa.")
    })
  }, [createConversation, loadConversation, requestedConversationId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy, isConversationLoading])

  async function request(body: { message?: string; action?: string; payload?: Record<string, unknown> }) {
    if (requestInFlightRef.current) return false
    requestInFlightRef.current = true
    setBusy(true)
    setFeedback(null)
    let conversationId = activeConversationIdRef.current
    try {
      conversationId = conversationId || await createConversation()
      const response = await fetch("/api/cos-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, conversationId }),
      })
      const data = (await response.json()) as CosLaunchResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.")

      if (activeConversationIdRef.current === conversationId) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: data.message,
            cards: data.cards,
            form: data.form,
            actions: data.actions,
            elapsedMs: data.elapsedMs,
          },
        ])
      }
      notifyConversationRefresh()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a solicitação."
      if (!conversationId || activeConversationIdRef.current === conversationId) {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: message }])
        setFeedback(message)
      }
      return false
    } finally {
      requestInFlightRef.current = false
      setBusy(false)
    }
  }

  async function submitMessage() {
    const message = prompt.trim()
    if (!message || busy || requestInFlightRef.current) return

    setPrompt("")
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }])
    await request({ message })
  }

  async function runAction(action: string, label?: string) {
    if (busy || requestInFlightRef.current) return

    if (action === "conversation:new") {
      try {
        await createConversation()
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Não foi possível criar a conversa.")
      }
      return
    }

    if (label) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: label }])
    }
    await request({ action, message: label })
  }

  async function submitForm(messageId: string, form: CosLaunchForm, payload: Record<string, unknown>) {
    if (busy || requestInFlightRef.current) return
    const success = await request({ action: `submit:${form.kind}`, message: form.submitLabel, payload })
    if (success) {
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, form: undefined } : message)),
      )
    }
  }

  return (
    <BrokerPageShell
      title="COS"
      eyebrow="Portal do corretor"
      subtitle="Operações rápidas com dados reais do EME"
      variant="cos"
      contentClassName="!p-0"
    >
      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-transparent md:bg-[radial-gradient(circle_at_top_left,rgba(214,244,229,.52),transparent_38%),linear-gradient(180deg,#fbfcfa,#f4f7f4)]">
        <CosLaunchOperationHealth />
        <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-6xl flex-1 flex-col px-4 pb-3 pt-2 sm:px-6 lg:pb-4 lg:pt-7 lg:pr-[260px]">
          <header className="mb-3 shrink-0 lg:mb-2">
            <h1 className="text-[2.1rem] font-medium leading-[1.05] tracking-[-0.035em] text-slate-950 sm:text-[2.2rem] lg:text-[2rem] lg:tracking-[-0.025em]">
              Olá, {firstName}.
            </h1>
          </header>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:gap-1.5">
            {quickActions.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => void runAction(item.id, item.label)}
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-slate-200/65 bg-white/70 px-2.5 text-[10px] font-medium text-slate-600 shadow-[0_3px_10px_rgba(15,23,42,.035)] backdrop-blur-xl transition hover:border-emerald-200 hover:bg-white hover:text-emerald-800 disabled:opacity-50 lg:min-h-9 lg:bg-white/75 lg:px-3 lg:text-[11px] lg:font-semibold lg:shadow-[0_4px_14px_rgba(15,23,42,.04)]"
              >
                <item.icon className="size-3 text-emerald-700 lg:size-3.5" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-white/80 bg-white/28 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] sm:rounded-[30px] sm:px-5 sm:py-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                {isConversationLoading ? (
                  <div className="flex w-fit items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-xs text-slate-500 shadow-sm">
                    <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                    Carregando conversa...
                  </div>
                ) : messages.map((message) => (
                  <section key={message.id} className={message.role === "user" ? "ml-auto max-w-2xl" : "max-w-4xl"}>
                    <div
                      className={
                        message.id === "welcome"
                          ? "w-full bg-transparent px-1 py-0.5 text-xs italic leading-5 text-slate-400 shadow-none sm:text-[13px]"
                          : message.role === "user"
                          ? "ml-auto w-fit rounded-[20px_20px_6px_20px] bg-emerald-950 px-3.5 py-2.5 text-sm text-white shadow-sm"
                          : "w-fit max-w-2xl rounded-[6px_20px_20px_20px] border border-slate-100/80 bg-white/80 px-3.5 py-2.5 text-sm leading-6 text-slate-700 shadow-[0_5px_18px_rgba(15,23,42,.04)] backdrop-blur-xl"
                      }
                    >
                      {message.text}
                      {message.role === "assistant" && typeof message.elapsedMs === "number" ? (
                        <span className="ml-2 text-[10px] text-slate-400">{message.elapsedMs} ms</span>
                      ) : null}
                    </div>
                    {message.cards?.length ? <div className="mt-3"><CosLaunchCards cards={message.cards} /></div> : null}
                    {message.actions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action) =>
                          action.href ? (
                            <Link
                              key={action.id}
                              href={action.href}
                              className="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-emerald-800"
                            >
                              {action.label}
                            </Link>
                          ) : (
                            <button
                              key={action.id}
                              type="button"
                              disabled={busy}
                              onClick={() => void runAction(action.id, action.label)}
                              className="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold text-emerald-800"
                            >
                              {action.label}
                            </button>
                          ),
                        )}
                      </div>
                    ) : null}
                    {message.form ? (
                      <div className="mt-3">
                        <CosLaunchInlineForm
                          form={message.form}
                          busy={busy}
                          onCancel={() =>
                            setMessages((current) =>
                              current.map((item) =>
                                item.id === message.id ? { ...item, form: undefined } : item,
                              ),
                            )
                          }
                          onSubmit={(payload) => submitForm(message.id, message.form!, payload)}
                        />
                      </div>
                    ) : null}
                  </section>
                ))}

                {busy ? (
                  <div className="flex w-fit items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-xs text-slate-500 shadow-sm">
                    <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                    Consultando o EME...
                  </div>
                ) : null}
                <div ref={endRef} />
              </div>
            </div>

            <div data-testid="cos-composer-dock" className="sticky bottom-0 z-10 shrink-0 px-0 py-2 sm:px-1">
              <div className="mx-auto max-w-4xl">
                <CosPromptComposer
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onSubmit={submitMessage}
                  onNewConversation={() => runAction("conversation:new")}
                  disabled={busy || isConversationLoading}
                  inputRef={inputRef}
                  feedback={feedback ?? undefined}
                  sticky={false}
                  menuGroups={cosLaunchMenuGroups}
                  attachmentOptions={[]}
                  onMenuAction={(action) => runAction(action.id, action.label)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </BrokerPageShell>
  )
}
