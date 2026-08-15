import fs from "node:fs/promises"
import syncFs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import Module from "node:module"

const { console, process } = globalThis
const root = process.cwd()
const knowledgeRoot = path.join(root, "knowledge", "eme")
const serverOnlyStubUrl = "data:text/javascript,export {}"
const originalResolveFilename = Module._resolveFilename

function resolveImportPath(basePath) {
  const isFile = syncFs.existsSync(basePath) && syncFs.statSync(basePath).isFile()
  const candidates = [
    ...(isFile ? [basePath] : []),
    `${basePath}.ts`, `${basePath}.tsx`, `${basePath}.js`,
    path.join(basePath, "index.ts"), path.join(basePath, "index.tsx"), path.join(basePath, "index.js"),
    ...(isFile ? [] : [basePath]),
  ]
  return candidates.find((candidate) => syncFs.existsSync(candidate)) ?? basePath
}

function resolveSpecifierUrl(specifier, parentURL) {
  if (specifier.startsWith("@/")) return pathToFileURL(resolveImportPath(path.join(root, specifier.slice(2)))).href
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = parentURL ? path.dirname(fileURLToPath(parentURL)) : root
    return pathToFileURL(resolveImportPath(path.resolve(parentPath, specifier))).href
  }
  return path.isAbsolute(specifier) ? pathToFileURL(resolveImportPath(specifier)).href : null
}

if (typeof Module.registerHooks === "function") {
  Module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") return { shortCircuit: true, url: serverOnlyStubUrl }
      const resolvedUrl = resolveSpecifierUrl(specifier, context.parentURL)
      return resolvedUrl ? nextResolve(resolvedUrl, context) : nextResolve(specifier, context)
    },
  })
}

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return serverOnlyStubUrl
  if (request.startsWith("@/")) request = resolveImportPath(path.join(root, request.slice(2)))
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

const requiredFiles = new Map([
  ["00-eme.md", "eme"], ["01-cos.md", "cos"], ["02-clientes.md", "clientes"],
  ["03-imoveis.md", "imoveis"], ["04-catalogo.md", "catalogo"], ["05-marketplace.md", "marketplace"],
  ["06-propostas.md", "propostas"], ["07-contratos.md", "contratos"], ["08-compromissos.md", "compromissos"],
  ["09-financeiro.md", "financeiro"], ["10-desempenho.md", "desempenho"], ["11-studio.md", "studio"],
  ["12-planos-conta.md", "planos-conta"], ["13-regras-negocio.md", "regras-negocio"],
  ["14-glossario.md", "glossario"], ["15-capacidades-cos.md", "capacidades-cos"],
])
const knownDomains = new Set(["lead", "property", "proposal", "contract", "agenda", "catalog", "marketplace", "finance", "analytics", "studio", "help", "general"])
const knownKnowledgeTypes = new Set(["module", "rule", "glossary", "procedure", "capability"])
const requiredModuleHeadings = [
  "O que é", "Para que serve", "Entidades relacionadas", "O que o usuário pode fazer", "O que o COS pode fazer",
  "Fluxos principais", "Regras de negócio", "Estados e status", "Relação com outros módulos", "Limitações atuais",
  "Termos oficiais", "Exemplos de perguntas", "Exemplos de pedidos operacionais",
]

function parseList(value) {
  if (!value?.startsWith("[") || !value.endsWith("]")) throw new Error(`Lista de frontmatter inválida: ${value}`)
  return value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean)
}

function parseDocument(fileName, source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) throw new Error(`${fileName}: frontmatter ausente ou inválido`)
  const metadata = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator < 1) throw new Error(`${fileName}: linha de frontmatter inválida: ${line}`)
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  for (const field of ["id", "title", "domains", "aliases", "version", "updated_at", "knowledge_type"]) {
    if (!metadata[field]) throw new Error(`${fileName}: campo obrigatório ausente: ${field}`)
  }
  const domains = parseList(metadata.domains)
  const aliases = parseList(metadata.aliases)
  const knowledgeTypes = parseList(metadata.knowledge_type)
  for (const domain of domains) if (!knownDomains.has(domain)) throw new Error(`${fileName}: domínio desconhecido: ${domain}`)
  for (const type of knowledgeTypes) if (!knownKnowledgeTypes.has(type)) throw new Error(`${fileName}: knowledge_type desconhecido: ${type}`)
  return { fileName, source, metadata, domains, aliases, knowledgeTypes }
}

function capabilityKind(descriptor) {
  if (descriptor.domain === "help" || descriptor.id === "general.chat") return "Orientação"
  if (descriptor.domain === "studio" || descriptor.responseMode === "nlg") return "Geração"
  return descriptor.mutatesData ? "Execução" : "Consulta"
}

