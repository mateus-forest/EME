"use client"

import { useEffect } from "react"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"

export type AuthMode = "login" | "signup"

export function AuthPanel({
  mode,
  onModeChange,
  onClose,
}: {
  mode: AuthMode
  onModeChange: (m: AuthMode) => void
  onClose: () => void
}) {
  const isLogin = mode === "login"

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="pointer-events-none absolute inset-0 z-[70]">
      <motion.button
        type="button"
        aria-label="Fechar autenticacao"
        className="pointer-events-auto absolute inset-0 cursor-default"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <div
        className="absolute top-1/2 flex w-full -translate-y-1/2 justify-center px-4 sm:inset-x-auto sm:right-8 sm:w-auto sm:justify-end sm:px-0 lg:right-14"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <motion.div
          className="pointer-events-auto w-full max-w-[420px] sm:w-[88vw]"
          initial={{ x: 72, opacity: 0, filter: "blur(10px)" }}
          animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ x: 72, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative overflow-hidden rounded-[30px] border border-white/40 bg-white/50 px-9 py-8 shadow-[0_26px_70px_-54px_rgba(20,52,36,0.4)] backdrop-blur-3xl sm:px-12 sm:py-9">
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground/70"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              >
                <div className="pr-6">
                  <h2 className="text-pretty text-[26px] font-semibold leading-tight tracking-tight text-foreground sm:text-[28px]">
                    {isLogin ? "Bem-vindo de volta." : "Comece a vender mais."}
                  </h2>
                  <p className="mt-2.5 text-pretty text-[14px] leading-relaxed text-foreground/55">
                    {isLogin
                      ? "Continue para acessar o seu Sistema Operacional."
                      : "Crie sua conta gratuitamente e descubra uma nova forma de operar o mercado imobiliario."}
                  </p>
                </div>

                <form className="mt-7 flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
                  {!isLogin && <Field label="Nome" type="text" autoComplete="name" placeholder="Seu nome completo" />}
                  <Field label="Email" type="email" autoComplete="email" placeholder="voce@email.com" />
                  <Field
                    label="Senha"
                    type="password"
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder="........"
                  />
                  {!isLogin && (
                    <Field label="Confirmar senha" type="password" autoComplete="new-password" placeholder="........" />
                  )}

                  <button
                    type="submit"
                    className="eme-gradient mt-2 w-full rounded-full py-3 text-[14px] font-medium tracking-tight text-primary-foreground shadow-[0_14px_30px_-12px_rgba(28,120,60,0.65)] transition-[transform,filter] duration-200 ease-out hover:-translate-y-0.5"
                  >
                    {isLogin ? "Entrar" : "Criar conta"}
                  </button>
                </form>

                {isLogin && (
                  <>
                    <div className="my-5 flex items-center gap-4">
                      <span className="h-px flex-1 bg-foreground/10" />
                      <span className="text-[12px] font-medium tracking-wide text-foreground/40">ou</span>
                      <span className="h-px flex-1 bg-foreground/10" />
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-3 rounded-full border border-foreground/12 bg-white/60 py-2.5 text-[14px] font-medium tracking-tight text-foreground/80 transition-colors duration-200 hover:bg-white"
                    >
                      <GoogleMark />
                      Continuar com Google
                    </button>
                  </>
                )}

                <p className="mt-6 text-center text-[13.5px] text-foreground/55">
                  {isLogin ? "Ainda nao possui uma conta? " : "Ja possui uma conta? "}
                  <button
                    type="button"
                    onClick={() => onModeChange(isLogin ? "signup" : "login")}
                    className="font-medium text-eme transition-colors hover:text-eme-dark"
                  >
                    {isLogin ? "Criar conta" : "Entrar"}
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium tracking-tight text-foreground/60">{label}</span>
      <input
        {...props}
        className="w-full rounded-2xl border border-foreground/12 bg-white/70 px-4 py-2.5 text-[14px] text-foreground outline-none transition-[border-color,box-shadow] duration-300 ease-out placeholder:text-foreground/30 focus:border-eme focus:shadow-[0_0_0_3px_rgba(31,143,78,0.12)]"
      />
    </label>
  )
}

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
