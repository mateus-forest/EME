import { verifyAuthenticationResponse } from "@simplewebauthn/server"
import { NextRequest, NextResponse } from "next/server"

import { authUserSelect } from "@/lib/auth-route"
import { resolveTrustedDevice } from "@/lib/auth-device"
import { createAuthToken, setAuthCookie } from "@/lib/auth"
import {
  clearTrustedDeviceCookie,
  clearWebAuthnActionCookie,
  getOriginFromRequest,
  getRpIdFromHost,
  WEBAUTHN_ACTION_COOKIE_NAME,
  verifyWebAuthnActionToken,
} from "@/lib/premium-auth"
import { prisma } from "@/lib/prisma"
import { buildSessionProfile } from "@/lib/session-profile"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const actionToken = request.cookies.get(WEBAUTHN_ACTION_COOKIE_NAME)?.value

  if (!actionToken) {
    return NextResponse.json({ error: "Desafio biométrico não encontrado. Tente novamente." }, { status: 400 })
  }

  const trustedDevice = await resolveTrustedDevice(request)

  if (!trustedDevice) {
    const response = NextResponse.json({ error: "Dispositivo confiável não encontrado." }, { status: 401 })
    clearTrustedDeviceCookie(response)
    clearWebAuthnActionCookie(response)
    return response
  }

  const action = await verifyWebAuthnActionToken(actionToken).catch(() => null)

  if (!action || action.purpose !== "authentication" || action.deviceId !== trustedDevice.id || action.userId !== trustedDevice.userId) {
    const response = NextResponse.json({ error: "Desafio biométrico inválido." }, { status: 400 })
    clearWebAuthnActionCookie(response)
    return response
  }

  const body = await request.json().catch(() => null)
  const responseBody = body?.response

  if (!responseBody || typeof responseBody !== "object") {
    const response = NextResponse.json({ error: "Resposta biométrica inválida." }, { status: 400 })
    clearWebAuthnActionCookie(response)
    return response
  }

  const credentialId = typeof body?.id === "string" ? body.id : typeof body?.rawId === "string" ? body.rawId : null
  const storedCredential = trustedDevice.passkeyCredentials.find((credential) => credential.credentialId === credentialId)

  if (!storedCredential) {
    const response = NextResponse.json({ error: "Credencial biométrica não encontrada para este dispositivo." }, { status: 404 })
    clearWebAuthnActionCookie(response)
    return response
  }

  const expectedOrigin = getOriginFromRequest(request)
  const rpID = getRpIdFromHost(new URL(expectedOrigin).host)

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: action.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    requireUserVerification: true,
    credential: {
      id: storedCredential.credentialId,
      publicKey: new Uint8Array(storedCredential.publicKey),
      counter: storedCredential.counter,
      transports: Array.isArray(storedCredential.transports) ? (storedCredential.transports as AuthenticatorTransport[]) : undefined,
    },
  }).catch((error) => {
    console.error("[auth][device][biometric][verify] failed", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return null
  })

  if (!verification?.verified) {
    const response = NextResponse.json({ error: "Não foi possível validar a biometria." }, { status: 401 })
    clearWebAuthnActionCookie(response)
    return response
  }

  await prisma.$transaction([
    prisma.userTrustedDevice.update({
      where: { id: trustedDevice.id },
      data: {
        pinFailures: 0,
        lastAccessAt: new Date(),
        lastBiometricLoginAt: new Date(),
      },
    }),
    prisma.userPasskeyCredential.update({
      where: { id: storedCredential.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    }),
  ])

  const user = await prisma.user.findUnique({
    where: { id: trustedDevice.userId },
    select: authUserSelect,
  })

  if (!user) {
    const response = NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 })
    clearTrustedDeviceCookie(response)
    clearWebAuthnActionCookie(response)
    return response
  }

  const token = await createAuthToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  const response = NextResponse.json({ user: buildSessionProfile(user) })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  setAuthCookie(response, token)
  clearWebAuthnActionCookie(response)
  return response
}
