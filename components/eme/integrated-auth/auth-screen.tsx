"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react"
import { Fingerprint, KeyRound, LockKeyhole } from "lucide-react"
import { PinCodeInput } from "@/components/ui/pin-code-input"
import { CRECI_UF_OPTIONS } from "@/lib/creci-validation"
import { signupJourneyInvalid, signupJourneyProgress } from "@/lib/journey/browser"
import { useAuthForm, type AuthMode } from "../use-auth-form"
import "./auth.css"

type AuthPage = "login" | "cadastro" | "recuperar-senha"

function AuthFrame({ page, children, loading = false }: { page: AuthPage; children: ReactNode; loading?: boolean }) {
  const router = useRouter()
  const signup = page === "cadastro"
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) router.replace("/", { scroll: false })
    }
    window.addEventListener("keydown", close)
    setReady(true)
    return () => window.removeEventListener("keydown", close)
  }, [router])
  return (
    <div className="eme-integrated-auth" data-auth-page={page} data-auth-ready={ready && !loading}>
      <main className="auth-shell">
        <aside className="auth-story" aria-label="Seu negócio no EME">
          <Brand />
          <div className="story-copy">
            <p className="eyebrow">ECOSSISTEMA DO CORRETOR DE IMÓVEIS</p>
            <h2>{signup ? <>Uma estrutura à altura<br /><em>do seu próximo passo.</em></> : <>Tudo no seu lugar.<br /><em>Você em movimento.</em></>}</h2>
            <p>{signup ? "Clientes, imóveis e negociações conectados. Mais clareza para cuidar do seu negócio." : "Sua carteira, suas conversas e seus próximos negócios. O seu dia começa com clareza."}</p>
          </div>
          <div className="catalog-stack" aria-label="Exemplo de apresentação de imóvel">
            <div className="catalog-paper">
              <div className="paper-top"><strong>SEU CATÁLOGO</strong><span>FEITO PARA CONECTAR</span></div>
              <img src="/auth-2026/assets/apartamento.png" alt="Apartamento com varanda e luz natural" width={1536} height={1024} />
              <div className="paper-caption"><strong>Um novo endereço.<br />Novas possibilidades.</strong><p>Apartamento com varanda · Imóvel de exemplo</p></div>
              <div className="paper-footer"><span className="paper-seal" aria-hidden="true">✓</span><span>Seu nome. Sua identidade. Seu negócio.</span></div>
            </div>
          </div>
          <p className="story-foot">SEU TEMPO. SEU NOME. SEU NEGÓCIO.</p>
        </aside>
        <section className={`auth-panel${signup ? " signup-panel" : ""}`} aria-labelledby="form-title">
          <header className="panel-top"><div className="mobile-brand"><Brand /></div><Link className="back-link" href="/"><span aria-hidden="true">←</span> Voltar ao início</Link></header>
          <div className="auth-main" inert={!ready && !loading}>{children}</div>
          <footer className="auth-footer">EME · Seu negócio, com estrutura.</footer>
        </section>
      </main>
    </div>
  )
}

function Brand() {
  return <Link className="auth-brand" href="/" aria-label="EME — início"><img src="/auth-2026/assets/eme-logo-header.png" alt="EME" width={1563} height={1563} /></Link>
}

export function AuthLoadingScreen({ mode }: { mode: AuthMode }) {
  return <AuthFrame page={mode === "login" ? "login" : "cadastro"} loading>
    <div className="auth-heading">
      <p className="eyebrow">SEU ESPAÇO NO EME</p>
      <h1 id="form-title">{mode === "login" ? "Bom ter você de volta." : "Seu próximo passo começa aqui."}</h1>
      <p role="status">Carregando formulário...</p>
    </div>
  </AuthFrame>
}

