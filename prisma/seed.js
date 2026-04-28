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

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const demoUsers = {
  admin: {
    name: "Admin EME Demo",
    email: "admin@eme.com",
    password: "admin123",
  },
  legacyAdmin: {
    name: "Admin EME Legado",
    email: "admin@eme.app",
    password: "123456",
  },
  agency: {
    userName: "Gestor Imobiliaria EME",
    companyName: "Imobiliaria EME Demo",
    email: "imobiliaria@eme.com",
    password: "imob123",
    phone: "(11) 99999-1000",
    cnpj: "00.000.000/0001-00",
    catalogSlug: "imobiliaria-eme-demo",
  },
  broker: {
    name: "Corretor EME Demo",
    email: "corretor@eme.com",
    password: "corretor123",
    phone: "(11) 99999-2000",
    creci: "123456-F",
    catalogSlug: "corretor-eme-demo",
  },
}

async function upsertSubscription({ ownerType, ownerId }) {
  const existingSubscription = await prisma.subscription.findFirst({
    where: { ownerType, ownerId },
  })

  const data = {
    ownerType,
    ownerId,
    status: SubscriptionStatus.ACTIVE,
    nextBillingAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }

  if (existingSubscription) {
    return prisma.subscription.update({
      where: { id: existingSubscription.id },
      data,
    })
  }

  return prisma.subscription.create({ data })
}

async function main() {
  const adminPasswordHash = await hash(demoUsers.admin.password, 10)
  const legacyAdminPasswordHash = await hash(demoUsers.legacyAdmin.password, 10)
  const agencyPasswordHash = await hash(demoUsers.agency.password, 10)
  const brokerPasswordHash = await hash(demoUsers.broker.password, 10)

  const adminUser = await prisma.user.upsert({
    where: { email: demoUsers.admin.email },
    update: {
      name: demoUsers.admin.name,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      plan: BillingPlan.NONE,
      subscriptionStatus: BillingUserSubscriptionStatus.INACTIVE,
    },
    create: {
      name: demoUsers.admin.name,
      email: demoUsers.admin.email,
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      plan: BillingPlan.NONE,
      subscriptionStatus: BillingUserSubscriptionStatus.INACTIVE,
    },
  })

  const legacyAdminUser = await prisma.user.upsert({
    where: { email: demoUsers.legacyAdmin.email },
    update: {
      name: demoUsers.legacyAdmin.name,
      passwordHash: legacyAdminPasswordHash,
      role: UserRole.ADMIN,
      plan: BillingPlan.NONE,
      subscriptionStatus: BillingUserSubscriptionStatus.INACTIVE,
    },
    create: {
      name: demoUsers.legacyAdmin.name,
      email: demoUsers.legacyAdmin.email,
      passwordHash: legacyAdminPasswordHash,
      role: UserRole.ADMIN,
      plan: BillingPlan.NONE,
      subscriptionStatus: BillingUserSubscriptionStatus.INACTIVE,
    },
  })

  const agencyUser = await prisma.user.upsert({
    where: { email: demoUsers.agency.email },
    update: {
      name: demoUsers.agency.userName,
      passwordHash: agencyPasswordHash,
      role: UserRole.AGENCY,
      phone: demoUsers.agency.phone,
      plan: BillingPlan.AGENCY,
      subscriptionStatus: BillingUserSubscriptionStatus.ACTIVE,
    },
    create: {
      name: demoUsers.agency.userName,
      email: demoUsers.agency.email,
      passwordHash: agencyPasswordHash,
      role: UserRole.AGENCY,
      phone: demoUsers.agency.phone,
      plan: BillingPlan.AGENCY,
      subscriptionStatus: BillingUserSubscriptionStatus.ACTIVE,
    },
  })

  const agency = await prisma.agency.upsert({
    where: { ownerUserId: agencyUser.id },
    update: {
      name: demoUsers.agency.companyName,
      catalogSlug: demoUsers.agency.catalogSlug,
      phone: demoUsers.agency.phone,
      cnpj: demoUsers.agency.cnpj,
      description: "Conta demo da imobiliaria EME/M.",
    },
    create: {
      ownerUserId: agencyUser.id,
      name: demoUsers.agency.companyName,
      catalogSlug: demoUsers.agency.catalogSlug,
      phone: demoUsers.agency.phone,
      cnpj: demoUsers.agency.cnpj,
      description: "Conta demo da imobiliaria EME/M.",
    },
  })

  const brokerUser = await prisma.user.upsert({
    where: { email: demoUsers.broker.email },
    update: {
      name: demoUsers.broker.name,
      passwordHash: brokerPasswordHash,
      role: UserRole.BROKER,
      phone: demoUsers.broker.phone,
      plan: BillingPlan.BROKER,
      subscriptionStatus: BillingUserSubscriptionStatus.ACTIVE,
    },
    create: {
      name: demoUsers.broker.name,
      email: demoUsers.broker.email,
      passwordHash: brokerPasswordHash,
      role: UserRole.BROKER,
      phone: demoUsers.broker.phone,
      plan: BillingPlan.BROKER,
      subscriptionStatus: BillingUserSubscriptionStatus.ACTIVE,
    },
  })

  const broker = await prisma.broker.upsert({
    where: { userId: brokerUser.id },
    update: {
      agencyId: agency.id,
      phone: demoUsers.broker.phone,
      catalogSlug: demoUsers.broker.catalogSlug,
      creci: demoUsers.broker.creci,
      status: BrokerAccountStatus.ACTIVE,
      description: "Conta demo do corretor EME/M.",
    },
    create: {
      userId: brokerUser.id,
      agencyId: agency.id,
      phone: demoUsers.broker.phone,
      catalogSlug: demoUsers.broker.catalogSlug,
      creci: demoUsers.broker.creci,
      status: BrokerAccountStatus.ACTIVE,
      description: "Conta demo do corretor EME/M.",
    },
  })

  await prisma.catalog.upsert({
    where: { slug: demoUsers.agency.catalogSlug },
    update: {
      ownerType: CatalogOwnerType.AGENCY,
      ownerId: agency.id,
    },
    create: {
      slug: demoUsers.agency.catalogSlug,
      ownerType: CatalogOwnerType.AGENCY,
      ownerId: agency.id,
    },
  })

  await prisma.catalog.upsert({
    where: { slug: demoUsers.broker.catalogSlug },
    update: {
      ownerType: CatalogOwnerType.BROKER,
      ownerId: broker.id,
    },
    create: {
      slug: demoUsers.broker.catalogSlug,
      ownerType: CatalogOwnerType.BROKER,
      ownerId: broker.id,
    },
  })

  await upsertSubscription({
    ownerType: SubscriptionOwnerType.AGENCY,
    ownerId: agency.id,
  })

  await upsertSubscription({
    ownerType: SubscriptionOwnerType.BROKER,
    ownerId: broker.id,
  })

  console.log("Seed EME/M concluido com sucesso.")
  console.log("Usuarios demo:")
  console.log(`- ADMIN: ${adminUser.email}`)
  console.log(`- ADMIN_LEGACY: ${legacyAdminUser.email}`)
  console.log(`- AGENCY: ${agencyUser.email}`)
  console.log(`- BROKER: ${brokerUser.email}`)
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed EME/M:")
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
