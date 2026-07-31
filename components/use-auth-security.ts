"use client"

import { useCallback, useEffect, useState } from "react"

import {
  canUsePlatformBiometrics,
  disableBiometricCredential,
  disableTrustedDevice,
  enableTrustedDevice,
  fetchAuthSecurityStatus,
  registerBiometricCredential,
  saveSecurityPin,
  type AuthSecurityStatus,
} from "@/lib/premium-auth-client"

const defaultSecurity: AuthSecurityStatus = {
  trustedDeviceEnabled: false,
  pinConfigured: false,
  biometricEnabled: false,
  lastAccessAt: null,
  devices: [],
}

export function useAuthSecurity() {
  const [security, setSecurity] = useState<AuthSecurityStatus>(defaultSecurity)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSecurity = useCallback(async () => {
    setIsLoading(true)

    try {
      const nextSecurity = await fetchAuthSecurityStatus()
      setSecurity(nextSecurity)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshSecurity()
  }, [refreshSecurity])

  const activateTrustedDevice = useCallback(async () => {
    await enableTrustedDevice()
    await refreshSecurity()
  }, [refreshSecurity])

  const deactivateTrustedDevice = useCallback(async () => {
    await disableTrustedDevice()
    await refreshSecurity()
  }, [refreshSecurity])

  const updatePin = useCallback(
    async (action: "set" | "remove", currentPassword: string, newPin?: string) => {
      await saveSecurityPin(action, currentPassword, newPin)
      await refreshSecurity()
    },
    [refreshSecurity],
  )

  const activateBiometric = useCallback(async () => {
    const available = await canUsePlatformBiometrics()
    if (!available) {
      throw new Error("A biometria deste dispositivo nao esta disponivel no navegador atual.")
    }

    await registerBiometricCredential()
    await refreshSecurity()
  }, [refreshSecurity])

  const deactivateBiometric = useCallback(async () => {
    await disableBiometricCredential()
    await refreshSecurity()
  }, [refreshSecurity])

  return {
    security,
    isLoading,
    refreshSecurity,
    activateTrustedDevice,
    deactivateTrustedDevice,
    updatePin,
    activateBiometric,
    deactivateBiometric,
  }
}
