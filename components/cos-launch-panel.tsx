"use client"

import Link from "next/link"
import { CalendarDays, Home, Plus, UserRound } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { CosLaunchCards } from "@/components/cos-launch-cards"
import { CosLaunchInlineForm } from "@/components/cos-launch-inline-form"
import { CosLaunchOperationHealth } from "@/components/cos-launch-operation-health"
import { CosPromptComposer } from "@/components/cos-prompt-composer"
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

const welcome: Message = {
  id: "welcome",
  role: "assistant",
  text: "Olá. Consulte seus dados ou escolha uma ação para começar.",
}
const quickActions = [
  { id: "query:properties", label: "Meus imóveis", icon: Home },
  { id: "query:clients", label: "Meus clientes", icon: UserRound },
  { id: "query:agenda", label: "Agenda de hoje", icon: CalendarDays },
  { id: "form:client", label: "Cadastrar cliente", icon: Plus },
]

export function CosLaunchPanel() {
  const [messages, setMessages] = useState<Message[]>([welcome])
  const [prompt, setPrompt] = useState("")
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  async function request(body: { message?: string; action?: string; payload?: Record<string, unknown> }) {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch("/api/cos-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as CosLaunchResponse & { error?: string }
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.")

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
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a solicitação."
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: message }])
      setFeedback(message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submitMessage() {
    const message = prompt.trim()
    if (!message || busy) return

    setPrompt("")
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: message }])
    await request({ message })
  }

  async function runAction(action: string, label?: string) {
    if (action === "conversation:new") {
      setMessages([{ ...welcome, id: crypto.randomUUID(), text: "Nova conversa iniciada. O que você deseja fazer?" }])
      setFeedback(null)
      return
    }

    if (label) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: label }])
    }
    await request({ action })
  }

  async function submitForm(messageId: string, form: CosLaunchForm, payload: Record<string, unknown>) {
    const success = await request({ action: `submit:${form.kind}`, payload })
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
      <div className="relative flex h-[calc(100dvh-108px)] min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(214,244,229,.52),transparent_38%),linear-gradient(180deg,#fbfcfa,#f4f7f4)]">
        <CosLaunchOperationHealth />
        <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 lg:pr-[260px]">
          <div className="mb-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {quickActions.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => void runAction(item.id, item.label)}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-slate-200/70 bg-white/75 px-3 text-[11px] font-semibold text-slate-600 shadow-[0_4px_14px_rgba(15,23,42,.04)] backdrop-blur-xl transition hover:border-emerald-200 hover:bg-white hover:text-emerald-800 disabled:opacity-50"
              >
                <item.icon className="size-3.5 text-emerald-700" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] border border-white/80 bg-white/28 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] sm:px-5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                {messages.map((message) => (
                  <section key={message.id} className={message.role === "user" ? "ml-auto max-w-2xl" : "max-w-4xl"}>
                    <div
                      className={
                        message.role === "user"
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

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/70 bg-white/68 px-2 py-2 backdrop-blur-2xl sm:px-3">
              <div className="mx-auto max-w-4xl">
                <CosPromptComposer
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onSubmit={submitMessage}
                  onNewConversation={() => runAction("conversation:new")}
                  disabled={busy}
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
