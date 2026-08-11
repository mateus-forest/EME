import type { StudioProviderId } from "@/lib/studio-providers/types";

export type StudioCapabilityStatus =
  | "active"
  | "adapter_ready"
  | "contract_only"
  | "requires_validation"
  | "unsupported";

export type StudioCapabilityId =
  | "campaign.structured_content"
  | "property_preparation.furnish"
  | "property_preparation.empty_room"
  | "property_preparation.renovation"
  | "property_preparation.edit_via_prompt"
  | "property_preparation.enhance"
  | "property_preparation.perspective"
  | "property_preparation.sky"
  | "property_preparation.blur"
  | "property_preparation.remove_object"
  | "project.terrain_to_construction"
  | "project.construction_to_finished"
  | "project.design_to_realistic"
  | "video.image_to_video"
  | "video.listing_composition"
  | "video.temporal_transformation";

export type StudioCapabilityProvider = {
  capability: StudioCapabilityId;
  provider: StudioProviderId;
  status: StudioCapabilityStatus;
  operation: string | null;
  model: string | null;
  note: string;
};

export const STUDIO_PROVIDER_LABELS: Record<StudioProviderId, string> = {
  openai: "OpenAI",
  pedra: "Pedra",
  lumaai: "Luma",
  xai: "Grok",
};

export const STUDIO_CAPABILITY_CATALOG: readonly StudioCapabilityProvider[] = [
  {
    capability: "campaign.structured_content",
    provider: "openai",
    status: "active",
    operation: "responses.create",
    model: "gpt-5-mini",
    note: "Gera somente o conteúdo estruturado consumido pelo renderer existente do EME.",
  },
  {
    capability: "campaign.structured_content",
    provider: "xai",
    status: "active",
    operation: "POST /v1/responses",
    model: "grok-4.5",
    note: "Structured Outputs no mesmo contrato de conteúdo do renderer existente.",
  },

  ...([
    ["property_preparation.furnish", "/api/furnish"],
    ["property_preparation.empty_room", "/api/empty_room"],
    ["property_preparation.renovation", "/api/renovation"],
    ["property_preparation.edit_via_prompt", "/api/edit_via_prompt"],
    ["property_preparation.enhance", "/api/enhance"],
    ["property_preparation.perspective", "/api/enhance_and_correct_perspective"],
    ["property_preparation.sky", "/api/sky_blue"],
    ["property_preparation.blur", "/api/blur"],
    ["property_preparation.remove_object", "/api/remove_object"],
  ] as const).map(([capability, operation]) => ({
    capability,
    provider: "pedra" as const,
    status: "active" as const,
    operation,
    model: "pedra",
    note: "Capability imobiliária já integrada ao pipeline de Preparar imóvel.",
  })),
  {
    capability: "property_preparation.edit_via_prompt",
    provider: "xai",
    status: "adapter_ready",
    operation: "POST /v1/images/edits",
    model: "grok-imagine-image-quality",
    note: "Edição genérica por imagem e prompt confirmada; ainda não conectada à UX.",
  },
  ...([
    "property_preparation.furnish",
    "property_preparation.empty_room",
    "property_preparation.renovation",
    "property_preparation.edit_via_prompt",
    "property_preparation.enhance",
    "property_preparation.perspective",
    "property_preparation.sky",
    "property_preparation.blur",
    "property_preparation.remove_object",
  ] as const).map((capability) => ({
    capability,
    provider: "openai" as const,
    status: "requires_validation" as const,
    operation: null,
    model: null,
    note: "Provider previsto na matriz de produto, sem adapter operacional validado para esta operação.",
  })),
  ...([
    "property_preparation.furnish",
    "property_preparation.empty_room",
    "property_preparation.renovation",
    "property_preparation.enhance",
    "property_preparation.perspective",
    "property_preparation.sky",
    "property_preparation.blur",
  ] as const).map((capability) => ({
    capability,
    provider: "xai" as const,
    status: "requires_validation" as const,
    operation: "POST /v1/images/edits",
    model: "grok-imagine-image-quality",
    note: "A edição genérica existe, mas o contrato não garante esta operação imobiliária específica.",
  })),
  {
    capability: "property_preparation.remove_object",
    provider: "xai",
    status: "unsupported",
    operation: null,
    model: null,
    note: "O contrato de edição xAI auditado não oferece entrada de máscara equivalente ao fluxo atual.",
  },

  ...([
    "project.terrain_to_construction",
    "project.construction_to_finished",
    "project.design_to_realistic",
  ] as const).flatMap((capability) => [
    {
      capability,
      provider: "openai" as const,
      status: "requires_validation" as const,
      operation: null,
      model: null,
      note: "A matriz prevê OpenAI, mas não há adapter operacional conectado a este caso.",
    },
    {
      capability,
      provider: "xai" as const,
      status: "requires_validation" as const,
      operation: "POST /v1/images/edits",
      model: "grok-imagine-image-quality",
      note: "A edição genérica não comprova fidelidade arquitetônica nem esta transformação específica.",
    },
  ]),

  {
    capability: "video.image_to_video",
    provider: "lumaai",
    status: "active",
    operation: "generations.create",
    model: "ray-2",
    note: "Pipeline assíncrono atual de Criar vídeo.",
  },
  {
    capability: "video.image_to_video",
    provider: "xai",
    status: "adapter_ready",
    operation: "POST /v1/videos/generations",
    model: "grok-imagine-video-1.5",
    note: "Contrato assíncrono confirmado; adapter preparado, ainda não conectado ao fluxo.",
  },
  {
    capability: "video.listing_composition",
    provider: "pedra",
    status: "contract_only",
    operation: "/api/create_video",
    model: "pedra",
    note: "Contrato conhecido, mas bloqueado no EME pelo processamento síncrono de longa duração.",
  },
  {
    capability: "video.listing_composition",
    provider: "lumaai",
    status: "unsupported",
    operation: null,
    model: null,
    note: "O fluxo Luma atual utiliza uma única imagem, não uma composição imobiliária completa.",
  },
  {
    capability: "video.listing_composition",
    provider: "xai",
    status: "requires_validation",
    operation: "POST /v1/videos/generations",
    model: "grok-imagine-video-1.5",
    note: "O contrato auditado não garante composição de timeline imobiliária com branding.",
  },
  ...(["lumaai", "pedra", "xai"] as const).map((provider) => ({
    capability: "video.temporal_transformation" as const,
    provider,
    status: "requires_validation" as const,
    operation:
      provider === "lumaai"
        ? "generations.create"
        : provider === "pedra"
          ? "/api/create_video"
          : "POST /v1/videos/generations",
    model: provider === "lumaai" ? "ray-2" : provider === "xai" ? "grok-imagine-video-1.5" : "pedra",
    note: "Nenhum contrato auditado garante transformação temporal progressiva vazio → mobiliado.",
  })),
] satisfies readonly StudioCapabilityProvider[];

export function getStudioCapabilityProviders(
  capability: StudioCapabilityId,
  statuses: readonly StudioCapabilityStatus[] = ["active", "adapter_ready"],
) {
  return STUDIO_CAPABILITY_CATALOG.filter(
    (entry) => entry.capability === capability && statuses.includes(entry.status),
  );
}