/** The package provides presentation only; submissions use the existing controller. */
export function IntegratedAuthScreen({ mode }: { mode: AuthMode }) {
  const form = useAuthForm(mode, "auth_page")
  const [step, setStep] = useState(0)
  const [capsLock, setCapsLock] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const stepChanged = useRef(false)
  const busy = form.isSubmitting || form.isLoginSubmitting
  const error = form.error || (form.isLogin ? form.loginError : "")
  useEffect(() => { setStep(0); setCapsLock(false); stepChanged.current = false }, [mode])
  useEffect(() => {
    if (!stepChanged.current) return
    headingRef.current?.focus({ preventScroll: true })
    headingRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" })
  }, [step])
  useEffect(() => {
    if (!error) return
    errorRef.current?.focus({ preventScroll: true })
    errorRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" })
  }, [error])

  function changeStep(next: number) {
    form.setError(""); setCapsLock(false); stepChanged.current = true; setStep(next)
  }
  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    if (step === 0) {
      event.preventDefault()
      form.setError("")
      if (!form.name.trim() || !form.signupEmail.trim() || !form.signupPassword || !form.confirmPassword) {
        signupJourneyInvalid("REQUIRED_FIELDS")
        form.setError("Preencha os campos obrigatórios para continuar.")
        return
      }
      if (form.signupPassword !== form.confirmPassword) {
        signupJourneyInvalid("PASSWORD_MISMATCH")
        form.setError("As senhas não coincidem.")
        return
      }
      changeStep(1)
      return
    }
    await form.handleSubmit(event)
  }
  const alert = error ? <div ref={errorRef} className="status-box error" role="alert" tabIndex={-1}>{error}</div> : null
  return (
    <AuthFrame page={form.isLogin ? "login" : "cadastro"}>
      <nav className="mode-switch" aria-label="Acesso à conta">
        <Link href="/login" aria-current={form.isLogin ? "page" : undefined}>Entrar</Link>
        <Link href="/cadastro" aria-current={!form.isLogin ? "page" : undefined}>Criar conta</Link>
      </nav>
      <div className="auth-heading">
        <p className="eyebrow">{form.isLogin ? "SEU ESPAÇO NO EME" : "UM NOVO COMEÇO"}</p>
        <h1 id="form-title" ref={headingRef} tabIndex={-1}>{form.isLogin ? "Bom ter você de volta." : step === 0 ? <>Seu próximo passo<br />começa aqui.</> : "Agora, a sua identidade."}</h1>
        <p id="form-description">{form.isLogin ? <>Entre para continuar de onde parou.<br />Seu negócio está no lugar certo.</> : step === 0 ? <>Crie sua conta e dê ao seu trabalho<br />a estrutura que ele merece. Ao clicar em Continuar, você deverá informar seu CRECI e a UF do registro.</> : "Complete seus dados profissionais para criar sua conta."}</p>
      </div>
      {form.isLogin ? (
        <form id="login-form" onSubmit={form.handleSubmit} aria-busy={busy}>
          <div className="login-methods" aria-label="Método de acesso">
            <button type="button" className="method-button" aria-pressed={form.loginMethod === "password"} onClick={() => form.setLoginMethod("password")} disabled={busy}><LockKeyhole size={16} aria-hidden="true" /> Email e senha</button>
            <button type="button" className="method-button" aria-pressed={form.loginMethod === "pin"} onClick={() => form.setLoginMethod("pin")} disabled={busy}><KeyRound size={16} aria-hidden="true" /> Entrar com PIN</button>
          </div>
          {form.loginMethod === "password" ? <>
            {/* Native values survive autofill even when another field triggers a render. */}
            <AuthField id="login-email" label="E-mail" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com" defaultValue={form.email} onChange={event => form.setEmail(event.target.value)} disabled={busy} />
            <AuthField id="login-password" label="Senha" type="password" autoComplete="current-password" placeholder="Sua senha" defaultValue={form.password} onChange={event => form.setPassword(event.target.value)} onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} disabled={busy} />
            <p className="field-hint caps-warning" hidden={!capsLock}>Caps Lock está ativado.</p>
            <div className="form-options"><Link href="/recuperar-senha" className="text-link">Esqueci minha senha</Link></div>
          </> : <div className="field">
            <div className="field-label"><span>PIN de 6 dígitos</span>{form.trustedDevice?.emailMasked ? <span>{form.trustedDevice.emailMasked}</span> : null}</div>
            <PinCodeInput value={form.pin} onChange={form.setPin} autoFocus disabled={busy} className="pin-inputs" inputClassName="pin-digit" />
          </div>}
          {alert}
          <button type="submit" className="primary-action" disabled={busy || (form.loginMethod === "pin" && form.pinAvailable && form.pin.length < 6)}><span>{busy ? "Entrando..." : "Entrar no EME"}</span><span aria-hidden="true">→</span></button>
          {form.loginMethod === "pin" && form.biometricAvailable ? <button type="button" className="biometric-action" disabled={busy || form.isCheckingDevice} onClick={() => void form.submitBiometric()}><Fingerprint size={18} aria-hidden="true" />{form.biometricLabel}</button> : null}
        </form>
      ) : <>
        <div className="account-steps" aria-label="Etapas do cadastro">
          <span className={step === 0 ? "current" : undefined} aria-current={step === 0 ? "step" : undefined}><b>01</b> Sua conta</span><i aria-hidden="true" />
          <span className={step === 1 ? "current" : undefined} aria-current={step === 1 ? "step" : undefined}><b>02</b> Seu perfil</span>
        </div>
        <form id="signup-form" onSubmit={submitSignup} aria-busy={busy} onBlurCapture={event => signupJourneyProgress(event.currentTarget)} onInvalidCapture={() => signupJourneyInvalid()}>
          {/* Keep both steps mounted so values and existing Journey milestones persist. */}
          <fieldset id="account-fields" className="step-panel" hidden={step !== 0} disabled={step !== 0 || busy}>
            <AuthField id="full-name" label="Nome completo" type="text" autoComplete="name" placeholder="Como você quer ser chamado" value={form.name} onChange={event => form.setName(event.target.value)} />
            <AuthField id="signup-email" label="E-mail profissional" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="voce@exemplo.com" value={form.signupEmail} onChange={event => form.setSignupEmail(event.target.value)} />
            <AuthField id="signup-password" label="Crie uma senha" type="password" autoComplete="new-password" placeholder="Sua senha" value={form.signupPassword} onChange={event => form.setSignupPassword(event.target.value)} onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} />
            <AuthField id="confirm-password" label="Confirmar senha" type="password" autoComplete="new-password" placeholder="Repita sua senha" value={form.confirmPassword} onChange={event => form.setConfirmPassword(event.target.value)} onKeyUp={event => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} />
            <p className="field-hint caps-warning" hidden={!capsLock}>Caps Lock está ativado.</p>
            {step === 0 ? alert : null}
            <button className="primary-action" type={step === 0 ? "submit" : "button"} disabled={busy}><span>Continuar</span><span aria-hidden="true">→</span></button>
          </fieldset>
          <fieldset id="professional-fields" className="step-panel" hidden={step !== 1} disabled={step !== 1 || busy}>
            <div className="profession-grid">
              <AuthField id="creci" label="CRECI" aria-label="Número do CRECI" type="text" inputMode="text" autoComplete="off" placeholder="Ex.: 12345 F" pattern="[0-9]+(?:[ -]*[A-Za-z]{1,3})?" value={form.creci} onChange={event => form.setCreci(event.target.value)} />
              <div className="field"><label className="field-label" htmlFor="creci-uf">UF</label><select id="creci-uf" name="creciUf" required aria-label="UF do CRECI" value={form.creciUf} onChange={event => form.setCreciUf(event.target.value)}><option value="">UF</option>{CRECI_UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
            </div>
            <p className="field-hint">Esses dados compõem a sua apresentação profissional. O selo de verificação depende da validação do CRECI.</p>
            {step === 1 ? alert : null}
            <button className="primary-action" type={step === 1 ? "submit" : "button"} style={{ marginTop: 24 }} disabled={busy}><span>{busy ? "Criando conta..." : "Criar minha conta"}</span><span aria-hidden="true">→</span></button>
            <button className="back-step" type="button" onClick={() => changeStep(0)} disabled={busy}>← Voltar para sua conta</button>
          </fieldset>
        </form>
      </>}
      <p className="form-switch">{form.isLogin ? <>Ainda não tem uma conta? <Link href="/cadastro">Comece por aqui</Link></> : <>Já faz parte do EME? <Link href="/login">Entre na sua conta</Link></>}</p>
    </AuthFrame>
  )
}

