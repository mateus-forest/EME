import { Prisma } from "@prisma/client"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.toLowerCase() : ""
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return ""

  const code = (error as { code?: unknown }).code
  return typeof code === "string" ? code.toUpperCase() : ""
}

export function isDatabaseUnavailableError(error: unknown) {
  const message = getErrorMessage(error)
  const code = getErrorCode(error)

  if (
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1000", "P1001", "P1002"].includes(error.code))
  ) {
    return true
  }

  return (
    message.includes("econnrefused") ||
    message.includes("can't reach database server") ||
    message.includes("cant reach database server") ||
    message.includes("connection refused") ||
    message.includes("connect timeout") ||
    message.includes("database") && message.includes("unavailable")
  )
}
