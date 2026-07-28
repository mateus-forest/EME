import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"

export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  pool?: Pool
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (!databaseUrl) {
    throw new Error("DATABASE_URL precisa estar configurada para inicializar o Prisma.")
  }

  return databaseUrl
}

function getPoolMax() {
  const configured = Number(process.env.DATABASE_POOL_MAX)
  const isServerlessProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production"

  if (isServerlessProduction) {
    return 1
  }

  if (Number.isInteger(configured) && configured > 0) return configured

  return 5
}

function getPoolTimeout() {
  const configured = Number(process.env.DATABASE_POOL_TIMEOUT_MS)
  if (Number.isInteger(configured) && configured > 0) return configured
  return 5_000
}

function getPool() {
  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: getPoolMax(),
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: getPoolTimeout(),
      allowExitOnIdle: true,
    })
  }

  return globalForPrisma.pool
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg(getPool()),
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  }

  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop)
    return typeof value === "function" ? value.bind(client) : value
  },
}) as PrismaClient
