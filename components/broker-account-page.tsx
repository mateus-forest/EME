"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Camera, CheckCircle2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useBrokerProfile } from "@/components/use-broker-profile"

export function BrokerAccountPage() {
  return (
    <BrokerPageShell title="Conta">
      <AccountForm />
    </BrokerPageShell>
  )
}

function AccountForm() {
  const { profile, saveProfile, isLoading } = useBrokerProfile()
  const [fullName, setFullName] = useState(profile.fullName)
  const [email, setEmail] = useState(profile.email)
  const [creci, setCreci] = useState(profile.creci)
  const [whatsApp, setWhatsApp] = useState(profile.whatsApp)
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl)
  const [description, setDescription] = useState(profile.description)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success")
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setFullName(profile.fullName)
    setEmail(profile.email)
    setCreci(profile.creci)
    setWhatsApp(profile.whatsApp)
    setPhotoUrl(profile.photoUrl)
    setDescription(profile.description)
  }, [profile])

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!fullName.trim()) nextErrors.fullName = "Informe seu nome completo."
    if (!email.trim()) {
      nextErrors.email = "Informe seu e-mail."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Informe um e-mail válido."
    }
    if (!creci.trim()) nextErrors.creci = "Informe seu CRECI."
    if (!whatsApp.trim()) {
      nextErrors.whatsApp = "Informe seu WhatsApp."
    } else if (whatsApp.replace(/\D/g, "").length < 10) {
      nextErrors.whatsApp = "Informe um WhatsApp válido com DDD."
    }

    const isChangingPassword = currentPassword.trim() || newPassword.trim() || confirmPassword.trim()

    if (isChangingPassword) {
      if (!currentPassword.trim()) nextErrors.currentPassword = "Informe sua senha atual."
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
        fullName,
        email,
        creci,
        whatsApp,
        photoUrl,
        description,
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
      setFeedback(error instanceof Error ? error.message : "Não foi possível atualizar sua conta agora.")
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePhotoChange(file: File | null) {
    if (!file) return

    try {
      setPhotoUrl(await readFileAsDataUrl(file))
    } catch {
      setFeedbackTone("error")
      setFeedback("Não foi possível atualizar a foto agora.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      {isLoading && (
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white/80 px-4 py-3 text-sm text-[#5F6B7A]">
          Carregando conta...
        </div>
      )}

      <section className="grid gap-3">
        <p className="text-sm uppercase tracking-[0.24em] text-[#7B8491]">Portal do corretor</p>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-[#050505]">Gerencie suas informações e acesso</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#6B7280]">
            Atualize seus dados pessoais e mantenha a segurança da sua conta sem sair do portal.
          </p>
        </div>
      </section>

      {feedback && (
        <div className={`flex items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-sm ${feedbackTone === "success" ? "border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]" : "border-[#ff6b6b]/20 bg-[#ff6b6b]/10 text-[#ffb3b3]"}`}>
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-xl text-[#050505]">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <UserRound className="size-4.5" />
              </span>
              Dados pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <div className="grid gap-3">
              <Label className="text-sm font-medium text-[#5F6B7A]">Foto do perfil</Label>
              <div className="flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? null)}
                />
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-black/[0.06] bg-white/80 text-lg text-[#5F6B7A]">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
                  ) : (
                    "MC"
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  <Camera className="size-4" />
                  Trocar foto
                </Button>
              </div>
            </div>

            <Field id="fullName" label="Nome completo" value={fullName} onChange={setFullName} error={errors.fullName} placeholder="Seu nome completo" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field id="email" label="Email" type="email" value={email} onChange={setEmail} error={errors.email} placeholder="voce@exemplo.com" />
              <Field id="creci" label="CRECI" value={creci} onChange={setCreci} error={errors.creci} placeholder="000000-F" />
            </div>

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
                Este número será utilizado para receber os contatos dos clientes e leads gerados pelos seus anúncios e catálogo.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium text-[#5F6B7A]">
                Descrição do corretor
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Conte em poucas linhas sua especialidade e região de atuação."
                className="min-h-24 rounded-[1rem] border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#9CA3AF]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-black/[0.06] bg-white/90 py-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-3 text-xl text-[#050505]">
              <span className="flex size-10 items-center justify-center rounded-2xl border border-[#009b3a]/20 bg-[#009b3a]/10 text-[#009b3a]">
                <ShieldCheck className="size-4.5" />
              </span>
              Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <Field id="currentPassword" label="Senha atual" type="password" value={currentPassword} onChange={setCurrentPassword} error={errors.currentPassword} placeholder="Digite sua senha atual" />
            <Field id="newPassword" label="Nova senha" type="password" value={newPassword} onChange={setNewPassword} error={errors.newPassword} placeholder="Digite a nova senha" />
            <Field id="confirmPassword" label="Confirmar nova senha" type="password" value={confirmPassword} onChange={setConfirmPassword} error={errors.confirmPassword} placeholder="Repita a nova senha" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 rounded-[1.5rem] border border-black/[0.06] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-[#6B7280]">
          <span className="flex size-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80 text-[#5F6B7A]">
            <LockKeyhole className="size-4" />
          </span>
          <p>Mantenha seus dados atualizados para acessar o portal com mais segurança.</p>
        </div>

        <Button disabled={isSaving || isLoading} className="h-11 rounded-xl bg-[#009b3a] px-5 text-sm font-semibold text-white shadow-lg shadow-[#009b3a]/20 transition-all hover:bg-[#008633] hover:shadow-[#009b3a]/30">
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
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

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
      <Label htmlFor={id} className="text-sm font-medium text-[#5F6B7A]">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#9CA3AF] focus-visible:ring-[#009b3a]/35"
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
