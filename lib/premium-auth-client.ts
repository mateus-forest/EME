"use client"

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"

import { clearLegacyAuthState, type AuthenticatedUser } from "@/lib/auth-client"

export type TrustedDeviceStatus = {
  trusted: boolean
  device?: {
    label: string
    browser: string | null
    platform: string | null
    biometricEnabled: boolean
    pinConfigured: boolean
    remainingPinAttempts: number
    lastAccessAt: string | null
    userName: string
    emailMasked: string
  }
}

export type AuthSecurityStatus = {
  trustedDeviceEnabled: boolean
  pinConfigured: boolean
  biometricEnabled: boolean
  lastAccessAt: string | null
  devices: Array<{
    id: string
    label: string
    browser: string | null
    platform: string | null
    biometricEnabled: boolean
    trustedAt: string
    lastAccessAt: string | null
    isCurrent: boolean
  }>
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
}

export async function fetchTrustedDeviceStatus() {
  const response = await fetch("/api/auth/device", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })

  return parseJson<TrustedDeviceStatus>(response)
}

export function supportsPlatformBiometrics() {
  if (typeof window === "undefined" || typeof PublicKeyCredential === "undefined") {
    return false
  }

  return true
}

export async function canUsePlatformBiometrics() {
  if (!supportsPlatformBiometrics()) return false

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function loginWithPassword(email: string, password: string) {
  clearLegacyAuthState()

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      method: "password",
      email: email.trim().toLowerCase(),
      password,
    }),
  })

  const data = await parseJson<{ user?: AuthenticatedUser; error?: string }>(response)

  if (!response.ok || !data?.user) {
    throw new Error(data?.error || "Nao foi possivel entrar agora.")
  }

  return data.user
}

export async function loginWithTrustedPin(pin: string) {
  clearLegacyAuthState()

  const response = await fetch("/api/auth/device/pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ pin }),
  })

  const data = await parseJson<{ user?: AuthenticatedUser; error?: string; fallback?: string; remainingPinAttempts?: number }>(response)

  if (!response.ok || !data?.user) {
    const error = new Error(data?.error || "Nao foi possivel validar o PIN.")
    ;(error as Error & { fallback?: string }).fallback = data?.fallback
    throw error
  }

  return data.user
}

export async function loginWithTrustedBiometrics() {
  clearLegacyAuthState()

  const optionsResponse = await fetch("/api/auth/device/biometric/options", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  })

  const optionsData = await parseJson<{ options?: PublicKeyCredentialRequestOptionsJSON; error?: string }>(optionsResponse)

  if (!optionsResponse.ok || !optionsData?.options) {
    throw new Error(optionsData?.error || "Nao foi possivel iniciar a biometria.")
  }

  const assertion = await startAuthentication({ optionsJSON: optionsData.options })

  const verifyResponse = await fetch("/api/auth/device/biometric/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(assertion),
  })

  const verifyData = await parseJson<{ user?: AuthenticatedUser; error?: string }>(verifyResponse)

  if (!verifyResponse.ok || !verifyData?.user) {
    throw new Error(verifyData?.error || "Nao foi possivel concluir a biometria.")
  }

  return verifyData.user
}

export async function fetchAuthSecurityStatus() {
  const response = await fetch("/api/auth/security", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })

  const data = await parseJson<{ security?: AuthSecurityStatus; error?: string }>(response)

  if (!response.ok || !data?.security) {
    throw new Error(data?.error || "Nao foi possivel carregar a seguranca da conta.")
  }

  return data.security
}

export async function enableTrustedDevice() {
  const response = await fetch("/api/auth/security/trusted-device", {
    method: "POST",
    credentials: "include",
  })

  if (!response.ok) {
    const data = await parseJson<{ error?: string }>(response)
    throw new Error(data?.error || "Nao foi possivel confiar neste dispositivo.")
  }
}

export async function disableTrustedDevice() {
  const response = await fetch("/api/auth/security/trusted-device", {
    method: "DELETE",
    credentials: "include",
  })

  if (!response.ok) {
    const data = await parseJson<{ error?: string }>(response)
    throw new Error(data?.error || "Nao foi possivel remover este dispositivo confiavel.")
  }
}

export async function saveSecurityPin(action: "set" | "remove", currentPassword: string, newPin?: string) {
  const response = await fetch("/api/auth/security/pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      action,
      currentPassword,
      newPin,
    }),
  })

  const data = await parseJson<{ success?: boolean; error?: string }>(response)

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Nao foi possivel atualizar o PIN.")
  }
}

export async function registerBiometricCredential() {
  const optionsResponse = await fetch("/api/auth/security/biometric/register/options", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  })

  const optionsData = await parseJson<{ options?: PublicKeyCredentialCreationOptionsJSON; error?: string }>(optionsResponse)

  if (!optionsResponse.ok || !optionsData?.options) {
    throw new Error(optionsData?.error || "Nao foi possivel iniciar a biometria.")
  }

  const credential = await startRegistration({ optionsJSON: optionsData.options })

  const verifyResponse = await fetch("/api/auth/security/biometric/register/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(credential),
  })

  const verifyData = await parseJson<{ success?: boolean; error?: string }>(verifyResponse)

  if (!verifyResponse.ok || !verifyData?.success) {
    throw new Error(verifyData?.error || "Nao foi possivel concluir a biometria.")
  }
}

export async function disableBiometricCredential() {
  const response = await fetch("/api/auth/security/biometric", {
    method: "DELETE",
    credentials: "include",
  })

  const data = await parseJson<{ success?: boolean; error?: string }>(response)

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Nao foi possivel desativar a biometria.")
  }
}
