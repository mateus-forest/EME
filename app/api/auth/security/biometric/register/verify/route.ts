import { verifyRegistrationResponse } from "@simplewebauthn/server"
import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { resolveTrustedDevice } from "@/lib/auth-device"
import {
  clearWebAuthnActionCookie,
  getOriginFromRequest,
  getRpIdFromHost,
  WEBAUTHN_ACTION_COOKIE_NAME,
  verifyWebAuthnActionToken,
} from "@/lib/premium-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const trustedDevice = await resolveTrustedDevice(request)
  if (!trustedDevice || trustedDevice.userId !== user.id) {
    return NextResponse.json(
      { error: "Ative este dispositivo como confiavel antes de habilitar a biometria." },
      { status: 400 },
    )
  }

  const actionToken = request.cookies.get(WEBAUTHN_ACTION_COOKIE_NAME)?.value
  if (!actionToken) {
    return NextResponse.json({ error: "Desafio biometrico nao encontrado." }, { status: 400 })
  }

  const action = await verifyWebAuthnActionToken(actionToken).catch(() => null)
  if (!action || action.purpose !== "registration" || action.userId !== user.id || action.deviceId !== trustedDevice.id) {
    const response = NextResponse.json({ error: "Desafio biometrico invalido." }, { status: 400 })
    clearWebAuthnActionCookie(response)
    return response
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    const response = NextResponse.json({ error: "Resposta biometrica invalida." }, { status: 400 })
    clearWebAuthnActionCookie(response)
    return response
  }

  const expectedOrigin = getOriginFromRequest(request)
  const rpID = getRpIdFromHost(new URL(expectedOrigin).host)

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: action.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    requireUserVerification: true,
  }).catch((caughtError) => {
    console.error("[auth][security][biometric][register][verify] failed", {
      message: caughtError instanceof Error ? caughtError.message : "unknown",
    })
    return null
  })

  if (!verification?.verified || !verification.registrationInfo) {
    const response = NextResponse.json({ error: "Nao foi possivel concluir a biometria." }, { status: 400 })
    clearWebAuthnActionCookie(response)
    return response
  }

  const credential = verification.registrationInfo.credential

  await prisma.$transaction([
    prisma.userPasskeyCredential.upsert({
      where: {
        credentialId: credential.id,
      },
      update: {
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? undefined,
        deviceType: verification.registrationInfo.credentialDeviceType ?? null,
        backedUp: verification.registrationInfo.credentialBackedUp ?? false,
      },
      create: {
        userId: user.id,
        deviceId: trustedDevice.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? undefined,
        deviceType: verification.registrationInfo.credentialDeviceType ?? null,
        backedUp: verification.registrationInfo.credentialBackedUp ?? false,
      },
    }),
    prisma.userTrustedDevice.update({
      where: { id: trustedDevice.id },
      data: {
        biometricEnabled: true,
      },
    }),
  ])

  const response = NextResponse.json({ success: true, biometricEnabled: true })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  clearWebAuthnActionCookie(response)
  return response
}
