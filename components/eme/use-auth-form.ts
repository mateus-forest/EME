"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { usePremiumLogin } from "@/components/use-premium-login"
import { getDefaultRouteByRole, type AuthenticatedUser } from "@/lib/auth-client"
import { resolveAuthRedirect } from "@/lib/auth-redirect"
import { signupJourneyInvalid, signupJourneyStarted } from "@/lib/journey/browser"

export type AuthMode = "login" | "signup"
type LoginMethod = "password" | "pin"

/** Shared form behavior for the existing modal and the integrated auth pages. */
export function useAuthForm(mode: AuthMode, surface: "landing_modal" | "auth_page" = "landing_modal") {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isLogin = mode === "login"
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [creci, setCreci] = useState("")
  const [creciUf, setCreciUf] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password")

  useEffect(() => {
    if (mode === "signup") signupJourneyStarted(surface)
  }, [mode, surface])

  useEffect(() => {
    setError("")
  }, [mode, loginMethod])

  const {
    trustedDevice,
    email,
    password,
    pin,
    error: loginError,
    isSubmitting: isLoginSubmitting,
    isCheckingDevice,
    pinAvailable,
    biometricAvailable,
    biometricLabel,
    setEmail,
    setPassword,
    setPin,
    submitPassword,
    submitPin,
    submitBiometric,
  } = usePremiumLogin((user: AuthenticatedUser) => {
    router.push(resolveAuthRedirect(searchParams.getAll("next"), user.role))
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (isLogin) {
      try {
        if (loginMethod === "pin") {
          await submitPin()
        } else {
          // Autofill can update native fields without notifying React. Snapshot
          // the submitted controls before a loading/error render restores state.
          const emailInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="email"]')
          const passwordInput = event.currentTarget.querySelector<HTMLInputElement>('input[autocomplete="current-password"], input[type="password"]')
          await submitPassword({ email: emailInput?.value ?? email, password: passwordInput?.value ?? password })
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível entrar agora.")
      }

      return
    }

    const trimmedName = name.trim()
    const normalizedEmail = signupEmail.trim().toLowerCase()

    if (!trimmedName || !normalizedEmail || !signupPassword || !creciUf || !creci.trim()) {
      signupJourneyInvalid("REQUIRED_FIELDS")
      setError("Nome, email, senha, UF e CRECI são obrigatórios.")
      return
    }

    if (signupPassword !== confirmPassword) {
      signupJourneyInvalid("PASSWORD_MISMATCH")
      setError("As senhas não coincidem.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          role: "BROKER",
          name: trimmedName,
          email: normalizedEmail,
          creci: creci.trim(),
          creciUf,
          password: signupPassword,
        }),
      })

      const data = (await response.json().catch(() => null)) as { user: AuthenticatedUser } | { error?: string } | null

      if (!response.ok || !data || !("user" in data)) {
        setError(data && "error" in data && data.error ? data.error : "Não foi possível criar sua conta agora.")
        return
      }

      router.push(getDefaultRouteByRole(data.user.role))
    } catch {
      setError("Não foi possível criar sua conta agora. Verifique sua conexão e tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    isLogin,
    isSubmitting,
    name,
    setName,
    signupEmail,
    setSignupEmail,
    creci,
    setCreci,
    creciUf,
    setCreciUf,
    signupPassword,
    setSignupPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    setError,
    loginMethod,
    setLoginMethod,
    trustedDevice,
    email,
    password,
    pin,
    loginError,
    isLoginSubmitting,
    isCheckingDevice,
    pinAvailable,
    biometricAvailable,
    biometricLabel,
    setEmail,
    setPassword,
    setPin,
    submitBiometric,
    handleSubmit,
  }
}
