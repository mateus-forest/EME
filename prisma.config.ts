import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

loadEnv({ path: ".env.local", override: false })
loadEnv({ path: ".env", override: false })

function resolveDatasourceUrl() {
  const directUrl = process.env["DIRECT_URL"]?.trim()
  const databaseUrl = process.env["DATABASE_URL"]?.trim()

  // Local clones sometimes keep a placeholder DIRECT_URL just for production deploys.
  const hasUsableDirectUrl =
    !!directUrl &&
    !directUrl.includes("DIRECT_HOST") &&
    !directUrl.includes("USER:PASSWORD")

  return hasUsableDirectUrl ? directUrl : databaseUrl
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "C:\\Windows\\System32\\cmd.exe /c prisma\\seed.cmd",
  },
  datasource: {
    url: resolveDatasourceUrl(),
  },
})
