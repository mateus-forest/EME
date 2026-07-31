import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { resolveTrustedDevice } from "@/lib/auth-device"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const trustedDevice = await resolveTrustedDevice(request)
  if (!trustedDevice || trustedDevice.userId !== user.id) {
    return NextResponse.json(
      { error: "Ative este dispositivo como confiável antes de alterar a biometria." },
      { status: 400 },
    )
  }

  await prisma.$transaction([
    prisma.userPasskeyCredential.deleteMany({
      where: {
        userId: user.id,
        deviceId: trustedDevice.id,
      },
    }),
    prisma.userTrustedDevice.update({
      where: { id: trustedDevice.id },
      data: {
        biometricEnabled: false,
      },
    }),
  ])

  return NextResponse.json({ success: true, biometricEnabled: false })
}
