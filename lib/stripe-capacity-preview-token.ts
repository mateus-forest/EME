import { createHmac, timingSafeEqual } from "node:crypto"

export type CapacityChangeTokenPayload = {
  brokerId: string
  expiresAt: number
  operation: "set" | "remove"
  packageKey: string | null
  prorationDate: number
  subscriptionId: string
  targetPriceId: string | null
  version: 1
}

const TOKEN_TTL_SECONDS = 10 * 60

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url")
}

export function createCapacityChangeToken(
  payload: Omit<CapacityChangeTokenPayload, "expiresAt" | "version">,
  secret: string,
) {
  const tokenPayload: CapacityChangeTokenPayload = {
    ...payload,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    version: 1,
  }
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload), "utf8").toString("base64url")

  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`
}

function isCapacityChangeTokenPayload(value: unknown): value is CapacityChangeTokenPayload {
  if (!value || typeof value !== "object") return false
  const payload = value as Record<string, unknown>

  return (
    payload.version === 1 &&
    typeof payload.brokerId === "string" &&
    typeof payload.subscriptionId === "string" &&
    (payload.operation === "set" || payload.operation === "remove") &&
    (typeof payload.packageKey === "string" || payload.packageKey === null) &&
    (typeof payload.targetPriceId === "string" || payload.targetPriceId === null) &&
    typeof payload.prorationDate === "number" &&
    Number.isInteger(payload.prorationDate) &&
    typeof payload.expiresAt === "number" &&
    Number.isInteger(payload.expiresAt)
  )
}

export function verifyCapacityChangeToken(token: string, secret: string) {
  const [encodedPayload, encodedSignature, extraPart] = token.split(".")
  if (!encodedPayload || !encodedSignature || extraPart) return null

  const expectedSignature = Buffer.from(signPayload(encodedPayload, secret), "utf8")
  const receivedSignature = Buffer.from(encodedSignature, "utf8")
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
    if (!isCapacityChangeTokenPayload(parsed)) return null
    if (parsed.expiresAt < Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}
