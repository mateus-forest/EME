"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CheckCircle2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"

import { AdminPageShell } from "@/components/admin-page-shell"
import { AccountSecuritySection } from "@/components/account-security-section"
import { useAdminProfile } from "@/components/use-admin-profile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AdminAccountPage() {
  return (
    <AdminPageShell title="Conta" subtitle="Gerencie os dados e a segurança da conta administrativa">
      <AccountForm />
    </AdminPageShell>
  )
}

function AccountForm() {
  const { profile, saveProfile, isLoading } = useAdminProfile()
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [whatsApp, setWhatsApp] = useState(profile.whatsApp)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success")
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setName(profile.name)
    setEmail(profile.email)
    setWhatsApp(profile.whatsApp)
  }, [profile])

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!name.trim()) nextErrors.name = "Informe o nome."
    if (!email.trim()) {
      nextErrors.email = "Informe o email."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Informe um email válido."
    }

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
        ...profile,
        name: name.trim(),
        email: email.trim(),
        whatsApp: whatsApp.trim(),
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
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar a conta administrativa agora.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {isLoading ? <EmeLoading compact message="Carregando conta..." /> : null}

      {feedback ? (
        <div
          className={`flex items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-sm ${
            feedbackTone === "success"
              ? "border-[#cfe8d7] bg-[#eef9f1] text-[#0f7a35]"
              : "border-[#f1c9c9] bg-[#fff5f5] text-[#b42318]"
          }`}
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-xl text-[#111111]">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
                <UserRound className="size-4.5" />
              </span>
              Dados da conta
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <Field id="name" label="Nome" value={name} onChange={setName} error={errors.name} placeholder="Nome da conta" />
            <Field id="email" label="Email" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="admin@eme.com" />
            <div className="grid gap-2">
              <Field
                id="whatsApp"
                label="WhatsApp"
                type="tel"
                value={whatsApp}
                onChange={(value) => setWhatsApp(formatPhone(value))}
                error={errors.whatsApp}
                placeholder="(11) 99999-9999"
              />
              <p className="-mt-1 text-xs leading-5 text-[#7B8491]">
                Este número pode ser utilizado para comunicações internas e alertas da operação.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white py-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-xl text-[#111111]">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]">
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

      <AccountSecuritySection />

      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-black/[0.06] bg-[#fbfbf8] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-white text-[#5F6B7A]">
            <LockKeyhole className="size-4" />
          </span>
          <p>Mantenha a conta administrativa atualizada para garantir segurança e comunicação operacional.</p>
        </div>

        <Button
          type="submit"
          disabled={isSaving || isLoading}
          className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/18 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/24"
        >
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
      <Label htmlFor={id} className="text-sm font-medium text-[#4B5563]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9AA4B2] focus-visible:ring-[#009b3a]/25"
      />
      {error ? <p className="text-xs text-[#b42318]">{error}</p> : null}
    </div>
  )
}
