/* global require, __dirname, process, URL, console */
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS entrypoint. */
// Starts the real portal against an explicitly selected local test database.
// Only the Gecko key is read from the project's private .env.local.
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { parse } = require("dotenv")

const root = path.resolve(__dirname, "..")
const command = process.argv[2]
const configPath = process.argv[3] || process.env.CAPTACAO_LOCAL_ENV
if (!configPath) throw new Error("Informe o arquivo de ambiente local de teste.")
const local = parse(fs.readFileSync(path.resolve(configPath)))
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  if (!local[name]) throw new Error(`O ambiente de teste exige ${name}.`)
  const url = new URL(local[name])
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !/(preview|test|local)/i.test(url.pathname)
  ) throw new Error("Este iniciador aceita somente banco local de teste.")
}

const environment = { ...process.env }
let geckoKey = ""
for (const file of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production", ".env.production.local"]) {
  const filename = path.join(root, file)
  if (!fs.existsSync(filename)) continue
  const values = parse(fs.readFileSync(filename))
  if (file === ".env.local") geckoKey = values.GECKO_API_KEY || ""
  // Defined empty values prevent Next from restoring production secrets later.
  for (const name of Object.keys(values)) environment[name] = ""
}
for (const name of Object.keys(environment)) {
  if (/^(DATABASE|DIRECT_URL|AUTH_SECRET|NEXTAUTH|STRIPE|SUPABASE|OPENAI|GECKO|VERCEL|NEXT_PUBLIC|JOURNEY|BROKER_PORTAL|BILLING|IMOBISEC|WHATSAPP|RESEND|EMAIL_|PEXELS|LUMAAI|PEDRA|XAI)/.test(name)) environment[name] = ""
}
Object.assign(environment, local, {
  NODE_ENV: command === "build" ? "production" : "development",
  BROKER_PORTAL_V2: "false",
  STRIPE_ENABLED: "false",
  OPENAI_ENABLED: "false",
  SUPABASE_STORAGE_ENABLED: "false",
  WHATSAPP_ENABLED: "false",
  EMAIL_ENABLED: "false",
  NOTIFICATIONS_EMAIL_ENABLED: "false",
  JOURNEY_ANALYTICS_ENABLED: "false",
  GECKO_API_KEY: command === "dev" ? geckoKey : "",
  NEXT_TELEMETRY_DISABLED: "1",
})
const commands = {
  dev: ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3116"],
  build: ["node_modules/next/dist/bin/next", "build"],
  generate: ["node_modules/prisma/build/index.js", "generate"],
  types: ["node_modules/typescript/bin/tsc", "--noEmit"],
}
if (!commands[command]) throw new Error("Comando permitido: dev, build, generate ou types.")
console.log(`Captação local: ${command}; banco de teste; Gecko ${command === "dev" && geckoKey ? "configurada" : "desativada"}.`)
const result = spawnSync(process.execPath, commands[command], {
  cwd: root,
  env: environment,
  stdio: "inherit",
  windowsHide: true,
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
