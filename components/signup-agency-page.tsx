"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

import { AuthShell } from "@/components/auth-shell"
import { clearLegacyAuthState, getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SignupAgencyPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyName, setCompanyName] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [cnpj, setCnpj] = useState("")
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
          role: "AGENCY",
          name: ownerName,
          companyName,
          email,
          phone,
          cnpj,
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
      title="Cadastro de imobiliária"
      subtitle="Estruture sua operação e convide sua equipe para começar com a EME."
      footer={
        <p className="text-sm text-white/55">
          Vai começar sozinho?{" "}
          <Link href="/cadastro/corretor" className="font-semibold text-[#00C853] hover:text-[#00E676]">
            Ir para corretor
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="grid gap-5">
        <div className="space-y-2">
          <label htmlFor="empresa" className="text-sm font-medium text-white/80">
            Nome da imobiliária
          </label>
          <Input
            id="empresa"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Nome da sua imobiliária"
            required
            className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="responsavel" className="text-sm font-medium text-white/80">
            Nome do responsável
          </label>
          <Input
            id="responsavel"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            placeholder="Nome completo"
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
            placeholder="contato@imobiliaria.com"
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
          <label htmlFor="cnpj" className="text-sm font-medium text-white/80">
            CNPJ
          </label>
          <Input
            id="cnpj"
            value={cnpj}
            onChange={(event) => setCnpj(event.target.value)}
            placeholder="00.000.000/0000-00"
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
