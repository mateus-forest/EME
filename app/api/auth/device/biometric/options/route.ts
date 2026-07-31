import { generateAuthenticationOptions } from "@simplewebauthn/server"
import { NextRequest, NextResponse } from "next/server"

import { resolveTrustedDevice } from "@/lib/auth-device"
import {
  clearTrustedDeviceCookie,
  getOriginFromRequest,
  getRpIdFromHost,
  setWebAuthnActionCookie,
} from "@/lib/premium-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const trustedDevice = await resolveTrustedDevice(request)

  if (!trustedDevice) {
    const response = NextResponse.json({ error: "Dispositivo confiavel nao encontrado." }, { status: 401 })
    clearTrustedDeviceCookie(response)
    return response
  }

  if (!trustedDevice.biometricEnabled || trustedDevice.passkeyCredentials.length === 0) {
    return NextResponse.json({ error: "Biometria nao configurada para este dispositivo." }, { status: 400 })
  }

  const rpID = getRpIdFromHost(new URL(getOriginFromRequest(request)).host)
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: trustedDevice.passkeyCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: Array.isArray(credential.transports) ? (credential.transports as AuthenticatorTransport[]) : undefined,
    })),
  })

  const response = NextResponse.json({ options })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  await setWebAuthnActionCookie(response, {
    purpose: "authentication",
    challenge: options.challenge,
    userId: trustedDevice.userId,
    deviceId: trustedDevice.id,
  })
  return response
}
