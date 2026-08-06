import fs from "node:fs/promises"
import syncFs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import Module from "node:module"

const { console, process } = globalThis
const root = process.cwd()
const originalResolveFilename = Module._resolveFilename
const serverOnlyStubUrl = "data:text/javascript,export {}"

function resolveImportPath(basePath) {
  const basePathIsFile = syncFs.existsSync(basePath) && syncFs.statSync(basePath).isFile()
  const candidates = [
    ...(basePathIsFile ? [basePath] : []),
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    ...(basePathIsFile ? [] : [basePath]),
  ]

  const resolvedPath = candidates.find((candidate) => syncFs.existsSync(candidate)) ?? basePath
  return resolvedPath
}

function resolveSpecifierUrl(specifier, parentURL) {
  if (specifier.startsWith("@/")) {
    return pathToFileURL(resolveImportPath(path.join(root, specifier.slice(2)))).href
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = parentURL ? path.dirname(fileURLToPath(parentURL)) : root
    return pathToFileURL(resolveImportPath(path.resolve(parentPath, specifier))).href
  }

  if (path.isAbsolute(specifier)) {
    return pathToFileURL(resolveImportPath(specifier)).href
  }

  return null
}

if (typeof Module.registerHooks === "function") {
  Module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") {
        return {
          shortCircuit: true,
          url: serverOnlyStubUrl,
        }
      }

      const resolvedUrl = resolveSpecifierUrl(specifier, context.parentURL)
      if (resolvedUrl) {
        return nextResolve(resolvedUrl, context)
      }

      return nextResolve(specifier, context)
    },
  })
}

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request === "server-only") {
    return serverOnlyStubUrl
  }

  if (request.startsWith("@/")) {
    request = resolveImportPath(path.join(root, request.slice(2)))
  }

  return originalResolveFilename.call(this, request, parent, isMain, options)
}

async function main() {
  const runnerModule = await import(pathToFileURL(path.join(root, "lib/cos/evals/runner.ts")).href)
  const report = await runnerModule.runDefaultCosEvalSuite()
  const markdown = runnerModule.buildCosEvalMarkdownReport(report)

  const reportsDir = path.join(root, "reports", "cos-evals")
  await fs.mkdir(reportsDir, { recursive: true })
  await fs.writeFile(path.join(reportsDir, "latest.json"), JSON.stringify(report, null, 2), "utf8")
  await fs.writeFile(path.join(reportsDir, "latest.md"), markdown, "utf8")

  console.log(markdown)

  if (process.env.COS_EVALS_STRICT === "true" && report.totals.failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("[cos-evals] failed", error)
  process.exitCode = 1
})
