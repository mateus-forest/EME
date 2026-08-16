"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { type CSSProperties, type FormEvent, useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  ArrowRight,
  CalendarCheck,
  Check,
  FileSignature,
  FileText,
  MessageCircle,
  Sparkles,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import type { StructuredInputKind } from "@/lib/structured-fields"
import { clearLegacyAuthState, getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { CRECI_UF_OPTIONS } from "@/lib/creci-validation"

const easeOut = [0.16, 1, 0.3, 1] as const
const INTERVAL = 4200

type AuthMode = "login" | "signup"

type Scene = {
  word: string
  status: string
}

const SCENES: Scene[] = [
  { word: "cria.", status: "Criando anúncio" },
  { word: "publica.", status: "Publicando catálogo" },
  { word: "agenda.", status: "Agendando visita" },
  { word: "gera propostas.", status: "Gerando proposta" },
  { word: "organiza contratos.", status: "Organizando contrato" },
  { word: "acompanha clientes.", status: "Acompanhando cliente" },
]

const AUTH_THEME = {
  "--background": "#fcfcf8",
  "--foreground": "#16181d",
  "--card": "#ffffff",
  "--card-foreground": "#16181d",
  "--popover": "#ffffff",
  "--popover-foreground": "#16181d",
  "--primary": "#18a249",
  "--primary-foreground": "#f8fff9",
  "--secondary": "#f2f4ee",
  "--secondary-foreground": "#1d232b",
  "--muted": "#eef1eb",
  "--muted-foreground": "#6e7784",
  "--accent": "#def9e8",
  "--accent-foreground": "#176f3c",
  "--destructive": "#e5484d",
  "--destructive-foreground": "#ffffff",
  "--border": "rgba(22, 24, 29, 0.10)",
  "--input": "#ffffff",
  "--ring": "rgba(24, 162, 73, 0.22)",
  "--brand": "#18a249",
  "--brand-dark": "#11823a",
  "--radius": "1rem",
} as CSSProperties

export function AuthV0Experience() {
  const pathname = usePathname()
  const mode = pathname.startsWith("/cadastro") ? "signup" : "login"

  return (
    <main
      className="grid min-h-screen grid-cols-1 overflow-hidden bg-[var(--background)] text-[var(--foreground)] md:h-[100svh] md:grid-cols-[3fr_2fr]"
      style={AUTH_THEME}
    >
      <section className="hidden md:block">
        <AuthShowcase />
      </section>
      <section className="relative bg-[var(--background)]">
        <Link href="/" aria-label="EME - início" className="absolute left-6 top-6 z-10 flex w-fit items-center md:hidden">
          <Image src="/eme-logo.png" alt="EME" width={92} height={40} priority className="h-7 w-auto" />
        </Link>
        <AuthPanel mode={mode} />
      </section>
    </main>
  )
}

function AuthPanel({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isLogin = mode === "login"

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [creci, setCreci] = useState("")
  const [creciUf, setCreciUf] = useState("")
  const [signupError, setSignupError] = useState("")

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false)
  const [recoveryFeedback, setRecoveryFeedback] = useState("")

  useEffect(() => {
    setLoginError("")
    setSignupError("")
  }, [mode])

  const currentError = isLogin ? loginError : signupError

  const heading = isLogin
    ? { title: "Bem-vindo de volta", subtitle: "Acesse seu painel e continue de onde parou." }
    : { title: "Crie sua conta", subtitle: "Comece a deixar o EME trabalhar por você." }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setLoginError("")

    const payload = {
      email: email.trim().toLowerCase(),
      password,
    }

    if (!payload.email || !payload.password) {
      setLoginError("Email e senha são obrigatórios.")
      setIsSubmitting(false)
      return
    }

    try {
      clearLegacyAuthState()

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = (await response.json().catch(() => null)) as
        | { user: AuthenticatedUser }
        | { error?: string }
        | null

      if (!response.ok || !data || !("user" in data)) {
        setLoginError(data && "error" in data && data.error ? data.error : "Não foi possível entrar agora.")
        return
      }

      const next =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null
      const fallbackRoute = getDefaultRouteByRole(data.user.role)
      const targetRoute = next && next.startsWith("/") ? next : fallbackRoute

      router.push(targetRoute)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setSignupError("")

    if (!creciUf || !creci.trim()) {
      setSignupError("Informe a UF e o número do CRECI.")
      setIsSubmitting(false)
      return
    }

    try {
      clearLegacyAuthState()

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          role: "BROKER",
          name,
          email,
          phone,
          creci,
          creciUf,
          password,
        }),
      })

      const data = (await response.json().catch(() => null)) as
        | { user: AuthenticatedUser }
        | { error?: string }
        | null

      if (!response.ok || !data || !("user" in data)) {
        setSignupError(data && "error" in data && data.error ? data.error : "Não foi possível criar sua conta agora.")
        return
      }

      router.push(getDefaultRouteByRole(data.user.role))
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleRecoverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsRecoverySubmitting(true)

    window.setTimeout(() => {
      setRecoveryFeedback("Se existir uma conta com este email, você receberá instruções para redefinir sua senha.")
      setRecoveryEmail("")
      setIsRecoverySubmitting(false)
    }, 500)
  }

  function navigateTo(targetMode: AuthMode) {
    const targetRoute = targetMode === "login" ? "/login" : pathname === "/cadastro/corretor" ? "/cadastro/corretor" : "/cadastro"
    router.replace(targetRoute)
  }

  return (
    <>
      <div className="flex h-full items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="relative mb-8 flex rounded-full border border-[color:var(--border)] bg-[color:rgba(242,244,238,0.82)] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
            {(["login", "signup"] as AuthMode[]).map((item) => {
              const active = mode === item

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => navigateTo(item)}
                  className="relative z-10 flex-1 rounded-full py-2 text-sm font-medium transition-colors duration-300"
                  style={{ color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                >
                  {active ? (
                    <motion.span
                      layoutId="auth-pill"
                      transition={{ duration: 0.6, ease: easeOut }}
                      className="absolute inset-0 -z-10 rounded-full bg-[var(--primary)] shadow-[0_12px_32px_rgba(24,162,73,0.24)]"
                    />
                  ) : null}
                  {item === "login" ? "Entrar" : "Criar conta"}
                </button>
              )
            })}
          </div>

          <div className="mb-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.55, ease: easeOut }}
              >
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">{heading.title}</h2>
                <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">{heading.subtitle}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.form
            layout
            transition={{ duration: 0.6, ease: easeOut }}
            onSubmit={isLogin ? handleLoginSubmit : handleSignupSubmit}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="flex flex-col gap-4"
              >
                {isLogin ? null : (
                  <>
                    <Field
                      label="Nome completo"
                      type="text"
                      value={name}
                      onChange={setName}
                      placeholder="Seu nome"
                      autoComplete="name"
                    />
                    <Field
                      label="WhatsApp"
                      type="tel"
                      kind="phone"
                      value={phone}
                      onChange={setPhone}
                      placeholder="(11) 99999-9999"
                      autoComplete="tel"
                    />
                    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-[var(--muted-foreground)]">UF</span>
                        <select
                          value={creciUf}
                          onChange={(event) => setCreciUf(event.target.value)}
                          required
                          aria-label="UF do CRECI"
                          className="h-11 rounded-xl border border-[color:var(--border)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[color:var(--ring)]"
                        >
                          <option value="">UF</option>
                          {CRECI_UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </label>
                      <Field
                        label="Número do CRECI"
                        type="text"
                        value={creci}
                        onChange={(value) => setCreci(value.replace(/\D/g, ""))}
                        placeholder="123456"
                        autoComplete="off"
                      />
                    </div>
                  </>
                )}
                <Field
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="voce@email.com"
                  autoComplete="email"
                />
                <Field
                  label="Senha"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />

                {isLogin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(email)
                      setRecoveryFeedback("")
                      setForgotPasswordOpen(true)
                    }}
                    className="-mt-1 self-end text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--brand)]"
                  >
                    Esqueci minha senha
                  </button>
                ) : null}
              </motion.div>
            </AnimatePresence>

            {currentError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {currentError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] py-3 text-sm font-medium text-[var(--primary-foreground)] transition-transform duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`${mode}-${isSubmitting ? "loading" : "idle"}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4, ease: easeOut }}
                >
                  {isSubmitting ? (isLogin ? "Entrando..." : "Criando conta...") : isLogin ? "Entrar" : "Criar conta"}
                </motion.span>
              </AnimatePresence>
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2} />
            </button>
          </motion.form>

          <p className="mt-7 text-center text-sm text-[var(--muted-foreground)]">
            {isLogin ? "Ainda não tem conta?" : "Já tem uma conta?"}{" "}
            <button
              type="button"
              onClick={() => navigateTo(isLogin ? "signup" : "login")}
              className="font-medium text-[var(--brand)] transition-colors hover:text-[var(--brand-dark)]"
            >
              {isLogin ? "Criar conta" : "Entrar"}
            </button>
          </p>

          {!isLogin ? (
            <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
              O cadastro é criado no fluxo de corretor e mantém sua autenticação real no EME.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog
        open={forgotPasswordOpen}
        onOpenChange={(open) => {
          setForgotPasswordOpen(open)
          if (!open) {
            setIsRecoverySubmitting(false)
          }
        }}
      >
        <DialogContent className="max-w-md rounded-[1.75rem] border-[color:var(--border)] bg-white p-0 text-[#16181d] shadow-[0_30px_80px_rgba(17,24,39,0.14)]">
          <div className="p-6 sm:p-7">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-semibold text-[#16181d]">Recuperar senha</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-[#6e7784]">
                Informe seu email para solicitar a redefinição de senha quando a integração com backend estiver conectada.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleRecoverySubmit} className="mt-6 space-y-5">
              <div className="space-y-2">
                <label htmlFor="recovery-email" className="text-sm font-medium text-[#374151]">
                  Email
                </label>
                <Input
                  id="recovery-email"
                  type="email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                  className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#18a249] focus-visible:ring-[#18a249]/25"
                />
              </div>

              {recoveryFeedback ? (
                <div className="rounded-[1.25rem] border border-[#18a249]/20 bg-[#18a249]/10 px-4 py-3 text-sm text-[#11823a]">
                  {recoveryFeedback}
                </div>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-5 text-[#111111] shadow-sm hover:bg-[#F8FAF9] hover:text-[#111111]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="h-11 rounded-xl bg-[#18a249] px-5 text-sm font-semibold text-white shadow-lg shadow-[#18a249]/12 hover:bg-[#15913f]"
                >
                  {isRecoverySubmitting ? "Enviando..." : "Enviar instruções"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  kind,
}: {
  label: string
  type: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  autoComplete?: string
  kind?: StructuredInputKind
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span>
      {kind ? (
        <StructuredInput
          kind={kind}
          value={value}
          onValueChange={(nextValue) => onChange(nextValue)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-label={label}
          className="rounded-xl border border-[color:var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition-all duration-300 placeholder:text-[color:rgba(110,119,132,0.6)] focus:border-[color:rgba(24,162,73,0.6)] focus:ring-2 focus:ring-[var(--ring)]"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="rounded-xl border border-[color:var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition-all duration-300 placeholder:text-[color:rgba(110,119,132,0.6)] focus:border-[color:rgba(24,162,73,0.6)] focus:ring-2 focus:ring-[var(--ring)]"
        />
      )}
    </label>
  )
}

function AuthShowcase() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % SCENES.length)
    }, INTERVAL)

    return () => window.clearInterval(timer)
  }, [])

  const scene = SCENES[index]

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-[color:rgba(242,244,238,0.72)] px-10 py-10 xl:px-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 h-[520px] w-[520px] rounded-full opacity-[0.14] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)" }}
      />

      <Link href="/" className="relative flex w-fit items-center" aria-label="EME - início">
        <Image src="/eme-logo.png" alt="EME" width={92} height={40} priority className="h-7 w-auto" />
      </Link>

      <div className="relative flex flex-1 flex-col justify-center gap-10 py-10">
        <h1 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--foreground)] xl:text-5xl">
          <span className="block">Enquanto você vende,</span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span>o EME</span>
            <span className="relative inline-block">
              <AnimatePresence mode="wait">
                <motion.span
                  key={scene.word}
                  initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -18, filter: "blur(6px)" }}
                  transition={{ duration: 0.95, ease: easeOut }}
                  className="block bg-[linear-gradient(135deg,#18a249_0%,#48c873_45%,#10963e_100%)] bg-clip-text text-transparent"
                >
                  {scene.word}
                </motion.span>
              </AnimatePresence>
            </span>
          </span>
        </h1>

        <LivingWindow index={index} status={scene.status} />
      </div>

      <div className="relative flex items-center gap-2.5 text-sm text-[var(--muted-foreground)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
        </span>
        O EME continua trabalhando enquanto você acessa.
      </div>
    </div>
  )
}

function LivingWindow({ index, status }: { index: number; status: string }) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[color:var(--border)] bg-[var(--card)] shadow-[0_50px_140px_-50px_rgba(20,120,60,0.4)]">
      <div className="flex items-center gap-3 border-b border-[color:rgba(22,24,29,0.08)] px-5 py-4">
        <span className="h-6 w-6 rounded-lg bg-[linear-gradient(135deg,#18a249_0%,#48c873_45%,#10963e_100%)]" />
        <div className="leading-tight">
          <p className="text-sm font-medium tracking-tight text-[var(--foreground)]">COS</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Operando o seu dia</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-[color:rgba(24,162,73,0.24)] bg-[color:rgba(24,162,73,0.06)] px-3 py-1 text-xs text-[var(--brand)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
          </span>
          Ativo
        </div>
      </div>

      <div className="relative h-[248px] px-5 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ duration: 0.9, ease: easeOut }}
            className="absolute inset-0 px-5 py-5"
          >
            <SceneBody index={index} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2.5 border-t border-[color:rgba(22,24,29,0.08)] px-5 py-3.5">
        <span className="flex h-2 w-2 items-center justify-center">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="h-2 w-2 rounded-full bg-[var(--brand)]"
          />
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="text-xs text-[var(--muted-foreground)]"
          >
            {status}
            <AnimatedDots />
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AnimatedDots() {
  return (
    <span className="inline-flex">
      {[0, 1, 2].map((item) => (
        <motion.span
          key={item}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: item * 0.25 }}
        >
          .
        </motion.span>
      ))}
    </span>
  )
}

function Bar({ w, delay = 0, tone = "muted" }: { w: string; delay?: number; tone?: "muted" | "brand" }) {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: w, opacity: 1 }}
      transition={{ duration: 1, ease: easeOut, delay }}
      className={`h-2 rounded-full ${tone === "brand" ? "bg-[color:rgba(24,162,73,0.28)]" : "bg-[var(--secondary)]"}`}
    />
  )
}

function SceneBody({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="flex h-full gap-4">
          <div className="relative aspect-square h-full overflow-hidden rounded-2xl bg-[var(--secondary)]">
            <Image src="/property-living.png" alt="" fill sizes="120px" className="object-cover" />
            <motion.div
              aria-hidden
              initial={{ y: "-120%" }}
              animate={{ y: "120%" }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-x-0 h-1/2"
              style={{
                background:
                  "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--brand) 35%, transparent), transparent)",
              }}
            />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-2.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[color:rgba(24,162,73,0.1)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand)]">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} /> Studio IA
            </span>
            <Bar w="90%" delay={0.1} />
            <Bar w="72%" delay={0.3} />
            <Bar w="80%" delay={0.5} />
            <Bar w="55%" delay={0.7} tone="brand" />
          </div>
        </div>
      )
    case 1:
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { src: "/property-facade.png", price: "R$ 1,35 mi" },
              { src: "/property-kitchen.png", price: "R$ 890 mil" },
            ].map((card) => (
              <div key={card.src} className="overflow-hidden rounded-2xl border border-[color:rgba(22,24,29,0.08)] bg-[color:rgba(255,255,255,0.8)]">
                <div className="relative aspect-[16/10] w-full bg-[var(--secondary)]">
                  <Image src={card.src} alt="" fill sizes="160px" className="object-cover" />
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="h-2 w-10 rounded-full bg-[var(--secondary)]" />
                  <span className="text-[11px] font-semibold text-[var(--brand)]">{card.price}</span>
                </div>
              </div>
            ))}
          </div>
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: easeOut, delay: 0.5 }}
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[color:rgba(24,162,73,0.1)] px-3 py-1 text-[11px] font-medium text-[var(--brand)]"
          >
            <Check className="h-3 w-3" strokeWidth={3} /> Catálogo publicado
          </motion.span>
        </div>
      )
    case 2:
      return (
        <div className="flex h-full flex-col justify-center gap-4">
          <div className="flex items-center justify-between">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((day, item) => (
              <div key={`${day}-${item}`} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-[var(--muted-foreground)]">{day}</span>
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${
                    item === 3 ? "bg-[var(--brand)] text-[var(--primary-foreground)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                  }`}
                >
                  {12 + item}
                </span>
              </div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOut, delay: 0.3 }}
            className="flex items-center gap-3 rounded-2xl border border-[color:rgba(22,24,29,0.08)] bg-[color:rgba(255,255,255,0.8)] px-4 py-3"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:rgba(24,162,73,0.1)] text-[var(--brand)]">
              <CalendarCheck className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-[var(--foreground)]">Visita ao imóvel</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">Hoje · 15h00 · Marina</p>
            </div>
          </motion.div>
        </div>
      )
    case 3:
      return (
        <div className="flex h-full items-center justify-center">
          <div className="w-40 overflow-hidden rounded-xl border border-[color:rgba(22,24,29,0.08)] bg-white shadow-sm">
            <div className="h-6 bg-[linear-gradient(135deg,#18a249_0%,#48c873_45%,#10963e_100%)]" />
            <div className="flex flex-col gap-2 p-3">
              <span className="text-[13px] font-semibold text-[var(--brand)]">R$ 1.250.000</span>
              <Bar w="100%" delay={0.2} />
              <Bar w="85%" delay={0.35} />
              <Bar w="90%" delay={0.5} />
              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-[var(--brand)]">
                <FileText className="h-3 w-3" strokeWidth={2.5} /> Proposta.pdf
              </div>
            </div>
          </div>
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: easeOut, delay: 0.6 }}
            className="ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-[color:rgba(24,162,73,0.15)] text-[var(--brand)]"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </motion.span>
        </div>
      )
    case 4:
      return (
        <div className="flex h-full items-center justify-center">
          <div className="w-full max-w-[15rem] rounded-2xl border border-[color:rgba(22,24,29,0.08)] bg-[color:rgba(255,255,255,0.8)] p-4">
            <div className="flex items-center gap-2 text-[var(--brand)]">
              <FileSignature className="h-4 w-4" strokeWidth={2} />
              <span className="text-xs font-medium">Contrato de venda</span>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Bar w="100%" delay={0.15} />
              <Bar w="92%" delay={0.3} />
              <Bar w="78%" delay={0.45} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <svg width="88" height="28" viewBox="0 0 88 28" fill="none" aria-hidden>
                <motion.path
                  d="M2 20 C 12 4, 20 4, 26 16 S 40 26, 50 10 S 70 2, 86 14"
                  stroke="var(--brand)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.6, ease: easeOut, delay: 0.4 }}
                />
              </svg>
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: easeOut, delay: 1.6 }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:rgba(24,162,73,0.15)] text-[var(--brand)]"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </motion.span>
            </div>
          </div>
        </div>
      )
    default:
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOut, delay: 0.1 }}
            className="max-w-[78%] rounded-2xl rounded-tl-sm border border-[color:rgba(22,24,29,0.08)] bg-[color:rgba(255,255,255,0.8)] px-3.5 py-2.5 text-[13px] text-[var(--foreground)]"
          >
            Ainda está disponível o apartamento no Menino Deus?
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: easeOut, delay: 0.5 }}
            className="ml-auto flex max-w-[78%] items-center gap-2 rounded-2xl rounded-tr-sm bg-[color:rgba(24,162,73,0.1)] px-3.5 py-2.5 text-[13px] text-[var(--foreground)]"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" strokeWidth={2.5} />
            Sim! Posso agendar sua visita hoje?
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="ml-auto flex items-center gap-1 rounded-full bg-[var(--secondary)] px-3 py-1.5"
          >
            {[0, 1, 2].map((item) => (
              <motion.span
                key={item}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: item * 0.2 }}
                className="h-1.5 w-1.5 rounded-full bg-[var(--muted-foreground)]"
              />
            ))}
          </motion.div>
        </div>
      )
  }
}
