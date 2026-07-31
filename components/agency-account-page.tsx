"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Camera, CheckCircle2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"

import { AgencyPageShell } from "@/components/agency-page-shell"
import { AccountSecuritySection } from "@/components/account-security-section"
import { useAgencyProfile } from "@/components/use-agency-profile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AgencyAccountPage() {
  return (
    <AgencyPageShell title="Conta" subtitle="Gerencie os dados da sua imobiliária e o acesso da conta">
      <AccountForm />
    </AgencyPageShell>
  )
}

function AccountForm() {
  const { profile, saveProfile, isLoading } = useAgencyProfile()
  const [companyName, setCompanyName] = useState(profile.companyName)
  const [ownerName, setOwnerName] = useState(profile.ownerName)
  const [email, setEmail] = useState(profile.email)
  const [cnpj, setCnpj] = useState(profile.cnpj)
  const [whatsApp, setWhatsApp] = useState(profile.whatsApp)
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success")
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setCompanyName(profile.companyName)
    setOwnerName(profile.ownerName)
    setEmail(profile.email)
    setCnpj(profile.cnpj)
    setWhatsApp(profile.whatsApp)
    setLogoUrl(profile.logoUrl)
  }, [profile])

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!companyName.trim()) nextErrors.companyName = "Informe o nome da imobiliária."
    if (!ownerName.trim()) nextErrors.ownerName = "Informe o nome do responsável."
    if (!email.trim()) {
      nextErrors.email = "Informe o email."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Informe um email válido."
    }
    if (!cnpj.trim()) nextErrors.cnpj = "Informe o CNPJ."

    if (!whatsApp.trim()) {
      nextErrors.whatsApp = "Informe o WhatsApp."
    } else if (whatsApp.replace(/\D/g, "").length < 10) {
      nextErrors.whatsApp = "Informe um WhatsApp válido com DDD."
    }

    const isChangingPassword = currentPassword.trim() || newPassword.trim() || confirmPassword.trim()

    if (isChangingPassword) {
      if (!currentPassword.trim()) nextErrors.currentPassword = "Informe a senha atual."
      if (!newPassword.trim()) nextErrors.newPassword = "Informe a nova senha."
      if (!confirmPassword.trim()) {
        nextErrors.confirmPassword = "Confirme a nova senha."
      } else if (newPassword !== confirmPassword) {
        nextErrors.confirmPassword = "As senhas não coincidem."
      }
    }

    return nextErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setFeedbackTone("error")
      setFeedback(null)
      return
    }

    setIsSaving(true)

    try {
      await saveProfile({
        companyName,
        ownerName,
        email,
        cnpj,
        whatsApp,
        logoUrl,
        currentPassword,
        newPassword,
      })

      if (currentPassword || newPassword || confirmPassword) {
        setFeedbackTone("success")
        setFeedback("Dados atualizados com sucesso. Senha alterada com sucesso.")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setFeedbackTone("success")
        setFeedback("Dados atualizados com sucesso.")
      }
    } catch (error) {
      setFeedbackTone("error")
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar a conta da imobiliária agora.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return

    try {
      setLogoUrl(await readFileAsDataUrl(file))
    } catch {
      setFeedbackTone("error")
      setFeedback("Não foi possível atualizar o logo agora.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {isLoading && (
        <EmeLoading compact message="Carregando conta..." />
      )}

      {feedback && (
        <div className={`flex items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-sm ${feedbackTone === "success" ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]" : "border-[#ff6b6b]/20 bg-[#ff6b6b]/10 text-[#ffb3b3]"}`}>
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <UserRound className="size-4.5" />
              </span>
              Dados da imobiliária
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <div className="grid gap-3">
              <Label className="text-sm font-medium text-white/70">Logo</Label>
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
                />
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.04] text-sm text-white/60">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={companyName} className="h-full w-full object-cover" />
                  ) : (
                    "EP"
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  <Camera className="size-4" />
                  Trocar logo
                </Button>
              </div>
            </div>
            <Field id="companyName" label="Nome da imobiliária" value={companyName} onChange={setCompanyName} error={errors.companyName} placeholder="Nome da imobiliária" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="ownerName" label="Nome do responsável" value={ownerName} onChange={setOwnerName} error={errors.ownerName} placeholder="Nome do responsável" />
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="contato@imobiliaria.com" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="cnpj" label="CNPJ" value={cnpj} onChange={setCnpj} error={errors.cnpj} placeholder="00.000.000/0000-00" />
              <div className="grid gap-2">
                <Field id="whatsApp" label="WhatsApp" type="tel" value={whatsApp} onChange={(value) => setWhatsApp(formatPhone(value))} error={errors.whatsApp} placeholder="(11) 99999-9999" />
                <p className="-mt-1 text-xs leading-5 text-white/45">
                  Este número será utilizado para receber contatos, leads e interações relacionadas ao catálogo e aos anúncios da imobiliária.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] py-0 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-xl text-white">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]">
                <ShieldCheck className="size-4.5" />
              </span>
              Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <Field id="currentPassword" label="Senha atual" type="password" value={currentPassword} onChange={setCurrentPassword} error={errors.currentPassword} placeholder="Digite a senha atual" />
            <Field id="newPassword" label="Nova senha" type="password" value={newPassword} onChange={setNewPassword} error={errors.newPassword} placeholder="Digite a nova senha" />
            <Field id="confirmPassword" label="Confirmar nova senha" type="password" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} placeholder="Repita a nova senha" />
          </CardContent>
        </Card>
      </div>

      <AccountSecuritySection variant="dark" />

      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.9),rgba(14,14,14,0.86))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.14)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-white/55">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/70">
            <LockKeyhole className="size-4" />
          </span>
          <p>Mantenha os dados da imobiliária atualizados para garantir segurança e contato correto com os leads.</p>
        </div>

        <Button disabled={isSaving || isLoading} className="h-11 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30">
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  )
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ""
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  type?: string
}

function Field({ id, label, value, onChange, error, placeholder, type = "text" }: FieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-white/70">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/25 focus-visible:ring-[#00C853]/35"
      />
      {error && <p className="text-xs text-[#ff8a80]">{error}</p>}
    </div>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."))
    reader.readAsDataURL(file)
  })
}
