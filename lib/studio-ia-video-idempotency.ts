import "server-only"

import { createHash } from "node:crypto"

import { prisma } from "@/lib/prisma"

export const STUDIO_VIDEO_GENERATION_LOCK_TYPE = "studio_ia_video_lock"

const LOCK_TTL_MS = 2 * 60 * 60 * 1000

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002")
}

export function getStudioVideoGenerationLockId(brokerId: string, requestSignature: string) {
  const digest = createHash("sha256")
    .update(`${brokerId}:${requestSignature}`)
    .digest("hex")
    .slice(0, 32)

  return `video_lock_${digest}`
}

export async function acquireStudioVideoGenerationLock(input: {
  brokerId: string
  requestSignature: string
}) {
  const lockId = getStudioVideoGenerationLockId(input.brokerId, input.requestSignature)
  const createLock = () => prisma.brokerDocument.create({
    data: {
      id: lockId,
      brokerId: input.brokerId,
      type: STUDIO_VIDEO_GENERATION_LOCK_TYPE,
      title: "Bloqueio interno de geracao de video",
      content: JSON.stringify({
        requestSignature: input.requestSignature,
        acquiredAt: new Date().toISOString(),
      }),
      status: "draft",
    },
    select: { id: true },
  })

  try {
    await createLock()
    return { acquired: true as const, lockId }
  } catch (caughtError) {
    if (!isUniqueConstraintError(caughtError)) throw caughtError
  }

  const staleBefore = new Date(Date.now() - LOCK_TTL_MS)
  const deleted = await prisma.brokerDocument.deleteMany({
    where: {
      id: lockId,
      brokerId: input.brokerId,
      type: STUDIO_VIDEO_GENERATION_LOCK_TYPE,
      updatedAt: { lte: staleBefore },
    },
  })

  if (deleted.count === 1) {
    try {
      await createLock()
      return { acquired: true as const, lockId }
    } catch (caughtError) {
      if (!isUniqueConstraintError(caughtError)) throw caughtError
    }
  }

  return { acquired: false as const, lockId }
}

export async function releaseStudioVideoGenerationLock(input: {
  brokerId: string
  lockId: string
}) {
  await prisma.brokerDocument.deleteMany({
    where: {
      id: input.lockId,
      brokerId: input.brokerId,
      type: STUDIO_VIDEO_GENERATION_LOCK_TYPE,
    },
  })
}

export async function linkStudioVideoGenerationLock(input: {
  brokerId: string
  lockId: string
  requestId: string
  requestSignature: string
}) {
  const linked = await prisma.brokerDocument.updateMany({
    where: {
      id: input.lockId,
      brokerId: input.brokerId,
      type: STUDIO_VIDEO_GENERATION_LOCK_TYPE,
    },
    data: {
      content: JSON.stringify({
        requestSignature: input.requestSignature,
        requestId: input.requestId,
        linkedAt: new Date().toISOString(),
      }),
    },
  })

  return linked.count === 1
}

export async function getStudioVideoGenerationLockRequestId(input: {
  brokerId: string
  lockId: string
}) {
  const lock = await prisma.brokerDocument.findFirst({
    where: {
      id: input.lockId,
      brokerId: input.brokerId,
      type: STUDIO_VIDEO_GENERATION_LOCK_TYPE,
    },
    select: { content: true },
  })
  if (!lock) return null

  try {
    const parsed = JSON.parse(lock.content) as { requestId?: unknown }
    return typeof parsed.requestId === "string" && parsed.requestId ? parsed.requestId : null
  } catch {
    return null
  }
}
