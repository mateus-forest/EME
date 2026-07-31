import type { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"
import { describeUserAgent, hashTrustedDeviceToken, readTrustedDeviceToken } from "@/lib/premium-auth"

export async function resolveTrustedDevice(request: NextRequest) {
  const token = readTrustedDeviceToken(request)
  if (!token) return null

  const tokenHash = hashTrustedDeviceToken(token)

  return prisma.userTrustedDevice.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          pinHash: true,
        },
      },
      passkeyCredentials: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  })
}

export function getCurrentDeviceMetadata(request: NextRequest) {
  return {
    userAgent: request.headers.get("user-agent") ?? null,
    ...describeUserAgent(request.headers.get("user-agent")),
  }
}
