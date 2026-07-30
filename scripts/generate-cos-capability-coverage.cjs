/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, console, require */

const fs = require("fs")
const path = require("path")
const ts = require("typescript")
const Module = require("module")

const repoRoot = path.resolve(__dirname, "..")
const originalResolveFilename = Module._resolveFilename

function resolveAliasTarget(request) {
  if (request === "server-only" || request === "client-only") {
    return path.join(__dirname, "runtime-module-stub.cjs")
  }

  if (!request.startsWith("@/")) return null

  const basePath = path.join(repoRoot, request.slice(2))
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? basePath
}

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  const aliasTarget = resolveAliasTarget(request)
  if (aliasTarget) {
    return originalResolveFilename.call(this, aliasTarget, parent, isMain, options)
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}

Module._extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowJs: true,
    },
    fileName: filename,
  })

  module._compile(output.outputText, filename)
}

const { buildCosCapabilityCoverageMarkdown, getCosCapabilityCoverageData } = require(path.join(repoRoot, "lib/cos/coverage-report.ts"))

const markdown = buildCosCapabilityCoverageMarkdown()
const targetPath = path.join(repoRoot, "docs", "cos-capability-coverage.md")
fs.mkdirSync(path.dirname(targetPath), { recursive: true })
fs.writeFileSync(targetPath, markdown, "utf8")

console.log(markdown)
console.log("")
console.log("Coverage JSON:")
console.log(JSON.stringify(getCosCapabilityCoverageData(), null, 2))
console.log("")
console.log(`Saved report to ${targetPath}`)

