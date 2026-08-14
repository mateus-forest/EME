"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { Camera, CheckCircle2, LockKeyhole, Palette, ShieldCheck, UserRound } from "lucide-react"

import { BrokerPageShell } from "@/components/broker-page-shell"
import { AccountSecuritySection } from "@/components/account-security-section"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { StructuredInput } from "@/components/ui/structured-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useBrokerProfile } from "@/components/use-broker-profile"
import { DEFAULT_STUDIO_ACCENT_COLOR } from "@/lib/studio-creative-renderer"
import { normalizePhone, type StructuredInputKind } from "@/lib/structured-fields"

export function BrokerAccountPage() {
  return (
    <BrokerPageShell title="Conta">
      <AccountForm />
    </BrokerPageShell>
  )
}

const MAX_PHOTO_SOURCE_BYTES = 4 * 1024 * 1024
const MAX_PHOTO_PAYLOAD_CHARS = 4 * 1024 * 1024
const PHOTO_MAX_DIMENSION = 640
const PHOTO_JPEG_QUALITY = 0.85

// Same size limit as the profile photo field above, but no format-based canvas re-encode: unlike
// a photo, a logo is usually a small file with a transparent background (or an SVG), and the
// canvas/JPEG pipeline used for the photo field would flatten transparency to black and can't
// preserve vector data. The server-side render pipeline already normalizes any accepted format to
// PNG at render time, so storing the original file as-is here is both simpler and safer.
const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/svg+xml"]

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."))
    reader.readAsDataURL(file)
  })
}

