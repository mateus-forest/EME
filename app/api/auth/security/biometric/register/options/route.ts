import { Buffer } from "node:buffer"

import { generateRegistrationOptions } from "@simplewebauthn/server"
import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { resolveTrustedDevice } from "@/lib/auth-device"
import {
  getOriginFromRequest,
  getRpIdFromHost,
  setWebAuthnActionCookie,
} from "@/lib/premium-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const trustedDevice = await resolveTrustedDevice(request)
  if (!trustedDevice || trustedDevice.userId !== user.id) {
    return NextResponse.json(
      { error: "Ative este dispositivo como confiável antes de habilitar a biometria." },
      { status: 400 },
    )
  }

  const expectedOrigin = getOriginFromRequest(request)
  const rpID = getRpIdFromHost(new URL(expectedOrigin).host)

  const options = await generateRegistrationOptions({
    rpName: "EME",
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new Uint8Array(Buffer.from(user.id, "utf8")),
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: trustedDevice.passkeyCredentials.map((credential) => ({
      id: credential.credentialId,
      transports: Array.isArray(credential.transports) ? (credential.transports as AuthenticatorTransport[]) : undefined,
    })),
  })

  const response = NextResponse.json({ options })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  await setWebAuthnActionCookie(response, {
    purpose: "registration",
    challenge: options.challenge,
    userId: user.id,
    deviceId: trustedDevice.id,
  })
  return response
}
