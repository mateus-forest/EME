"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthShell } from "@/components/auth-shell"
import { clearLegacyAuthState, getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SignupBrokerPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [creci, setCreci] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")

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
          password,
        }),
      })

      const data = (await response.json().catch(() => null)) as
        | { user: AuthenticatedUser }
        | { error?: string }
        | null

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
    <AuthShell
      title="Cadastro de corretor"
      subtitle="Crie sua conta e comece a publicar imóveis com rapidez em poucos passos."
      footer={
        <p className="text-sm text-white/55">
          Prefere cadastrar uma equipe?{" "}
          <Link href="/cadastro/imobiliaria" className="font-semibold text-[#00C853] hover:text-[#00E676]">
            Ir para imobiliária
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="space-y-2">
          <label htmlFor="nome" className="text-sm font-medium text-white/80">
            Nome
          </label>
          <Input
            id="nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome completo"
            required
            className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-white/80">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
            className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="whatsapp" className="text-sm font-medium text-white/80">
            WhatsApp
          </label>
          <Input
            id="whatsapp"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(11) 99999-9999"
            required
            className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="creci" className="text-sm font-medium text-white/80">
            CRECI
          </label>
          <Input
            id="creci"
            value={creci}
            onChange={(event) => setCreci(event.target.value)}
            placeholder="123456"
            required
            className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="senha" className="text-sm font-medium text-white/80">
            Senha
          </label>
          <Input
            id="senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Crie sua senha"
            required
            className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        {error && (
          <div className="rounded-[1.25rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="mt-2 h-12 rounded-xl bg-[#00C853] text-base font-semibold text-black shadow-lg shadow-[#00C853]/20 hover:bg-[#00E676]"
        >
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthShell>
  )
}
