"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import type { AuthenticatedUser } from "@/lib/auth-client"
import {
  canUsePlatformBiometrics,
  fetchTrustedDeviceStatus,
  loginWithPassword,
  loginWithTrustedBiometrics,
  loginWithTrustedPin,
  supportsPlatformBiometrics,
  type TrustedDeviceStatus,
} from "@/lib/premium-auth-client"

type PremiumLoginMode = "loading" | "password" | "pin" | "biometric"

export function usePremiumLogin(onAuthenticated: (user: AuthenticatedUser) => void) {
  const [mode, setMode] = useState<PremiumLoginMode>("loading")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trustedStatus, setTrustedStatus] = useState<TrustedDeviceStatus | null>(null)
  const [ignoreTrustedDevice, setIgnoreTrustedDevice] = useState(false)

  const trustedDevice = trustedStatus?.trusted ? trustedStatus.device ?? null : null

  const resolveMode = useCallback(
    async (status: TrustedDeviceStatus | null) => {
      if (ignoreTrustedDevice || !status?.trusted || !status.device) {
        setMode("password")
        return
      }

      const canUseBiometric = status.device.biometricEnabled && supportsPlatformBiometrics() && (await canUsePlatformBiometrics())

      if (canUseBiometric) {
        setMode("biometric")
        return
      }

      if (status.device.pinConfigured) {
        setMode("pin")
        return
      }

      setMode("password")
    },
    [ignoreTrustedDevice],
  )

  const refreshTrustedStatus = useCallback(async () => {
    setMode("loading")
    setError("")

    const status = await fetchTrustedDeviceStatus().catch(() => null)
    setTrustedStatus(status)
    await resolveMode(status)
  }, [resolveMode])

  useEffect(() => {
    void refreshTrustedStatus()
  }, [refreshTrustedStatus])

  const triggerBiometric = useCallback(async () => {
    if (!trustedDevice?.biometricEnabled || ignoreTrustedDevice) return

    setIsSubmitting(true)
    setError("")

    try {
      const user = await loginWithTrustedBiometrics()
      onAuthenticated(user)
      return
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Nao foi possivel validar a biometria."

      if (trustedDevice.pinConfigured) {
        setMode("pin")
        setError(message)
      } else {
        setMode("password")
        setError(message)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [ignoreTrustedDevice, onAuthenticated, trustedDevice])

  useEffect(() => {
    if (mode === "biometric") {
      void triggerBiometric()
    }
  }, [mode, triggerBiometric])

  const submitPassword = useCallback(async () => {
    setIsSubmitting(true)
    setError("")

    try {
      const user = await loginWithPassword(email, password)
      onAuthenticated(user)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel entrar agora.")
    } finally {
      setIsSubmitting(false)
    }
  }, [email, onAuthenticated, password])

  const submitPin = useCallback(async () => {
    setIsSubmitting(true)
    setError("")

    try {
      const user = await loginWithTrustedPin(pin)
      onAuthenticated(user)
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError : new Error("Nao foi possivel validar o PIN.")
      const fallback = "fallback" in nextError ? (nextError as Error & { fallback?: string }).fallback : undefined

      if (fallback === "password") {
        setMode("password")
      }

      setError(nextError.message)
    } finally {
      setIsSubmitting(false)
    }
  }, [onAuthenticated, pin])

  const useAnotherAccount = useCallback(() => {
    setIgnoreTrustedDevice(true)
    setMode("password")
    setPin("")
    setError("")
  }, [])

  const heading = useMemo(() => {
    if (mode === "pin" && trustedDevice) {
      return `Bem-vindo de volta, ${trustedDevice.userName}.`
    }

    if (mode === "biometric" && trustedDevice) {
      return `Autenticando ${trustedDevice.userName}...`
    }

    return "Entrar"
  }, [mode, trustedDevice])

  return {
    mode,
    email,
    password,
    pin,
    error,
    heading,
    isSubmitting,
    trustedDevice,
    setEmail,
    setPassword,
    setPin,
    submitPassword,
    submitPin,
    useAnotherAccount,
    retryBiometric: triggerBiometric,
  }
}