// Foto de perfil nao precisa de alta resolucao — redimensionar e recomprimir no navegador antes
// do envio reduz drasticamente a chance de esbarrar no limite de payload da funcao serverless
// (Vercel, tipicamente ~4.5MB) mesmo quando o arquivo original selecionado e grande.
function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."))
      image.onload = () => {
        const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(image.width, image.height))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext("2d")
        if (!context) {
          reject(new Error("Não foi possível processar a imagem selecionada."))
          return
        }

        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function AccountForm() {
  const { profile, saveProfile, isLoading } = useBrokerProfile()
  const [fullName, setFullName] = useState(profile.fullName)
  const [email, setEmail] = useState(profile.email)
  const [creci, setCreci] = useState(profile.creci)
  const [whatsApp, setWhatsApp] = useState(profile.whatsApp)
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl)
  const [description, setDescription] = useState(profile.description)
  const [brandColor, setBrandColor] = useState(profile.brandColor)
  const [logoUrl, setLogoUrl] = useState(profile.logoUrl)
  const [showAgencyWatermark, setShowAgencyWatermark] = useState(profile.showAgencyWatermark)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success")
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setFullName(profile.fullName)
    setEmail(profile.email)
    setCreci(profile.creci)
    setWhatsApp(profile.whatsApp)
    setPhotoUrl(profile.photoUrl)
    setDescription(profile.description)
    setBrandColor(profile.brandColor)
    setLogoUrl(profile.logoUrl)
    setShowAgencyWatermark(profile.showAgencyWatermark)
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
        whatsApp: normalizePhone(whatsApp),
        photoUrl,
        description,
        brandColor,
        logoUrl,
        showAgencyWatermark,
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

    if (!file.type.startsWith("image/")) {
      setFeedbackTone("error")
      setFeedback("Envie um arquivo de imagem (JPG ou PNG).")
      return
    }

    if (file.size > MAX_PHOTO_SOURCE_BYTES) {
      setFeedbackTone("error")
      setFeedback(
        `A imagem tem ${formatMegabytes(file.size)}, o limite é ${formatMegabytes(MAX_PHOTO_SOURCE_BYTES)} — tente uma imagem menor ou comprimida.`,
      )
      return
    }

    try {
      const compressed = await compressImageToDataUrl(file)
      if (compressed.length > MAX_PHOTO_PAYLOAD_CHARS) {
        setFeedbackTone("error")
        setFeedback("Não foi possível reduzir a imagem o suficiente. Tente uma foto menor ou com menos detalhe.")
        return
      }
      setFeedback(null)
      setPhotoUrl(compressed)
    } catch {
      setFeedbackTone("error")
      setFeedback("Não foi possível atualizar a foto agora.")
    }
  }

  async function handleLogoChange(file: File | null) {
    if (!file) return

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setFeedbackTone("error")
      setFeedback("Envie um arquivo JPG, PNG ou SVG — outros formatos podem não aparecer corretamente nas imagens geradas pelo Studio IA.")
      return
    }

    if (file.size > MAX_PHOTO_SOURCE_BYTES) {
      setFeedbackTone("error")
      setFeedback(
        `O logo tem ${formatMegabytes(file.size)}, o limite é ${formatMegabytes(MAX_PHOTO_SOURCE_BYTES)} — tente uma imagem menor ou comprimida.`,
      )
      return
    }

    try {
      setFeedback(null)
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
              <p className="-mt-1 text-xs leading-5 text-[#7B8491]">
                JPG ou PNG, até {formatMegabytes(MAX_PHOTO_SOURCE_BYTES)}, recomendado 500x500px.
              </p>
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
                kind="phone"
                value={whatsApp}
                onChange={setWhatsApp}
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
                <Palette className="size-4.5" />
              </span>
              Identidade visual do Studio IA
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 pt-0">
            <div className="grid gap-2">
              <Label htmlFor="brandColor" className="text-sm font-medium text-[#5F6B7A]">
                Cor de destaque
              </Label>
              <p className="-mt-1 text-xs leading-5 text-[#7B8491]">
                Usada nos ícones, divisórias e preço das imagens geradas para Post Feed e Story.
              </p>
              <div className="flex items-center gap-3">
                <input
                  id="brandColor"
                  type="color"
                  value={brandColor || DEFAULT_STUDIO_ACCENT_COLOR}
                  onChange={(event) => setBrandColor(event.target.value)}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-black/[0.06] bg-white/80 p-1"
                />
                <Input
                  value={brandColor}
                  onChange={(event) => setBrandColor(event.target.value.trim())}
                  placeholder={DEFAULT_STUDIO_ACCENT_COLOR}
                  className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#9CA3AF] focus-visible:ring-[#009b3a]/35"
                />
                {brandColor ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setBrandColor("")}
                    className="h-11 shrink-0 rounded-xl px-3 text-xs text-[#7B8491] hover:bg-white hover:text-[#050505]"
                  >
                    Usar padrão
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3">
              <Label className="text-sm font-medium text-[#5F6B7A]">Logo (pessoal ou da sua imobiliária)</Label>
              <p className="-mt-1 text-xs leading-5 text-[#7B8491]">
                JPG, PNG ou SVG, até {formatMegabytes(MAX_PHOTO_SOURCE_BYTES)}. Exibido como marca d&apos;água opcional
                no rodapé das imagens geradas para Post Feed e Story — sem logo, nenhuma marca d&apos;água aparece.
              </p>
              <div className="flex items-center gap-4">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={ALLOWED_LOGO_TYPES.join(",")}
                  className="sr-only"
                  onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
                />
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 text-xs text-[#5F6B7A]">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    "—"
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => logoInputRef.current?.click()}
                  className="h-10 rounded-xl border border-black/[0.06] bg-white/80 px-4 text-[#4B5563] hover:bg-white hover:text-[#050505]"
                >
                  <Camera className="size-4" />
                  {logoUrl ? "Trocar logo" : "Adicionar logo"}
                </Button>
                {logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setLogoUrl("")}
                    className="h-10 shrink-0 rounded-xl px-3 text-xs text-[#7B8491] hover:bg-white hover:text-[#050505]"
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>

            {profile.agencyId ? (
              <label htmlFor="showAgencyWatermark" className="flex cursor-pointer items-start gap-3 rounded-xl border border-black/[0.06] bg-white/60 p-3.5">
                <input
                  id="showAgencyWatermark"
                  type="checkbox"
                  checked={showAgencyWatermark}
                  onChange={(event) => setShowAgencyWatermark(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[#009b3a]"
                />
                <span className="text-sm leading-6 text-[#44505F]">
                  Mostrar a marca d&apos;água de {profile.agencyName || "sua imobiliária"} no rodapé das imagens geradas
                </span>
              </label>
            ) : null}
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

      <AccountSecuritySection />

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

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  type?: string
  kind?: StructuredInputKind
}

function Field({ id, label, value, onChange, error, placeholder, type = "text", kind }: FieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-[#5F6B7A]">
        {label}
      </Label>
      {kind ? (
        <StructuredInput kind={kind} id={id} value={value} onValueChange={(nextValue) => onChange(nextValue)} placeholder={placeholder} aria-label={label} className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#9CA3AF] focus-visible:ring-[#009b3a]/35" />
      ) : (
        <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl border-black/[0.06] bg-white/80 text-[#050505] placeholder:text-[#9CA3AF] focus-visible:ring-[#009b3a]/35" />
      )}
      {error && <p className="text-xs text-[#ff8a80]">{error}</p>}
    </div>
  )
}