export function IntegratedRecoveryScreen() {
  return <AuthFrame page="recuperar-senha">
    <div className="auth-heading"><p className="eyebrow">VAMOS AJUDAR VOCÊ</p><h1 id="form-title">Um caminho de volta.</h1><p>Recupere o acesso à sua conta.</p></div>
    <div className="status-box pending" id="recovery-status" role="status">A recuperação de senha ainda não está disponível. Você pode voltar ao login e usar os métodos de acesso já configurados na sua conta.</div>
    <div id="recovery-form" aria-describedby="recovery-status">
      <AuthField id="recovery-email" label="E-mail da sua conta" type="email" autoComplete="email" placeholder="voce@exemplo.com" disabled aria-describedby="recovery-status" />
      <button className="primary-action" type="button" disabled aria-describedby="recovery-status"><span>Recuperar acesso</span><span aria-hidden="true">→</span></button>
    </div>
    <p className="form-switch"><Link href="/login">← Voltar para o login</Link></p>
  </AuthFrame>
}

function AuthField({ id, label, type, ...props }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  const [validationMessage, setValidationMessage] = useState("")
  const isPassword = type === "password"
  const errorId = `${id}-error`
  const describedBy = [props["aria-describedby"], validationMessage ? errorId : null].filter(Boolean).join(" ") || undefined
  const input = <input {...props} id={id} name={props.name ?? id} type={isPassword && visible ? "text" : type} required={props.required ?? true}
    aria-describedby={describedBy} aria-invalid={Boolean(validationMessage) || undefined}
    onInvalid={event => { setValidationMessage(event.currentTarget.validationMessage); props.onInvalid?.(event) }}
    onChange={event => { setValidationMessage(""); props.onChange?.(event) }} />
  return <div className="field">
    <label className="field-label" htmlFor={id}>{label}</label>
    {isPassword ? <div className="password-wrap">{input}<button className="password-toggle" type="button" disabled={props.disabled} onClick={() => setVisible(!visible)} aria-controls={id} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} aria-pressed={visible}>{visible ? "Ocultar" : "Mostrar"}</button></div> : input}
    <span className="field-error" id={errorId} aria-live="polite">{validationMessage}</span>
  </div>
}
