const { mkdir, rm } = require("node:fs/promises")
const path = require("node:path")
const { hash } = require("bcryptjs")
const { Pool } = require("pg")
const { PrismaPg } = require("@prisma/adapter-pg")
const {
  PrismaClient,
  UserRole,
  CatalogOwnerType,
  SubscriptionOwnerType,
  SubscriptionStatus,
  BillingPlan,
  BillingUserSubscriptionStatus,
  BrokerAccountStatus,
} = require("@prisma/client")

require("dotenv/config")

const REQUIRED_CONFIRMATION = "RESET_EME_DEV_DB"
const ADMIN_EMAILS = ["admin@eme.com", "admin@eme.app"]
const DEV_USERS = {
  independentBroker: {
    name: "Corretor Independente Dev",
    email: "dev.corretor@eme.test",
    password: "corretor123",
    phone: "(11) 90000-1000",
    creci: "DEV-1000-F",
    catalogSlug: "dev-corretor-independente",
  },
  agency: {
    ownerName: "Gestor Imobiliaria Dev",
    companyName: "Imobiliaria Dev EME",
    email: "dev.imobiliaria@eme.test",
    password: "imob123",
    phone: "(11) 90000-2000",
    cnpj: "00.000.000/0001-99",
    catalogSlug: "dev-imobiliaria-eme",
  },
  linkedBroker: {
    name: "Corretor Vinculado Dev",
    email: "dev.vinculado@eme.test",
    password: "vinculado123",
    phone: "(11) 90000-3000",
    creci: "DEV-3000-F",
    catalogSlug: "dev-corretor-vinculado",
  },
}

function maskDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(databaseUrl)
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`
  } catch {
    return "DATABASE_URL invalida"
  }
}

function getDatabaseHost(databaseUrl) {
  try {
    return new URL(databaseUrl).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function isLocalOrPrivateHost(host) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  )
}

function assertSafeExecution(databaseUrl) {
  const host = getDatabaseHost(databaseUrl)
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
  const allowsRemoteDev = process.env.EME_ALLOW_REMOTE_DB_RESET === "true"
  const confirmed = process.env.RESET_DEV_DB_CONFIRM === REQUIRED_CONFIRMATION

  console.log("[reset-dev-db] Banco detectado:", maskDatabaseUrl(databaseUrl))
  console.log("[reset-dev-db] Host:", host || "desconhecido")
  console.log("[reset-dev-db] NODE_ENV:", process.env.NODE_ENV || "nao definido")
  console.log("[reset-dev-db] VERCEL_ENV:", process.env.VERCEL_ENV || "nao definido")

  if (isVercel || isProduction) {
    throw new Error("Execucao bloqueada: este script nao roda em producao ou ambiente Vercel.")
  }

  if (!isLocalOrPrivateHost(host) && !allowsRemoteDev) {
    throw new Error(
      "Execucao bloqueada: banco remoto detectado. Defina EME_ALLOW_REMOTE_DB_RESET=true apenas para Supabase de desenvolvimento/teste.",
    )
  }

  if (!confirmed) {
    throw new Error(`Confirmacao ausente. Execute com RESET_DEV_DB_CONFIRM=${REQUIRED_CONFIRMATION}.`)
  }
}

async function upsertSubscription(prisma, ownerType, ownerId) {
  return prisma.subscription.upsert({
    where: {
      ownerType_ownerId: {
        ownerType,
        ownerId,
      },
    },
    update: {
      status: SubscriptionStatus.ACTIVE,
      nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      ownerType,
      ownerId,
      status: SubscriptionStatus.ACTIVE,
      nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}

async function clearUploadedPropertyFiles() {
  if (process.env.RESET_DEV_DB_DELETE_UPLOADS !== "true") return false

  const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "properties")
  const allowedRoot = path.resolve(process.cwd(), "public", "uploads")

  if (!uploadsDir.startsWith(allowedRoot + path.sep)) {
    throw new Error("Caminho de uploads invalido. Limpeza de arquivos bloqueada.")
  }

  await rm(uploadsDir, { recursive: true, force: true })
  await mkdir(uploadsDir, { recursive: true })
  return true
}

async function recreateDevData(prisma) {
  const independentPasswordHash = await hash(DEV_USERS.independentBroker.password, 10)
  const agencyPasswordHash = await hash(DEV_USERS.agency.password, 10)
  const linkedPasswordHash = await hash(DEV_USERS.linkedBroker.password, 10)

  const independentUser = await prisma.user.create({
    data: {
      name: DEV_USERS.independentBroker.name,
      email: DEV_USERS.independentBroker.email,
      passwordHash: independentPasswordHash,
      role: UserRole.BROKER,
      phone: DEV_USERS.independentBroker.phone,
      plan: BillingPlan.BROKER,
      subscriptionStatus: BillingUserSubscriptionStatus.ACTIVE,
      broker: {
        create: {
          agencyId: null,
          phone: DEV_USERS.independentBroker.phone,
          catalogSlug: DEV_USERS.independentBroker.catalogSlug,
          creci: DEV_USERS.independentBroker.creci,
          status: BrokerAccountStatus.ACTIVE,
          description: "Conta dev para testar corretor independente.",
        },
      },
    },
    include: { broker: true },
  })

  const agencyUser = await prisma.user.create({
    data: {
      name: DEV_USERS.agency.ownerName,
      email: DEV_USERS.agency.email,
      passwordHash: agencyPasswordHash,
      role: UserRole.AGENCY,
      phone: DEV_USERS.agency.phone,
      plan: BillingPlan.AGENCY,
      subscriptionStatus: BillingUserSubscriptionStatus.ACTIVE,
      ownedAgency: {
        create: {
          name: DEV_USERS.agency.companyName,
          catalogSlug: DEV_USERS.agency.catalogSlug,
          phone: DEV_USERS.agency.phone,
          cnpj: DEV_USERS.agency.cnpj,
          description: "Conta dev para testar imobiliaria e equipe.",
        },
      },
    },
    include: { ownedAgency: true },
  })

  const linkedUser = await prisma.user.create({
    data: {
      name: DEV_USERS.linkedBroker.name,
      email: DEV_USERS.linkedBroker.email,
      passwordHash: linkedPasswordHash,
      role: UserRole.BROKER,
      phone: DEV_USERS.linkedBroker.phone,
      plan: BillingPlan.NONE,
      subscriptionStatus: BillingUserSubscriptionStatus.INACTIVE,
      broker: {
        create: {
          agencyId: agencyUser.ownedAgency.id,
          phone: DEV_USERS.linkedBroker.phone,
          catalogSlug: DEV_USERS.linkedBroker.catalogSlug,
          creci: DEV_USERS.linkedBroker.creci,
          status: BrokerAccountStatus.ACTIVE,
          description: "Conta dev para testar corretor vinculado.",
        },
      },
    },
    include: { broker: true },
  })

  await prisma.catalog.createMany({
    data: [
      {
        slug: DEV_USERS.independentBroker.catalogSlug,
        ownerType: CatalogOwnerType.BROKER,
        ownerId: independentUser.broker.id,
      },
      {
        slug: DEV_USERS.agency.catalogSlug,
        ownerType: CatalogOwnerType.AGENCY,
        ownerId: agencyUser.ownedAgency.id,
      },
      {
        slug: DEV_USERS.linkedBroker.catalogSlug,
        ownerType: CatalogOwnerType.BROKER,
        ownerId: linkedUser.broker.id,
      },
    ],
  })

  await upsertSubscription(prisma, SubscriptionOwnerType.BROKER, independentUser.broker.id)
  await upsertSubscription(prisma, SubscriptionOwnerType.AGENCY, agencyUser.ownedAgency.id)

  return {
    independentBroker: independentUser.email,
    agency: agencyUser.email,
    linkedBroker: linkedUser.email,
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL nao configurada.")

  assertSafeExecution(databaseUrl)

  const pool = new Pool({ connectionString: databaseUrl })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    console.log("[reset-dev-db] Iniciando limpeza de dados operacionais...")

    await prisma.$transaction(async (tx) => {
      await tx.lead.deleteMany()
      await tx.notification.deleteMany()
      await tx.property.deleteMany()
      await tx.catalog.deleteMany()
      await tx.subscription.deleteMany()
      await tx.broker.deleteMany()
      await tx.agency.deleteMany()
      await tx.user.deleteMany({
        where: {
          role: { not: UserRole.ADMIN },
        },
      })
    })

    const uploadsCleared = await clearUploadedPropertyFiles()
    const devAccounts = await recreateDevData(prisma)

    const preservedAdmins = await prisma.user.findMany({
      where: {
        OR: [{ role: UserRole.ADMIN }, { email: { in: ADMIN_EMAILS } }],
      },
      select: { email: true },
      orderBy: { email: "asc" },
    })

    console.log("[reset-dev-db] Limpeza concluida.")
    console.log("[reset-dev-db] Uploads de imoveis limpos:", uploadsCleared ? "sim" : "nao")
    console.log("[reset-dev-db] Admins preservados:", preservedAdmins.map((admin) => admin.email).join(", ") || "nenhum")
    console.log("[reset-dev-db] Contas dev recriadas:")
    console.log(`- Corretor independente: ${devAccounts.independentBroker} / ${DEV_USERS.independentBroker.password}`)
    console.log(`- Imobiliaria: ${devAccounts.agency} / ${DEV_USERS.agency.password}`)
    console.log(`- Corretor vinculado: ${devAccounts.linkedBroker} / ${DEV_USERS.linkedBroker.password}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error("[reset-dev-db] ERRO:", error instanceof Error ? error.message || error.name : error)
  if (error && typeof error === "object") {
    const details = {
      name: error.name,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    }
    console.error("[reset-dev-db] Detalhes:", details)
  }
  process.exitCode = 1
})