function buildCapabilityTable(descriptors) {
  const lines = [
    "## Inventário gerado do Registry",
    "",
    `Total: **${descriptors.length} capabilities** com descriptor e handler validados.`,
    "",
    "| Capability | Action | Domínio | Tipo | Confirma | Seleção | Handler | Superfícies |",
    "|---|---|---|---|---|---|---|---|",
  ]
  for (const descriptor of [...descriptors].sort((a, b) => `${a.domain}:${a.id}`.localeCompare(`${b.domain}:${b.id}`))) {
    lines.push(`| \`${descriptor.id}\` | \`${descriptor.action}\` | ${descriptor.domain} | ${capabilityKind(descriptor)} | ${descriptor.requiresConfirmation ? "sim" : "não"} | ${descriptor.requiresSelection ? "sim" : "não"} | \`${descriptor.id}\` | ${descriptor.surfaces.join(", ")} |`)
  }
  return lines.join("\n")
}

async function main() {
  const { getCosCapabilityInventory } = await import(pathToFileURL(path.join(root, "lib", "cos", "inventory.ts")).href)
  const descriptors = getCosCapabilityInventory()
  const handlerSource = await fs.readFile(path.join(root, "lib", "cos", "capability-handlers.ts"), "utf8")
  const handlerIds = new Set([...handlerSource.matchAll(/^\s*"([^"]+)":\s*[A-Za-z]/gm)].map((match) => match[1]))
  const missingHandlers = descriptors.filter((descriptor) => !handlerIds.has(descriptor.id))
  const descriptorIds = new Set(descriptors.map((descriptor) => descriptor.id))
  const orphanHandlers = [...handlerIds].filter((id) => !descriptorIds.has(id))
  if (missingHandlers.length || orphanHandlers.length) {
    throw new Error(`Registry/handlers divergentes: missing=${missingHandlers.map((item) => item.id).join(",")}; orphan=${orphanHandlers.join(",")}`)
  }
  const capabilityPath = path.join(knowledgeRoot, "15-capacidades-cos.md")
  const startMarker = "<!-- GENERATED_CAPABILITIES_START -->"
  const endMarker = "<!-- GENERATED_CAPABILITIES_END -->"
  const generated = buildCapabilityTable(descriptors)

  if (process.argv.includes("--write")) {
    const current = await fs.readFile(capabilityPath, "utf8")
    const updated = current.replace(new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`), `${startMarker}\n${generated}\n${endMarker}`)
    await fs.writeFile(capabilityPath, updated, "utf8")
  }

  const files = (await fs.readdir(knowledgeRoot)).filter((file) => file.endsWith(".md")).sort()
  for (const file of requiredFiles.keys()) if (!files.includes(file)) throw new Error(`Capítulo obrigatório ausente: ${file}`)
  if (files.length !== requiredFiles.size) throw new Error(`Esperados ${requiredFiles.size} capítulos; encontrados ${files.length}`)

  const documents = await Promise.all(files.map(async (file) => parseDocument(file, await fs.readFile(path.join(knowledgeRoot, file), "utf8"))))
  const ids = new Set()
  const aliases = new Map()
  for (const document of documents) {
    const expectedId = requiredFiles.get(document.fileName)
    if (document.metadata.id !== expectedId) throw new Error(`${document.fileName}: id esperado ${expectedId}, recebido ${document.metadata.id}`)
    if (ids.has(document.metadata.id)) throw new Error(`ID duplicado: ${document.metadata.id}`)
    ids.add(document.metadata.id)
    for (const alias of document.aliases) {
      const key = alias.toLocaleLowerCase("pt-BR")
      if (aliases.has(key)) throw new Error(`Alias duplicado: ${alias} (${aliases.get(key)} e ${document.fileName})`)
      aliases.set(key, document.fileName)
    }
    if (document.knowledgeTypes.includes("module")) {
      for (const heading of requiredModuleHeadings) {
        if (!document.source.includes(`## ${heading}`)) throw new Error(`${document.fileName}: seção obrigatória ausente: ${heading}`)
      }
    }
    for (const link of document.source.matchAll(/\[[^\]]+\]\(([^)#]+\.md)(?:#[^)]+)?\)/g)) {
      const target = path.resolve(knowledgeRoot, path.dirname(document.fileName), link[1])
      if (!syncFs.existsSync(target)) throw new Error(`${document.fileName}: link interno quebrado: ${link[1]}`)
    }
  }

  const capabilitySource = await fs.readFile(capabilityPath, "utf8")
  const expectedSection = `${startMarker}\n${generated}\n${endMarker}`
  if (!capabilitySource.includes(expectedSection)) throw new Error("15-capacidades-cos.md está fora de sincronia; execute com --write")
  const documentedCapabilities = [...capabilitySource.matchAll(/^\| `([^`]+)` \| `/gm)].map((match) => match[1])
  if (documentedCapabilities.length !== descriptors.length || new Set(documentedCapabilities).size !== descriptors.length) {
    throw new Error(`Inventário inválido: ${documentedCapabilities.length}/${descriptors.length} capabilities documentadas`)
  }

  console.log(`Livro do EME válido: ${documents.length} capítulos, ${descriptors.length} capabilities e ${aliases.size} aliases únicos.`)
}

main().catch((error) => {
  console.error(`[cos-knowledge] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
