/* global require, __dirname, URL, Buffer */
/* eslint-disable @typescript-eslint/no-require-imports -- Node.js CommonJS test for the standalone entrypoint. */
const assert = require("node:assert/strict")
const test = require("node:test")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const { parse } = require("dotenv")

const root = path.resolve(__dirname, "../..")
const code = fs.readFileSync(path.join(root, "scripts/captacao-local.cjs"), "utf8")
function run(command, database = "postgresql://local:local@127.0.0.1:55449/captacao_preview") {
  const calls = []
  const files = new Map([
    [path.resolve("test.env"), `DATABASE_URL=${database}\nDIRECT_URL=${database}\nAUTH_SECRET=local-test-secret`],
    [path.join(root, ".env.local"), "GECKO_API_KEY=server-key-fixture\nDATABASE_URL=production-fixture\nOPENAI_API_KEY=must-not-propagate\nCUSTOM_PROVIDER_TOKEN=must-not-propagate"],
  ])
  vm.runInNewContext(code, {
    __dirname: path.join(root, "scripts"),
    URL,
    console: { log() {} },
    process: { argv: ["node", "runner", command, "test.env"], env: { STRIPE_SECRET_KEY: "must-not-propagate", PATH: "system-path" }, execPath: "node" },
    require(name) {
      if (name === "node:fs") return { existsSync: (file) => files.has(file), readFileSync: (file) => Buffer.from(files.get(file)) }
      if (name === "node:path") return path
      if (name === "dotenv") return { parse }
      if (name === "node:child_process") return { spawnSync: (...args) => { calls.push(args); return { status: 0 } } }
      throw new Error(`Unexpected module ${name}`)
    },
  })
  return calls
}

test("local runner refuses remote databases before starting a command", () => {
  assert.throws(() => run("dev", "postgresql://test:test@database.example.invalid/captacao_preview"), /somente banco local/)
})
test("local runner refuses a non-test database name", () => {
  assert.throws(() => run("dev", "postgresql://test:test@127.0.0.1/production"), /somente banco local/)
})
test("dev uses test auth/database and only the requested Gecko credential", () => {
  const calls = run("dev")
  assert.equal(calls.length, 1)
  const env = calls[0][2].env
  assert.equal(env.AUTH_SECRET, "local-test-secret")
  assert.equal(env.GECKO_API_KEY, "server-key-fixture")
  assert.equal(env.OPENAI_API_KEY, "")
  assert.equal(env.STRIPE_SECRET_KEY, "")
  assert.equal(env.CUSTOM_PROVIDER_TOKEN, "")
  assert.equal(env.BROKER_PORTAL_V2, "false")
  assert.equal(env.EMAIL_ENABLED, "false")
  assert.equal(env.PATH, "system-path")
})
test("build disables real provider calls", () => {
  assert.equal(run("build")[0][2].env.GECKO_API_KEY, "")
})
test("unsupported commands cannot execute", () => {
  assert.throws(() => run("migrate"), /Comando permitido/)
})
