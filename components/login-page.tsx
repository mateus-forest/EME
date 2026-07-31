"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthShell } from "@/components/auth-shell"
import { clearLegacyAuthState, getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type LoginMethod = "password" | "pin"

export function LoginPage() {
  const router = useRouter()
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [loginError, setLoginError] = useState("")
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState("")
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false)
  const [recoveryFeedback, setRecoveryFeedback] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setLoginError("")

    const payload = {
      method: loginMethod,
      email: email.trim().toLowerCase(),
      password,
      pin: pin.trim(),
    }

    if (loginMethod === "pin") {
      if (!payload.pin) {
        setLoginError("Informe seu PIN.")
        setIsSubmitting(false)
        return
      }
    } else if (!payload.email || !payload.password) {
      setLoginError("Email e senha sao obrigatorios.")
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
        setLoginError(data && "error" in data && data.error ? data.error : "Nao foi possivel entrar agora.")
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

  const handleRecoverySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsRecoverySubmitting(true)

    window.setTimeout(() => {
      setRecoveryFeedback("Se existir uma conta com este email, voce recebera instrucoes para redefinir sua senha.")
      setRecoveryEmail("")
      setIsRecoverySubmitting(false)
    }, 500)
  }

  return (
    <>
      <AuthShell
        title="Entrar"
        subtitle="Acesse sua conta para continuar publicando, gerenciando e acompanhando seus resultados."
        footer={
          <p className="text-sm text-[#6B7280]">
            Ainda nao tem conta?{" "}
            <Link href="/cadastro" className="font-semibold text-[#00C853] hover:text-[#00E676]">
              Comece agora
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-[1.25rem] border border-[#E5E7EB] bg-[#F8FAF9] p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod("password")
                setLoginError("")
              }}
              className={`h-11 rounded-[0.95rem] text-sm font-medium transition-colors ${
                loginMethod === "password"
                  ? "bg-white text-[#111111] shadow-sm"
                  : "text-[#6B7280] hover:text-[#111111]"
              }`}
            >
              Email e senha
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod("pin")
                setLoginError("")
              }}
              className={`h-11 rounded-[0.95rem] text-sm font-medium transition-colors ${
                loginMethod === "pin"
                  ? "bg-white text-[#111111] shadow-sm"
                  : "text-[#6B7280] hover:text-[#111111]"
              }`}
            >
              Entrar com PIN
            </button>
          </div>

          {loginMethod === "pin" ? (
            <div className="space-y-2">
              <label htmlFor="pin" className="text-sm font-medium text-[#374151]">
                PIN
              </label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Digite seu PIN"
                required
                className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
              />
              <p className="text-sm leading-6 text-[#6B7280]">
                Fluxo preparado para futura configuracao em Conta &gt; Seguranca.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[#374151]">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                  className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="senha" className="text-sm font-medium text-[#374151]">
                  Senha
                </label>
                <Input
                  id="senha"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Sua senha"
                  required
                  className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(email)
                      setRecoveryFeedback("")
                      setForgotPasswordOpen(true)
                    }}
                    className="text-sm font-medium text-[#00A844] transition-colors hover:text-[#00C853]"
                  >
                    Esqueci minha senha?
                  </button>
                </div>
              </div>
            </>
          )}

          {loginError && (
            <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loginError}
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#00C853] text-base font-semibold text-black shadow-lg shadow-[#00C853]/12 hover:bg-[#00E676]"
          >
            {isSubmitting ? "Entrando..." : loginMethod === "pin" ? "Entrar com PIN" : "Entrar"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-4">
          <span className="h-px flex-1 bg-[#E5E7EB]" />
          <span className="text-[12px] font-medium tracking-wide text-[#98A2B3]">ou</span>
          <span className="h-px flex-1 bg-[#E5E7EB]" />
        </div>

        <button
          type="button"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#E5E7EB] bg-white text-[14px] font-medium text-[#111111] transition-colors hover:bg-[#F8FAF9]"
        >
          <GoogleMark />
          Continuar com Google
        </button>
      </AuthShell>

      <Dialog
        open={forgotPasswordOpen}
        onOpenChange={(open) => {
          setForgotPasswordOpen(open)
          if (!open) {
            setIsRecoverySubmitting(false)
          }
        }}
      >
        <DialogContent className="max-w-md rounded-[1.75rem] border-[#E5E7EB] bg-white p-0 text-[#111111] shadow-[0_30px_80px_rgba(17,24,39,0.14)]">
          <div className="p-6 sm:p-7">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-2xl font-semibold text-[#111111]">Recuperar senha</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-[#6B7280]">
                Informe seu email para solicitar a redefinicao de senha quando a integracao com backend estiver conectada.
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
                  className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
                />
              </div>

              {recoveryFeedback && (
                <div className="rounded-[1.25rem] border border-[#00C853]/20 bg-[#00C853]/10 px-4 py-3 text-sm text-[#00A844]">
                  {recoveryFeedback}
                </div>
              )}

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
                  className="h-11 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/12 hover:bg-[#00E676]"
                >
                  {isRecoverySubmitting ? "Enviando..." : "Enviar instrucoes"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
