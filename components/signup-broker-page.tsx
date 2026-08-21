"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthShell } from "@/components/auth-shell"
import { clearLegacyAuthState, getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { normalizePhone } from "@/lib/structured-fields"
import { CRECI_UF_OPTIONS } from "@/lib/creci-validation"

export function SignupBrokerPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [creci, setCreci] = useState("")
  const [creciUf, setCreciUf] = useState("")
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
          phone: normalizePhone(phone),
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
      footer={<p className="text-sm text-[#6B7280]">MVP focado em corretores individuais.</p>}
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="space-y-2">
          <label htmlFor="nome" className="text-sm font-medium text-[#374151]">
            Nome
          </label>
          <Input
            id="nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome completo"
            required
            className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
          />
        </div>

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
          <label htmlFor="whatsapp" className="text-sm font-medium text-[#374151]">
            WhatsApp
          </label>
          <StructuredInput
            kind="phone"
            id="whatsapp"
            value={phone}
            onValueChange={(value) => setPhone(value)}
            placeholder="(11) 99999-9999"
            required
            className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
          />
        </div>

        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
          <div className="space-y-2">
            <label htmlFor="creciUf" className="text-sm font-medium text-[#374151]">UF</label>
            <select
              id="creciUf"
              value={creciUf}
              onChange={(event) => setCreciUf(event.target.value)}
              required
              className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-[#111111] outline-none focus:border-[#00C853] focus:ring-2 focus:ring-[#00C853]/25"
            >
              <option value="">UF</option>
              {CRECI_UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="creci" className="text-sm font-medium text-[#374151]">Número do CRECI</label>
            <Input
              id="creci"
              value={creci}
              onChange={(event) => setCreci(event.target.value)}
              placeholder="123456 ou 123456 F"
              inputMode="text"
              pattern="[0-9]+(?:[ -]*[A-Za-z]{1,3})?"
              required
              className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
            />
          </div>
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
            placeholder="Crie sua senha"
            required
            className="h-12 rounded-xl border-[#E5E7EB] bg-white text-[#111111] placeholder:text-[#9CA3AF] focus-visible:border-[#00C853] focus-visible:ring-[#00C853]/25"
          />
        </div>

        {error && (
          <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="mt-2 h-12 rounded-xl bg-[#00C853] text-base font-semibold text-black shadow-lg shadow-[#00C853]/12 hover:bg-[#00E676]"
        >
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthShell>
  )
}
