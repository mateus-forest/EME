import { NextRequest, NextResponse } from "next/server"

import { clearTrustedDeviceCookie } from "@/lib/premium-auth"
import { resolveTrustedDevice } from "@/lib/auth-device"

export const dynamic = "force-dynamic"

function maskEmail(email: string) {
  const [local, domain] = email.split("@")
  if (!local || !domain) return email

  const safeLocal =
    local.length <= 2 ? `${local[0] ?? ""}*` : `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}`

  return `${safeLocal}@${domain}`
}

export async function GET(request: NextRequest) {
  const trustedDevice = await resolveTrustedDevice(request)

  if (!trustedDevice) {
    return NextResponse.json({ trusted: false })
  }

  const response = NextResponse.json({
    trusted: true,
    device: {
      label: trustedDevice.label,
      browser: trustedDevice.browser,
      platform: trustedDevice.platform,
      biometricEnabled: trustedDevice.biometricEnabled && trustedDevice.passkeyCredentials.length > 0,
      pinConfigured: Boolean(trustedDevice.user.pinHash),
      remainingPinAttempts: Math.max(0, 3 - trustedDevice.pinFailures),
      lastAccessAt: trustedDevice.lastAccessAt?.toISOString() ?? null,
      userName: trustedDevice.user.name,
      emailMasked: maskEmail(trustedDevice.user.email),
    },
  })
  response.headers.set("Cache-Control", "no-store, max-age=0")

  if (trustedDevice.revokedAt) {
    clearTrustedDeviceCookie(response)
  }

  return response
}
