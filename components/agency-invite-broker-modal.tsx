"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatPhone, normalizePhone } from "@/lib/structured-fields"

type AgencyInviteBrokerModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (broker: {
    fullName: string
    email: string
    whatsApp: string
    creci: string
    note: string
  }) => Promise<unknown> | unknown
}

type InviteForm = {
  fullName: string
  email: string
  whatsApp: string
  creci: string
  note: string
}

const initialForm: InviteForm = {
  fullName: "",
  email: "",
  whatsApp: "",
  creci: "",
  note: "",
}

export function AgencyInviteBrokerModal({
  open,
  onOpenChange,
  onInvite,
}: AgencyInviteBrokerModalProps) {
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invitedBrokerName, setInvitedBrokerName] = useState("")
  const [submitError, setSubmitError] = useState("")

  function updateField<Key extends keyof InviteForm>(field: Key, value: InviteForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function validate() {
    const nextErrors: Record<string, string> = {}

    if (!form.fullName.trim()) nextErrors.fullName = "Informe o nome completo."
    if (!form.email.trim()) nextErrors.email = "Informe o email."
    if (!form.whatsApp.trim()) {
      nextErrors.whatsApp = "Informe o WhatsApp."
    } else if (form.whatsApp.replace(/\D/g, "").length < 10) {
      nextErrors.whatsApp = "Informe um WhatsApp válido com DDD."
    }
    if (!form.creci.trim()) nextErrors.creci = "Informe o CRECI."

    return nextErrors
  }

  function resetState() {
    setForm(initialForm)
    setErrors({})
    setIsSubmitting(false)
    setInvitedBrokerName("")
    setSubmitError("")
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) resetState()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    setSubmitError("")

    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)

    try {
      await onInvite({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        whatsApp: normalizePhone(form.whatsApp),
        creci: form.creci.trim(),
        note: form.note.trim(),
      })

      setInvitedBrokerName(form.fullName.trim())
      setIsSubmitting(false)
    } catch (caughtError) {
      setSubmitError(
        caughtError instanceof Error ? caughtError.message : "Não foi possível enviar o convite agora.",
      )
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-[calc(100%-1.5rem)] rounded-[1.75rem] border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.98),rgba(11,11,11,0.96))] p-0 text-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:max-w-2xl"
      >
        <div className="p-5 sm:p-6">
          <DialogTitle className="text-2xl font-semibold text-white">Convidar corretor</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-white/55">
            Adicione um novo corretor à sua equipe.
          </DialogDescription>

          {invitedBrokerName ? (
            <div className="mt-6 grid gap-5">
              <div className="rounded-[1.5rem] border border-[#00C853]/20 bg-[#00C853]/10 p-5">
                <p className="text-lg font-semibold text-white">Convite enviado com sucesso</p>
                <p className="mt-3 text-sm text-white/65">{invitedBrokerName}</p>
                <div className="mt-4 inline-flex rounded-full border border-[#00C853]/20 bg-[#00C853]/10 px-3 py-1.5 text-sm text-[#69F0AE]">
                  Convite pendente
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={resetState}
                  className="h-10 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30"
                >
                  Convidar outro corretor
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  id="fullName"
                  label="Nome completo"
                  value={form.fullName}
                  onChange={(value) => updateField("fullName", value)}
                  error={errors.fullName}
                  placeholder="Nome do corretor"
                />
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) => updateField("email", value)}
                  error={errors.email}
                  placeholder="email@exemplo.com"
                />
                <Field
                  id="whatsApp"
                  label="WhatsApp"
                  type="tel"
                  value={form.whatsApp}
                  onChange={(value) => updateField("whatsApp", formatPhone(value))}
                  error={errors.whatsApp}
                  placeholder="(11) 99999-9999"
                />
                <Field
                  id="creci"
                  label="CRECI"
                  value={form.creci}
                  onChange={(value) => updateField("creci", value)}
                  error={errors.creci}
                  placeholder="123456-F"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="note" className="text-sm font-medium text-white/70">
                  Observação interna
                </Label>
                <Textarea
                  id="note"
                  value={form.note}
                  onChange={(event) => updateField("note", event.target.value)}
                  placeholder="Observações opcionais sobre esse convite"
                  className="min-h-24 rounded-[1rem] border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/25 focus-visible:ring-[#00C853]/35"
                />
              </div>

              <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-6 text-white/60">
                <p>Após o envio, o corretor ficará vinculado à sua imobiliária com status pendente.</p>
                <p className="mt-2">Você poderá ativar, desativar ou excluir esse corretor depois.</p>
              </div>

              {submitError ? (
                <div className="rounded-[1.25rem] border border-[#ff8a80]/20 bg-[#ff8a80]/10 px-4 py-3 text-sm text-[#ffb4ae]">
                  {submitError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-white/75 hover:bg-white/[0.08] hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-xl bg-[#00C853] px-5 text-sm font-semibold text-black shadow-lg shadow-[#00C853]/20 transition-all hover:bg-[#00E676] hover:shadow-[#00C853]/30 disabled:opacity-70"
                >
                  {isSubmitting ? "Enviando convite..." : "Enviar convite"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: FieldProps) {
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
      {error ? <p className="text-xs text-[#ff8a80]">{error}</p> : null}
    </div>
  )
}
