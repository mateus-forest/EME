"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthShell } from "@/components/auth-shell"
import { clearLegacyAuthState, getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function LoginPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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

  const handleRecoverySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsRecoverySubmitting(true)

    window.setTimeout(() => {
      setRecoveryFeedback("Se existir uma conta com este email, você receberá instruções para redefinir sua senha.")
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
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className="font-semibold text-[#00C853] hover:text-[#00E676]">
              Comece agora
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">
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

          {loginError && (
            <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {loginError}
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-[#00C853] text-base font-semibold text-black shadow-lg shadow-[#00C853]/12 hover:bg-[#00E676]"
          >
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
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
