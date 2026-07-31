"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle2, Fingerprint, KeyRound, LaptopMinimal, ShieldCheck, Smartphone } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { useAuthSecurity } from "@/components/use-auth-security"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmeLoading } from "@/components/ui/eme-loading"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PinCodeInput } from "@/components/ui/pin-code-input"
import { PIN_LENGTH, normalizePin } from "@/lib/pin-auth"
import { cn } from "@/lib/utils"

type SecuritySectionProps = {
  variant?: "light" | "dark"
}

export function AccountSecuritySection({ variant = "light" }: SecuritySectionProps) {
  const {
    security,
    isLoading,
    activateTrustedDevice,
    deactivateTrustedDevice,
    updatePin,
    activateBiometric,
    deactivateBiometric,
  } = useAuthSecurity()
  const [pinMode, setPinMode] = useState<"set" | "remove" | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success")
  const [isWorking, setIsWorking] = useState(false)

  const isDark = variant === "dark"

  const theme = useMemo(
    () => ({
      card: isDark
        ? "border-white/[0.08] bg-[linear-gradient(180deg,rgba(17,17,17,0.96),rgba(14,14,14,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
        : "border-black/[0.06] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]",
      title: isDark ? "text-white" : "text-[#111111]",
      subtitle: isDark ? "text-white/60" : "text-[#6B7280]",
      iconWrap: isDark
        ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
        : "border-[#009b3a]/16 bg-[#eef9f1] text-[#009b3a]",
      row: isDark ? "border-white/[0.08] bg-white/[0.04]" : "border-black/[0.06] bg-[#fbfbf8]",
      label: isDark ? "text-white/70" : "text-[#4B5563]",
      text: isDark ? "text-white" : "text-[#111111]",
      muted: isDark ? "text-white/50" : "text-[#7B8491]",
      input: isDark
        ? "border-white/[0.08] bg-white/[0.04] text-white placeholder:text-white/25 focus-visible:ring-[#00C853]/35"
        : "border-black/[0.08] bg-white text-[#111111] placeholder:text-[#9AA4B2] focus-visible:ring-[#009b3a]/25",
      secondaryButton: isDark
        ? "border-white/[0.08] bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:text-white"
        : "border-black/[0.06] bg-white/80 text-[#4B5563] hover:bg-white hover:text-[#111111]",
      success: isDark
        ? "border-[#00C853]/20 bg-[#00C853]/10 text-[#69F0AE]"
        : "border-[#cfe8d7] bg-[#eef9f1] text-[#0f7a35]",
      error: isDark
        ? "border-[#ff6b6b]/20 bg-[#ff6b6b]/10 text-[#ffb3b3]"
        : "border-[#f1c9c9] bg-[#fff5f5] text-[#b42318]",
    }),
    [isDark],
  )

  const lastAccessLabel = security.lastAccessAt
    ? format(new Date(security.lastAccessAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })
    : "Ainda sem autenticacao neste dispositivo"

  async function handleTrustedDeviceToggle() {
    setFeedback(null)
    setIsWorking(true)

    try {
      if (security.trustedDeviceEnabled) {
        await deactivateTrustedDevice()
        setFeedbackTone("success")
        setFeedback("Dispositivo confiavel desativado com sucesso.")
      } else {
        await activateTrustedDevice()
        setFeedbackTone("success")
        setFeedback("Este dispositivo agora esta marcado como confiavel.")
      }
    } catch (error) {
      setFeedbackTone("error")
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar este dispositivo.")
    } finally {
      setIsWorking(false)
    }
  }

  async function handleBiometricToggle() {
    setFeedback(null)
    setIsWorking(true)

    try {
      if (security.biometricEnabled) {
        await deactivateBiometric()
        setFeedbackTone("success")
        setFeedback("Biometria desativada para este dispositivo.")
      } else {
        await activateBiometric()
        setFeedbackTone("success")
        setFeedback("Biometria ativada com sucesso neste dispositivo.")
      }
    } catch (error) {
      setFeedbackTone("error")
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar a biometria.")
    } finally {
      setIsWorking(false)
    }
  }

  async function handlePinSubmit() {
    setFeedback(null)

    if (!currentPassword.trim()) {
      setFeedbackTone("error")
      setFeedback("Informe sua senha atual para continuar.")
      return
    }

    if (pinMode === "set") {
      if (normalizePin(newPin).length !== PIN_LENGTH) {
        setFeedbackTone("error")
        setFeedback("Informe um PIN valido com 6 digitos.")
        return
      }

      if (normalizePin(confirmPin) !== normalizePin(newPin)) {
        setFeedbackTone("error")
        setFeedback("A confirmacao do PIN nao confere.")
        return
      }
    }

    setIsWorking(true)

    try {
      await updatePin(pinMode === "remove" ? "remove" : "set", currentPassword, pinMode === "set" ? newPin : undefined)
      setPinMode(null)
      setCurrentPassword("")
      setNewPin("")
      setConfirmPin("")
      setFeedbackTone("success")
      setFeedback(pinMode === "remove" ? "PIN removido com sucesso." : "PIN salvo com sucesso.")
    } catch (error) {
      setFeedbackTone("error")
      setFeedback(error instanceof Error ? error.message : "Nao foi possivel atualizar o PIN.")
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Card className={cn("rounded-[1.75rem] py-0", theme.card)}>
      <CardHeader className="px-6 py-5">
        <CardTitle className={cn("flex items-center gap-3 text-xl", theme.title)}>
          <span className={cn("flex size-10 items-center justify-center rounded-2xl border", theme.iconWrap)}>
            <ShieldCheck className="size-4.5" />
          </span>
          Seguranca
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 pt-0">
        {isLoading ? <EmeLoading compact message="Carregando seguranca..." /> : null}

        {feedback ? (
          <div
            className={cn(
              "flex items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-sm",
              feedbackTone === "success" ? theme.success : theme.error,
            )}
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        ) : null}

        <div className={cn("grid gap-3 rounded-[1.25rem] border p-4", theme.row)}>
          <SecurityRow
            icon={<LaptopMinimal className="size-4" />}
            title="Dispositivo confiavel"
            description={
              security.trustedDeviceEnabled
                ? "Ativado para este navegador e aparelho."
                : "Exija email e senha sempre que este dispositivo nao estiver confiavel."
            }
            value={security.trustedDeviceEnabled ? "Ativado" : "Desativado"}
            action={
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleTrustedDeviceToggle()}
                disabled={isWorking}
                className={cn("h-10 rounded-xl border px-4", theme.secondaryButton)}
              >
                {security.trustedDeviceEnabled ? "Desativar" : "Ativar"}
              </Button>
            }
            theme={theme}
          />

          <SecurityRow
            icon={<KeyRound className="size-4" />}
            title="PIN"
            description="Fallback automatico para entrar quando a biometria nao estiver disponivel."
            value={security.pinConfigured ? "Configurado" : "Configurar"}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPinMode("set")
                    setCurrentPassword("")
                    setNewPin("")
                    setConfirmPin("")
                  }}
                  disabled={isWorking}
                  className={cn("h-10 rounded-xl border px-4", theme.secondaryButton)}
                >
                  {security.pinConfigured ? "Alterar PIN" : "Configurar PIN"}
                </Button>
                {security.pinConfigured ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPinMode("remove")
                      setCurrentPassword("")
                      setNewPin("")
                      setConfirmPin("")
                    }}
                    disabled={isWorking}
                    className={cn("h-10 rounded-xl border px-4", theme.secondaryButton)}
                  >
                    Remover PIN
                  </Button>
                ) : null}
              </div>
            }
            theme={theme}
          />

          {pinMode ? (
            <div className={cn("grid gap-4 rounded-[1.25rem] border p-4", theme.row)}>
              <Field label="Senha atual" type="password" value={currentPassword} onChange={setCurrentPassword} theme={theme} />

              {pinMode === "set" ? (
                <>
                  <PinField label="Novo PIN de 6 digitos" value={newPin} onChange={setNewPin} labelClassName={theme.label} />
                  <PinField label="Confirmar PIN" value={confirmPin} onChange={setConfirmPin} labelClassName={theme.label} />
                </>
              ) : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPinMode(null)
                    setCurrentPassword("")
                    setNewPin("")
                    setConfirmPin("")
                  }}
                  className={cn("h-10 rounded-xl border", theme.secondaryButton)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void handlePinSubmit()}
                  disabled={isWorking}
                  className="h-10 rounded-xl bg-[#009b3a] px-4 text-white hover:bg-[#008633]"
                >
                  {pinMode === "remove" ? "Remover PIN" : security.pinConfigured ? "Salvar novo PIN" : "Salvar PIN"}
                </Button>
              </div>
            </div>
          ) : null}

          <SecurityRow
            icon={<Fingerprint className="size-4" />}
            title="Biometria"
            description={
              security.trustedDeviceEnabled
                ? "Usa Face ID, Touch ID, Android biometrico ou Windows Hello via WebAuthn."
                : "Ative primeiro o dispositivo confiavel para usar biometria."
            }
            value={security.biometricEnabled ? "Ativada" : "Desativada"}
            action={
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleBiometricToggle()}
                disabled={isWorking || !security.trustedDeviceEnabled}
                className={cn("h-10 rounded-xl border px-4", theme.secondaryButton)}
              >
                {security.biometricEnabled ? "Desativar" : "Ativar"}
              </Button>
            }
            theme={theme}
          />

          <SecurityRow
            icon={<Smartphone className="size-4" />}
            title="Ultimo acesso"
            description="Atualizado automaticamente a cada autenticacao bem-sucedida neste dispositivo."
            value={lastAccessLabel}
            theme={theme}
          />
        </div>

        <div className={cn("grid gap-3 rounded-[1.25rem] border p-4", theme.row)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={cn("text-sm font-semibold", theme.text)}>Dispositivos conectados</p>
              <p className={cn("mt-1 text-sm", theme.subtitle)}>
                Estrutura pronta para futuras acoes remotas e gerenciamento detalhado.
              </p>
            </div>
            <span className={cn("text-xs uppercase tracking-[0.18em]", theme.muted)}>Futuro</span>
          </div>

          <div className="grid gap-3">
            {security.devices.length === 0 ? (
              <p className={cn("text-sm", theme.subtitle)}>Nenhum dispositivo confiavel registrado ainda.</p>
            ) : (
              security.devices.map((device) => (
                <div key={device.id} className={cn("rounded-[1rem] border px-4 py-3", theme.row)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className={cn("text-sm font-medium", theme.text)}>
                        {device.label}
                        {device.isCurrent ? " - atual" : ""}
                      </p>
                      <p className={cn("mt-1 text-xs", theme.subtitle)}>
                        {device.lastAccessAt
                          ? `Ultimo acesso em ${format(new Date(device.lastAccessAt), "dd/MM/yyyy 'as' HH:mm", {
                              locale: ptBR,
                            })}`
                          : "Sem acessos registrados ainda"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1",
                          device.biometricEnabled
                            ? "bg-[#009b3a]/12 text-[#009b3a]"
                            : isDark
                              ? "bg-white/[0.08] text-white/65"
                              : "bg-black/[0.04] text-[#6B7280]",
                        )}
                      >
                        {device.biometricEnabled ? "Biometria" : "Sem biometria"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SecurityRow({
  icon,
  title,
  description,
  value,
  action,
  theme,
}: {
  icon: ReactNode
  title: string
  description: string
  value: string
  action?: ReactNode
  theme: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[1rem] border border-inherit px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 flex size-9 items-center justify-center rounded-xl border", theme.iconWrap)}>{icon}</span>
        <div>
          <p className={cn("text-sm font-semibold", theme.text)}>{title}</p>
          <p className={cn("mt-1 text-sm leading-6", theme.subtitle)}>{description}</p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <span className={cn("text-sm font-medium", theme.text)}>{value}</span>
        {action}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  theme,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  theme: Record<string, string>
}) {
  return (
    <div className="grid gap-2">
      <Label className={cn("text-sm font-medium", theme.label)}>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn("h-11 rounded-xl", theme.input)} />
    </div>
  )
}

function PinField({
  label,
  value,
  onChange,
  labelClassName,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  labelClassName: string
}) {
  return (
    <div className="grid gap-2">
      <Label className={cn("text-sm font-medium", labelClassName)}>{label}</Label>
      <PinCodeInput value={value} onChange={onChange} />
    </div>
  )
}
