import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUser } from "@/lib/auth-route"
import { getCurrentDeviceMetadata, resolveTrustedDevice } from "@/lib/auth-device"
import {
  clearTrustedDeviceCookie,
  createTrustedDeviceToken,
  hashTrustedDeviceToken,
  setTrustedDeviceCookie,
} from "@/lib/premium-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const currentDevice = await resolveTrustedDevice(request)
  const { browser, platform, label, userAgent } = getCurrentDeviceMetadata(request)

  const response = NextResponse.json({ success: true })
  response.headers.set("Cache-Control", "no-store, max-age=0")

  if (currentDevice && currentDevice.userId === user.id) {
    await prisma.userTrustedDevice.update({
      where: { id: currentDevice.id },
      data: {
        browser,
        platform,
        label,
        userAgent,
        revokedAt: null,
        trustedAt: new Date(),
        lastAccessAt: new Date(),
        pinFailures: 0,
      },
    })

    return response
  }

  const token = createTrustedDeviceToken()
  const tokenHash = hashTrustedDeviceToken(token)

  if (currentDevice && currentDevice.userId !== user.id) {
    await prisma.userTrustedDevice.update({
      where: { id: currentDevice.id },
      data: {
        revokedAt: new Date(),
      },
    })
  }

  await prisma.userTrustedDevice.create({
    data: {
      userId: user.id,
      tokenHash,
      browser,
      platform,
      label,
      userAgent,
      lastAccessAt: new Date(),
      lastPasswordLoginAt: new Date(),
    },
  })

  setTrustedDeviceCookie(response, token)
  return response
}

export async function DELETE(request: NextRequest) {
  const { error, user } = await getAuthenticatedUser()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
  }

  const currentDevice = await resolveTrustedDevice(request)
  const response = NextResponse.json({ success: true })
  response.headers.set("Cache-Control", "no-store, max-age=0")

  if (currentDevice && currentDevice.userId === user.id) {
    await prisma.userTrustedDevice.update({
      where: { id: currentDevice.id },
      data: {
        revokedAt: new Date(),
        biometricEnabled: false,
      },
    })
  }

  clearTrustedDeviceCookie(response)
  return response
}
