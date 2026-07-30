import type { CosCapabilitySurface, CosWorkspaceContext, CosWorkspaceEntity, CosWorkspaceSelection } from "@/lib/cos/types"

function cleanString(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function sanitizeSelection(value: unknown): CosWorkspaceSelection[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null

      const record = item as Record<string, unknown>
      const entity = cleanString(record.entity, 40) as CosWorkspaceEntity
      const entityId = cleanString(record.entityId, 120)
      const label = cleanString(record.label, 160)

      if (!entity || !entityId) return null

      return {
        entity,
        entityId,
        ...(label ? { label } : {}),
      }
    })
    .filter((item): item is CosWorkspaceSelection => Boolean(item))
}

function inferWorkspaceFromSegments(pathname: string) {
  const normalizedPath = pathname.split("?")[0]?.split("#")[0] ?? pathname
  const segments = normalizedPath.split("/").filter(Boolean)

  if (segments[0] !== "corretor") {
    return {
      page: segments[0] || "public",
      entity: "general" as CosWorkspaceEntity,
      entityId: null,
    }
  }

  if (segments.length === 1) {
    return {
      page: "cos_home",
      entity: "operation" as CosWorkspaceEntity,
      entityId: null,
    }
  }

  if (segments[1] === "historico") {
    return {
      page: "cos_history",
      entity: "conversation" as CosWorkspaceEntity,
      entityId: null,
    }
  }

  if (segments[1] === "agenda") {
    return {
      page: "agenda",
      entity: "agenda" as CosWorkspaceEntity,
      entityId: null,
    }
  }

  if (segments[1] === "clientes") {
    return {
      page: segments[2] ? "lead_detail" : "lead_list",
      entity: "lead" as CosWorkspaceEntity,
      entityId: segments[2] ?? null,
    }
  }

  if (segments[1] === "imoveis" || segments[1] === "novo-imovel") {
    return {
      page: segments[1] === "novo-imovel" ? "property_create" : segments[2] ? "property_detail" : "property_list",
      entity: "property" as CosWorkspaceEntity,
      entityId: segments[2] ?? null,
    }
  }

  if (segments[1] === "documentos" && segments[2] === "contratos") {
    return {
      page: "contracts",
      entity: "contract" as CosWorkspaceEntity,
      entityId: null,
    }
  }

  if (segments[1] === "studio-ia") {
    return {
      page: segments[2] ? `studio_ia_${segments[2].replace(/\//g, "_")}` : "studio_ia",
      entity: "studio_ia" as CosWorkspaceEntity,
      entityId: segments[3] ?? segments[2] ?? null,
    }
  }

  return {
    page: segments.slice(1).join("_"),
    entity: "operation" as CosWorkspaceEntity,
    entityId: null,
  }
}

export function deriveWorkspaceContextFromPathname(input: {
  pathname: string
  surface: CosCapabilitySurface
  workspace?: Partial<CosWorkspaceContext> | null
}): CosWorkspaceContext {
  const base = inferWorkspaceFromSegments(input.pathname)
  const workspace = input.workspace ?? {}

  const entity = (cleanString(workspace.entity, 40) as CosWorkspaceEntity) || base.entity
  const entityId = cleanString(workspace.entityId, 120) || base.entityId || null
  const page = cleanString(workspace.page, 80) || base.page
  const selection = sanitizeSelection(workspace.selection)

  return {
    surface: input.surface,
    page,
    entity,
    entityId,
    selection,
    pendingEntity: (cleanString(workspace.pendingEntity, 40) as CosWorkspaceEntity) || null,
    pendingEntityId: cleanString(workspace.pendingEntityId, 120) || null,
    metadata: {
      pathname: input.pathname,
      ...(workspace.metadata && typeof workspace.metadata === "object" && !Array.isArray(workspace.metadata)
        ? workspace.metadata
        : {}),
    },
  }
}

export function sanitizeWorkspaceContext(input: unknown, fallbackSurface: CosCapabilitySurface): CosWorkspaceContext | null {
  if (!input || typeof input !== "object") return null

  const record = input as Record<string, unknown>
  const surface = (cleanString(record.surface, 40) as CosCapabilitySurface) || fallbackSurface
  const page = cleanString(record.page, 80) || "unknown"
  const entity = cleanString(record.entity, 40) as CosWorkspaceEntity
  const entityId = cleanString(record.entityId, 120) || null
  const selection = sanitizeSelection(record.selection)
  const pendingEntity = (cleanString(record.pendingEntity, 40) as CosWorkspaceEntity) || null
  const pendingEntityId = cleanString(record.pendingEntityId, 120) || null
  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : {}

  if (!entity) return null

  return {
    surface,
    page,
    entity,
    entityId,
    selection,
    pendingEntity,
    pendingEntityId,
    metadata,
  }
}
