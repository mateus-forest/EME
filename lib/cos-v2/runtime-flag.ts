import "server-only"

export type CosRuntimeVersion = "v1" | "v2"

export function getCosRuntimeVersion(): CosRuntimeVersion {
  return process.env.COS_RUNTIME_VERSION?.trim().toLowerCase() === "v2" ? "v2" : "v1"
}

export function isCosV2RuntimeEnabled() {
  return getCosRuntimeVersion() === "v2"
}
