import { NextRequest, NextResponse } from "next/server"

import { getAuthenticatedUserWithSensitiveFields } from "@/lib/auth-route"
import { resolveTrustedDevice } from "@/lib/auth-device"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function serializeDevice(device: {
  id: string
  label: string
  browser: string | null
  platform: string | null
  biometricEnabled: boolean
  trustedAt: Date
  lastAccessAt: Date | null
}, currentDeviceId: string | null) {
  return {
    id: device.id,
    label: device.label,
    browser: device.browser,
    platform: device.platform,
    biometricEnabled: device.biometricEnabled,
    trustedAt: device.trustedAt.toISOString(),
    lastAccessAt: device.lastAccessAt?.toISOString() ?? null,
    isCurrent: device.id === currentDeviceId,
  }
}

export async function GET(request: NextRequest) {
  const { error, user } = await getAuthenticatedUserWithSensitiveFields()

  if (error || !user) {
    return error ?? NextResponse.json({ error: "Não autenticado." }, { status: 401 })
  }

  const currentDevice = await resolveTrustedDevice(request)
  const devices = await prisma.userTrustedDevice.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    orderBy: [
      { lastAccessAt: "desc" },
      { trustedAt: "desc" },
    ],
    select: {
      id: true,
      label: true,
      browser: true,
      platform: true,
      biometricEnabled: true,
      trustedAt: true,
      lastAccessAt: true,
    },
    take: 10,
  })

  const response = NextResponse.json({
    security: {
      trustedDeviceEnabled: Boolean(currentDevice && currentDevice.userId === user.id),
      pinConfigured: Boolean(user.pinHash),
      biometricEnabled: Boolean(
        currentDevice &&
          currentDevice.userId === user.id &&
          currentDevice.biometricEnabled &&
          currentDevice.passkeyCredentials.length > 0,
      ),
      lastAccessAt:
        currentDevice && currentDevice.userId === user.id
          ? currentDevice.lastAccessAt?.toISOString() ?? currentDevice.trustedAt.toISOString()
          : null,
      devices: devices.map((device) => serializeDevice(device, currentDevice?.userId === user.id ? currentDevice.id : null)),
    },
  })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}
