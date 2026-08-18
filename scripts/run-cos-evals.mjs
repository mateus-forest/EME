import fs from "node:fs/promises"
import syncFs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import Module from "node:module"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"

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

function listFilesRecursive(directory) {
  if (!syncFs.existsSync(directory)) return []
  return syncFs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFilesRecursive(entryPath) : [entryPath]
  })
}

function hashFiles(files) {
  const hash = createHash("sha256")
  for (const file of [...files].sort()) {
    hash.update(path.relative(root, file).replaceAll("\\", "/"))
    hash.update("\0")
    hash.update(syncFs.readFileSync(file))
    hash.update("\0")
  }
  return hash.digest("hex")
}

function gitOutput(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return null
  }
}

function readGitHead() {
  const headPath = path.join(root, ".git", "HEAD")
  if (!syncFs.existsSync(headPath)) return null
  const head = syncFs.readFileSync(headPath, "utf8").trim()
  if (!head.startsWith("ref: ")) return head || null
  const ref = head.slice(5)
  const refPath = path.join(root, ".git", ...ref.split("/"))
  if (syncFs.existsSync(refPath)) return syncFs.readFileSync(refPath, "utf8").trim() || null
  const packedRefsPath = path.join(root, ".git", "packed-refs")
  if (!syncFs.existsSync(packedRefsPath)) return null
  const packedRef = syncFs.readFileSync(packedRefsPath, "utf8")
    .split(/\r?\n/)
    .find((line) => line.endsWith(` ${ref}`))
  return packedRef?.split(" ")[0] ?? null
}

