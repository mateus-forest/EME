export const lumaAgentsApiBaseUrl = "https://agents.lumalabs.ai/v1"
export const lumaAgentsVideoModel = "ray-3.2"
export const lumaAgentsImageModel = "uni-1"

export type LumaAgentsOutput = {
  type: string
  url: string
}

export type LumaAgentsGeneration = {
  id: string
  type: string
  state: string
  model: string
  created_at?: string
  output: LumaAgentsOutput[]
  failure_reason: string | null
  failure_code: string | null
}

type LumaAgentsImageRef = {
  url: string
}

export type LumaAgentsVideoGenerationInput = {
  prompt: string
  resolution: "540p" | "720p" | "1080p"
  duration: "5s"
  aspectRatio: "9:16" | "16:9" | "1:1"
  startFrameUrl: string
  endFrameUrl?: string
}

export type LumaAgentsImageEditInput = {
  prompt: string
  aspectRatio: "9:16" | "16:9" | "1:1"
  sourceUrl: string
}

export function buildLumaAgentsVideoGenerationRequest(input: LumaAgentsVideoGenerationInput) {
  return {
    model: lumaAgentsVideoModel,
    type: "video" as const,
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    video: {
      resolution: input.resolution,
      duration: input.duration,
      start_frame: { url: input.startFrameUrl } satisfies LumaAgentsImageRef,
      ...(input.endFrameUrl
        ? { end_frame: { url: input.endFrameUrl } satisfies LumaAgentsImageRef }
        : {}),
    },
  }
}

export function buildLumaAgentsImageEditRequest(input: LumaAgentsImageEditInput) {
  return {
    model: lumaAgentsImageModel,
    type: "image_edit" as const,
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    source: { url: input.sourceUrl } satisfies LumaAgentsImageRef,
  }
}

export function getLumaAgentsOutputUrl(
  generation: LumaAgentsGeneration,
  outputType: "image" | "video",
) {
  return generation.output.find((output) => output.type === outputType)?.url
}
