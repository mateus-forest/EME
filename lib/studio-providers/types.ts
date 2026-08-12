export type StudioProviderId = "openai" | "pedra" | "lumaai" | "xai";

export type StudioProviderCostSource = "provider_reported" | "estimated" | "unavailable";

export type StudioProviderResult<T> = {
  provider: StudioProviderId;
  model: string;
  capability: string;
  status: "completed";
  data: T;
  durationMs: number;
  externalRequestId?: string | null;
  costUsd?: number | null;
  costSource: StudioProviderCostSource;
  metadata?: Record<string, unknown>;
};

export type StudioImageProviderInput = {
  prompt: string;
  imageUrl?: string;
  aspectRatio?: string;
  resolution?: "1k" | "2k";
};

export type StudioImageProviderOutput = {
  url?: string | null;
  base64?: string | null;
  mimeType?: string | null;
  revisedPrompt?: string | null;
};

export type StudioImageEditProviderInput = {
  prompt: string;
  imageUrl: string;
  maskUrl?: string;
};

export type StudioVideoProviderInput = {
  prompt: string;
  imageUrl: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: "480p" | "720p" | "1080p";
};

export type StudioVideoProviderJob = {
  requestId: string;
};

export type StudioVideoProviderStatus = {
  status: "pending" | "done" | "expired" | "failed";
  progress?: number | null;
  videoUrl?: string | null;
  duration?: number | null;
  model?: string | null;
};