function readJsonFile(file) {
  try {
    return JSON.parse(syncFs.readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

function summarizeBaseline(report) {
  if (!report?.goldenV1) return null
  return {
    baselineId: report.provenance?.baselineId ?? null,
    generatedAt: report.generatedAt ?? null,
    dataset: report.dataset ?? null,
    statusBreakdown: report.goldenV1.statusBreakdown,
    layerMetrics: report.goldenV1.layerMetrics,
    failedLayerCounts: report.goldenV1.failedLayerCounts,
  }
}

function previousImmutableBaseline(baselinesDir, currentBaselineId) {
  if (!syncFs.existsSync(baselinesDir)) return null
  return syncFs.readdirSync(baselinesDir)
    .filter((file) => file.endsWith(".json") && file !== `${currentBaselineId}.json`)
    .map((file) => readJsonFile(path.join(baselinesDir, file)))
    .filter(Boolean)
    .sort((left, right) => String(right.generatedAt ?? "").localeCompare(String(left.generatedAt ?? "")))[0] ?? null
}

function buildComparisonMarkdown(comparison) {
  if (!comparison?.before || !comparison.after) return []
  const before = comparison.before
  const after = comparison.after
  const layers = [...new Set([
    ...Object.keys(before.layerMetrics ?? {}),
    ...Object.keys(after.layerMetrics ?? {}),
  ])]
  const value = (metric, key) => metric?.[key] === null || metric?.[key] === undefined ? "N/A" : `${metric[key]}%`
  return [
    "## Comparação antes/depois da auditoria do oracle",
    "",
    `- Baseline anterior: \`${before.baselineId ?? "indisponível"}\`.`,
    `- Baseline atual: \`${after.baselineId}\`.`,
    `- Status anterior: pass=${before.statusBreakdown.pass}, fail=${before.statusBreakdown.fail}, incomplete=${before.statusBreakdown.incomplete}.`,
    `- Status atual: pass=${after.statusBreakdown.pass}, fail=${after.statusBreakdown.fail}, incomplete=${after.statusBreakdown.incomplete}.`,
    "",
    "| Camada | Acurácia antes | Acurácia depois | Cobertura antes | Cobertura depois |",
    "|---|---:|---:|---:|---:|",
    ...layers.map((layer) => {
      const previousMetric = before.layerMetrics?.[layer]
      const currentMetric = after.layerMetrics?.[layer]
      return `| ${layer} | ${value(previousMetric, "accuracy")} | ${value(currentMetric, "accuracy")} | ${value(previousMetric, "coverage")} | ${value(currentMetric, "coverage")} |`
    }),
    "",
    "A comparação mede a mudança do gabarito e do evaluator, não uma melhoria do runtime do COS.",
    "",
  ]
}

async function main() {
  const runnerModule = await import(pathToFileURL(path.join(root, "lib/cos/evals/conversational-runner.ts")).href)
  const report = await runnerModule.runCosSystemEvalSuite()
  const datasetFile = path.join(root, "lib/cos/evals/conversations/golden-v1.ts")
  const oracleFiles = [
    datasetFile,
    path.join(root, "lib/cos/evals/golden-types.ts"),
    path.join(root, "lib/cos/evals/conversational-runner.ts"),
  ]
  const datasetHash = hashFiles([datasetFile])
  const oracleHash = hashFiles(oracleFiles)
  const registryHash = hashFiles(listFilesRecursive(path.join(root, "lib/cos/entities")).filter((file) => file.endsWith(".ts")))
  const knowledgeHash = hashFiles(listFilesRecursive(path.join(root, "knowledge/eme")).filter((file) => file.endsWith(".md")))
  const oracleLockPath = path.join(root, "lib/cos/evals/conversations/golden-v1.lock.json")
  const oracleLock = readJsonFile(oracleLockPath)
  if (!oracleLock || oracleLock.status !== "frozen") {
    throw new Error("Golden V1 sem lock congelado em lib/cos/evals/conversations/golden-v1.lock.json")
  }
  if (oracleLock.datasetSha256 !== datasetHash || oracleLock.oracleSha256 !== oracleHash) {
    throw new Error("Golden V1 divergiu do lock congelado; uma nova auditoria explícita é obrigatória para alterar o oracle")
  }
  if (oracleLock.baseScenarios !== report.dataset.baseScenarios || oracleLock.executableCases !== report.dataset.executableCases) {
    throw new Error("Golden V1 divergiu das contagens congeladas no lock")
  }
  const gitStatus = gitOutput(["status", "--porcelain"])
  const provenance = {
    baselineId: `cos-golden-v1-${oracleHash.slice(0, 12)}`,
    datasetSha256: datasetHash,
    oracleSha256: oracleHash,
    oracleLock: path.relative(root, oracleLockPath).replaceAll("\\", "/"),
    capabilityRegistrySha256: registryHash,
    knowledgeSha256: knowledgeHash,
    gitSha: readGitHead(),
    workingTreeDirty: gitStatus === null ? null : gitStatus.length > 0,
    node: process.version,
    database: false,
    externalProviders: false,
    mode: "deterministic-no-db-no-provider",
  }
  const reportsDir = path.join(root, "reports", "cos-evals")
  const baselinesDir = path.join(reportsDir, "baselines")
  const previousBaseline = previousImmutableBaseline(baselinesDir, provenance.baselineId)
  const baselineComparison = {
    before: summarizeBaseline(previousBaseline),
    after: {
      ...summarizeBaseline({ ...report, provenance }),
      baselineId: provenance.baselineId,
    },
  }
  const persistedReport = { ...report, provenance, baselineComparison }
  const markdown = [
    runnerModule.buildCosSystemEvalMarkdownReport(report).trimEnd(),
    "",
    ...buildComparisonMarkdown(baselineComparison),
    "## Proveniência",
    "",
    `- Baseline: \`${provenance.baselineId}\`.`,
    `- Dataset SHA-256: \`${provenance.datasetSha256}\`.`,
    `- Oracle SHA-256: \`${provenance.oracleSha256}\`; lock: \`${provenance.oracleLock}\`.`,
    `- Registry SHA-256: \`${provenance.capabilityRegistrySha256}\`.`,
    `- Knowledge SHA-256: \`${provenance.knowledgeSha256}\`.`,
    `- Git SHA: \`${provenance.gitSha ?? "indisponível"}\`; working tree dirty: \`${provenance.workingTreeDirty ?? "indisponível"}\`.`,
    `- Node: \`${provenance.node}\`; database: \`false\`; providers externos: \`false\`.`,
    "",
  ].join("\n")

  await fs.mkdir(reportsDir, { recursive: true })
  await fs.mkdir(baselinesDir, { recursive: true })
  await fs.writeFile(path.join(reportsDir, "latest.json"), JSON.stringify(persistedReport, null, 2), "utf8")
  await fs.writeFile(path.join(reportsDir, "latest.md"), markdown, "utf8")
  await fs.writeFile(path.join(root, "docs/cos/COS_EVAL_REPORT.md"), markdown, "utf8")
  const immutableBaselinePath = path.join(baselinesDir, `${provenance.baselineId}.json`)
  try {
    await fs.writeFile(immutableBaselinePath, JSON.stringify(persistedReport, null, 2), { encoding: "utf8", flag: "wx" })
  } catch (error) {
    if (!error || typeof error !== "object" || error.code !== "EEXIST") throw error
  }

  console.log(markdown)

  if (process.env.COS_EVALS_STRICT === "true" && report.failures.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error("[cos-evals] failed", error)
  process.exitCode = 1
})
