import { listCosCapabilityCatalog } from "@/lib/cos/capability-catalog"

export function getCosCapabilityInventory() {
  return listCosCapabilityCatalog().map((capability) => ({
    id: capability.id,
    action: capability.action,
    title: capability.title,
    description: capability.description,
    domain: capability.domain,
    entity: capability.entity,
    aliases: capability.aliases,
    surfaces: capability.surfaces,
    source: capability.source,
    responseMode: capability.responseMode,
    mutatesData: capability.mutatesData,
    requiresConfirmation: capability.requiresConfirmation,
    requiresSelection: capability.requiresSelection,
  }))
}

export function buildCosCapabilityInventoryMarkdown() {
  const capabilities = getCosCapabilityInventory()
  const header = [
    "# COS Capability Inventory",
    "",
    "Generated automatically from the Capability Registry.",
    "",
  ]

  const sections = capabilities.map((capability) =>
    [
      `## ${capability.title}`,
      `- id: \`${capability.id}\``,
      `- action: \`${capability.action}\``,
      `- domain: \`${capability.domain}\``,
      `- entity: \`${capability.entity}\``,
      `- source: \`${capability.source}\``,
      `- response mode: \`${capability.responseMode}\``,
      `- mutates data: ${capability.mutatesData ? "yes" : "no"}`,
      `- requires confirmation: ${capability.requiresConfirmation ? "yes" : "no"}`,
      `- requires selection: ${capability.requiresSelection ? "yes" : "no"}`,
      `- surfaces: ${capability.surfaces.join(", ")}`,
      `- aliases: ${capability.aliases.length ? capability.aliases.join(", ") : "-"}`,
      "",
      capability.description,
      "",
    ].join("\n"),
  )

  return [...header, ...sections].join("\n")
}
