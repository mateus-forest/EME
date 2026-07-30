import "server-only"

import { capabilityHandlers } from "@/lib/cos/capability-handlers"
import { listCosCapabilityCatalog } from "@/lib/cos/capability-catalog"

import type { CosCapabilityDescriptor, CosCapabilityDomain, CosCapabilityId } from "@/lib/cos/types"

type CoverageBucket = {
  domain: CosCapabilityDomain
  total: number
  executable: number
  pending: number
  capabilities: CosCapabilityDescriptor[]
}

function isExecutable(capability: CosCapabilityDescriptor) {
  return capability.source === "legacy" || Boolean(capabilityHandlers[capability.id])
}

function percent(part: number, total: number) {
  return total === 0 ? 100 : Math.round((part / total) * 100)
}

export function getCosCapabilityCoverageData() {
  const capabilities = listCosCapabilityCatalog()
  const buckets = capabilities.reduce<Map<CosCapabilityDomain, CoverageBucket>>((acc, capability) => {
    const current = acc.get(capability.domain) ?? {
      domain: capability.domain,
      total: 0,
      executable: 0,
      pending: 0,
      capabilities: [],
    }

    current.total += 1
    current.executable += isExecutable(capability) ? 1 : 0
    current.pending += isExecutable(capability) ? 0 : 1
    current.capabilities.push(capability)
    acc.set(capability.domain, current)
    return acc
  }, new Map())

  const handlerIds = new Set(Object.keys(capabilityHandlers) as CosCapabilityId[])
  const capabilityIds = new Set(capabilities.map((capability) => capability.id))

  const orphanHandlers = Array.from(handlerIds).filter((capabilityId) => !capabilityIds.has(capabilityId))
  const capabilitiesWithoutAliases = capabilities.filter((capability) => capability.aliases.length === 0).map((capability) => capability.id)
  const pendingCapabilities = capabilities.filter((capability) => !isExecutable(capability)).map((capability) => capability.id)

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      capabilities: capabilities.length,
      executable: capabilities.filter((capability) => isExecutable(capability)).length,
      pending: pendingCapabilities.length,
    },
    domains: Array.from(buckets.values())
      .sort((left, right) => left.domain.localeCompare(right.domain))
      .map((bucket) => ({
        domain: bucket.domain,
        total: bucket.total,
        executable: bucket.executable,
        pending: bucket.pending,
        coverage: percent(bucket.executable, bucket.total),
        capabilities: bucket.capabilities.map((capability) => capability.id),
      })),
    pendingCapabilities,
    orphanHandlers,
    capabilitiesWithoutAliases,
    capabilitiesNeverUsed: [] as CosCapabilityId[],
    capabilitiesNeverUsedReason: "Runtime telemetry is required to identify unused capabilities accurately; no persisted local telemetry sample was available.",
  }
}

export function buildCosCapabilityCoverageMarkdown() {
  const report = getCosCapabilityCoverageData()
  const lines = [
    "# COS Capability Coverage Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    `- Total capabilities: ${report.totals.capabilities}`,
    `- Executable capabilities: ${report.totals.executable}`,
    `- Pending capabilities: ${report.totals.pending}`,
    "",
    "## Coverage by Domain",
    "",
    ...report.domains.map(
      (domain) =>
        `- ${domain.domain.padEnd(12, ".")} ${String(domain.coverage).padStart(3, " ")}% (${domain.executable}/${domain.total})`,
    ),
    "",
    "## Pending Capabilities",
    "",
    ...(report.pendingCapabilities.length ? report.pendingCapabilities.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Orphan Handlers",
    "",
    ...(report.orphanHandlers.length ? report.orphanHandlers.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Handlers Without Aliases",
    "",
    ...(report.capabilitiesWithoutAliases.length ? report.capabilitiesWithoutAliases.map((id) => `- ${id}`) : ["- None"]),
    "",
    "## Capabilities Never Used",
    "",
    report.capabilitiesNeverUsedReason,
    ...(report.capabilitiesNeverUsed.length ? report.capabilitiesNeverUsed.map((id) => `- ${id}`) : ["- None observed locally"]),
    "",
  ]

  return lines.join("\n")
}

