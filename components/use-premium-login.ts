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

function getBiometricLabel() {
  if (typeof navigator === "undefined") return "Entrar com biometria"

  const userAgent = navigator.userAgent.toLowerCase()

  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("mac os")) {
    return "Entrar com Face ID / Touch ID"
  }

  if (userAgent.includes("windows")) {
    return "Entrar com Windows Hello"
  }

  return "Entrar com biometria"
}

export function usePremiumLogin(onAuthenticated: (user: AuthenticatedUser) => void) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingDevice, setIsCheckingDevice] = useState(true)
  const [trustedStatus, setTrustedStatus] = useState<TrustedDeviceStatus | null>(null)
  const [canUseBiometric, setCanUseBiometric] = useState(false)

  const trustedDevice = trustedStatus?.trusted ? trustedStatus.device ?? null : null

  const refreshTrustedStatus = useCallback(async () => {
    setIsCheckingDevice(true)

    try {
      const status = await fetchTrustedDeviceStatus().catch(() => null)
      setTrustedStatus(status)

      if (status?.trusted && status.device?.biometricEnabled && supportsPlatformBiometrics()) {
        const available = await canUsePlatformBiometrics()
        setCanUseBiometric(available)
      } else {
        setCanUseBiometric(false)
      }
    } finally {
      setIsCheckingDevice(false)
    }
  }, [])

  useEffect(() => {
    void refreshTrustedStatus()
  }, [refreshTrustedStatus])

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
    if (!trustedDevice?.pinConfigured) {
      setError("Voce ainda nao configurou um PIN de acesso. Entre com e-mail e senha e configure em Conta -> Seguranca.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const user = await loginWithTrustedPin(pin)
      onAuthenticated(user)
    } catch (caughtError) {
      const nextError = caughtError instanceof Error ? caughtError : new Error("Nao foi possivel validar o PIN.")
      setError(nextError.message)
    } finally {
      setIsSubmitting(false)
    }
  }, [onAuthenticated, pin, trustedDevice])

  const submitBiometric = useCallback(async () => {
    if (!trustedDevice?.biometricEnabled || !canUseBiometric) {
      setError("A biometria nao esta disponivel neste dispositivo.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const user = await loginWithTrustedBiometrics()
      onAuthenticated(user)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Nao foi possivel validar a biometria.")
    } finally {
      setIsSubmitting(false)
    }
  }, [canUseBiometric, onAuthenticated, trustedDevice])

  const biometricLabel = useMemo(() => getBiometricLabel(), [])

  return {
    heading: "Entrar",
    email,
    password,
    pin,
    error,
    isSubmitting,
    isCheckingDevice,
    trustedDevice,
    pinAvailable: Boolean(trustedDevice?.pinConfigured),
    biometricAvailable: Boolean(trustedDevice?.biometricEnabled && canUseBiometric),
    biometricLabel,
    setEmail,
    setPassword,
    setPin,
    setError,
    submitPassword,
    submitPin,
    submitBiometric,
    refreshTrustedStatus,
  }
}
