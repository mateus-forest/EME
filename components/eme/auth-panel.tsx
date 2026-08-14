"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Fingerprint, KeyRound, LockKeyhole, X } from "lucide-react"

import { usePremiumLogin } from "@/components/use-premium-login"
import { PinCodeInput } from "@/components/ui/pin-code-input"
import { getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export type AuthMode = "login" | "signup"
type LoginMethod = "password" | "pin"

export function AuthPanel({
  mode,
  onModeChange,
  onClose,
}: {
  mode: AuthMode
  onModeChange: (m: AuthMode) => void
  onClose: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isLogin = mode === "login"
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [creci, setCreci] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password")
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const {
    trustedDevice,
    email,
    password,
    pin,
    error: loginError,
    isSubmitting: isLoginSubmitting,
    isCheckingDevice,
    pinAvailable,
    biometricAvailable,
    biometricLabel,
    setEmail,
    setPassword,
    setPin,
    submitPassword,
    submitPin,
    submitBiometric,
  } = usePremiumLogin((user: AuthenticatedUser) => {
    const next = searchParams.get("next")
    const fallbackRoute = getDefaultRouteByRole(user.role)
    const targetRoute = next && next.startsWith("/") ? next : fallbackRoute

    router.push(targetRoute)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }))

    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    body.style.overscrollBehavior = "none"

    return () => {
      cancelAnimationFrame(focusFrame)
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [])

  useEffect(() => {
    setError("")
  }, [mode, loginMethod])

  const helperText = useMemo(() => {
    if (!isLogin) {
      return "Crie sua conta gratuitamente e descubra uma nova forma de operar o mercado imobiliário."
    }

    return "Continue para acessar o seu Sistema Operacional."
  }, [isLogin])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (isLogin) {
      try {
        if (loginMethod === "pin") {
          await submitPin()
        } else {
          await submitPassword()
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível entrar agora.")
      }

      return
    }

    const trimmedName = name.trim()
    const normalizedEmail = signupEmail.trim().toLowerCase()

    if (!trimmedName || !normalizedEmail || !signupPassword) {
      setError("Nome, email e senha são obrigatórios.")
      return
    }

    if (signupPassword !== confirmPassword) {
      setError("As senhas não coincidem.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          role: "BROKER",
          name: trimmedName,
          email: normalizedEmail,
          creci: creci.trim(),
          password: signupPassword,
        }),
      })

      const data = (await response.json().catch(() => null)) as { user: AuthenticatedUser } | { error?: string } | null

      if (!response.ok || !data || !("user" in data)) {
        setError(data && "error" in data && data.error ? data.error : "Não foi possível criar sua conta agora.")
        return
      }

      router.push(getDefaultRouteByRole(data.user.role))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <motion.button
        type="button"
        aria-label="Fechar autenticação"
        className="pointer-events-auto absolute inset-0 z-0 cursor-default"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <div
        className="absolute inset-0 z-10 flex items-end justify-center px-2 pb-2 pt-2 sm:items-center sm:justify-end sm:px-8 sm:py-6 lg:px-14"
        style={{
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
          paddingTop: "max(0.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <motion.div
          className="pointer-events-auto w-full max-w-[420px] sm:w-[88vw]"
          initial={{ x: 72, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 72, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isLogin ? "Entrar no EME" : "Criar conta no EME"}
            className="relative flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[28px] border border-[rgba(17,24,39,0.08)] bg-[rgba(255,255,255,0.96)] shadow-[0_26px_70px_-40px_rgba(20,52,36,0.46)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-[30px] sm:bg-[rgba(255,255,255,0.92)] sm:backdrop-blur-xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="absolute right-3 top-3 z-30 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-foreground/10 bg-white/95 text-foreground/70 shadow-sm transition-colors hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eme/40 sm:right-4 sm:top-4"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>

            <div
              data-auth-scroll
              className="eme-hidden-scrollbar min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-12 sm:py-9"
            >
              <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              >
                <div className="pr-8 sm:pr-6">
                  <h2 className="text-pretty text-[23px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
                    {isLogin ? "Bem-vindo de volta." : "Comece a vender mais."}
                  </h2>
                  <p className="mt-2 text-pretty text-[13px] leading-relaxed text-foreground/70 sm:mt-2.5 sm:text-[14px]">
                    {helperText}
                  </p>
                </div>

                <form className="mt-6 flex flex-col gap-3 sm:mt-7" onSubmit={handleSubmit}>
                  {!isLogin ? (
                    <>
                      <Field
                        label="Nome"
                        type="text"
                        autoComplete="name"
                        placeholder="Seu nome completo"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                      <Field
                        label="CRECI"
                        type="text"
                        autoComplete="off"
                        placeholder="000000-F"
                        value={creci}
                        onChange={(event) => setCreci(event.target.value)}
                      />
                      <Field
                        label="Email"
                        type="email"
                        autoComplete="email"
                        placeholder="voce@email.com"
                        value={signupEmail}
                        onChange={(event) => setSignupEmail(event.target.value)}
                      />
                      <Field
                        label="Senha"
                        type="password"
                        autoComplete="new-password"
                        placeholder="........"
                        value={signupPassword}
                        onChange={(event) => setSignupPassword(event.target.value)}
                      />
                      <Field
                        label="Confirmar senha"
                        type="password"
                        autoComplete="new-password"
                        placeholder="........"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <MethodButton
                          active={loginMethod === "password"}
                          icon={<LockKeyhole className="size-4" />}
                          label="Email e senha"
                          onClick={() => setLoginMethod("password")}
                        />
                        <MethodButton
                          active={loginMethod === "pin"}
                          icon={<KeyRound className="size-4" />}
                          label="Entrar com PIN"
                          onClick={() => setLoginMethod("pin")}
                        />
                      </div>

                      {loginMethod === "password" ? (
                        <>
                          <Field
                            label="Email"
                            type="email"
                            autoComplete="email"
                            placeholder="voce@email.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                          />
                          <Field
                            label="Senha"
                            type="password"
                            autoComplete="current-password"
                            placeholder="........"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                          />
                        </>
                      ) : (
                        <div className="grid gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-medium tracking-tight text-foreground/70">PIN de 6 dígitos</span>
                            {trustedDevice?.emailMasked ? <span className="text-[12px] text-foreground/50">{trustedDevice.emailMasked}</span> : null}
                          </div>
                          <PinCodeInput value={pin} onChange={setPin} autoFocus />
                        </div>
                      )}
                    </>
                  )}

                  {(error || loginError) ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                      {error || loginError}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting || isLoginSubmitting || (isLogin && loginMethod === "pin" && pinAvailable && pin.length < 6)}
                    className="eme-gradient mt-2 w-full rounded-full py-3 text-[14px] font-medium tracking-tight text-primary-foreground shadow-[0_14px_30px_-12px_rgba(28,120,60,0.65)] transition-[transform,filter] duration-200 ease-out hover:-translate-y-0.5 disabled:opacity-70"
                  >
                    {isSubmitting || isLoginSubmitting
                      ? isLogin
                        ? "Entrando..."
                        : "Criando conta..."
                      : isLogin
                        ? "Entrar"
                        : "Criar conta"}
                  </button>

                  {isLogin && loginMethod === "pin" && biometricAvailable ? (
                    <button
                      type="button"
                      onClick={() => void submitBiometric()}
                      disabled={isLoginSubmitting || isCheckingDevice}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-foreground/12 bg-[#F8FAF9] px-4 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Fingerprint className="size-4 text-eme" />
                      {biometricLabel}
                    </button>
                  ) : null}
                </form>

                {isLogin ? (
                  <>
                    <div className="my-5 flex items-center gap-4">
                      <span className="h-px flex-1 bg-foreground/10" />
                      <span className="text-[12px] font-medium tracking-wide text-foreground/40">ou</span>
                      <span className="h-px flex-1 bg-foreground/10" />
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-3 rounded-full border border-foreground/12 bg-white py-2.5 text-[14px] font-medium tracking-tight text-foreground/85 transition-colors duration-200 hover:bg-white"
                    >
                      <GoogleMark />
                      Continuar com Google
                    </button>
                  </>
                ) : null}

                <p className="mt-5 text-center text-[13px] text-foreground/65 sm:mt-6 sm:text-[13.5px]">
                  {isLogin ? "Ainda não possui uma conta? " : "Já possui uma conta? "}
                  <button
                    type="button"
                    onClick={() => onModeChange(isLogin ? "signup" : "login")}
                    className="font-medium text-eme transition-colors hover:text-eme-dark"
                  >
                    {isLogin ? "Criar conta" : "Entrar"}
                  </button>
                </p>
              </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function MethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-[13px] font-medium transition-colors",
        active
          ? "border-eme/20 bg-eme/10 text-eme-dark"
          : "border-foreground/12 bg-white text-foreground/70 hover:bg-[#F8FAF9]",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function Field({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium tracking-tight text-foreground/70">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border border-foreground/15 bg-white px-4 py-2.5 text-[14px] text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-out placeholder:text-foreground/35 focus:border-eme focus:shadow-[0_0_0_3px_rgba(31,143,78,0.12)]"
      />
    </label>
  )
}

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
