import { expect, test } from "@playwright/test"

import {
  buildLumaAgentsImageEditRequest,
  buildLumaAgentsVideoGenerationRequest,
  getLumaAgentsOutputUrl,
  lumaAgentsApiBaseUrl,
  lumaAgentsImageModel,
  lumaAgentsVideoModel,
  type LumaAgentsGeneration,
} from "@/lib/luma-agents-contract"
import { getStudioCapabilityProviders } from "@/lib/studio-provider-catalog"

test.describe("Luma Agents API — contrato do Studio IA", () => {
  test("usa a API e o modelo atuais", () => {
    expect(lumaAgentsApiBaseUrl).toBe("https://agents.lumalabs.ai/v1")
    expect(lumaAgentsVideoModel).toBe("ray-3.2")
    expect(lumaAgentsImageModel).toBe("uni-1")
  })

  test("mantém o catálogo do Studio alinhado ao contrato Agents", () => {
    const imageToVideo = getStudioCapabilityProviders("video.image_to_video")
      .find((entry) => entry.provider === "lumaai")
    const startEnd = getStudioCapabilityProviders("video.start_end_transition")
      .find((entry) => entry.provider === "lumaai")

    expect(imageToVideo).toMatchObject({
      status: "active",
      model: "ray-3.2",
      operation: "POST /v1/generations video.start_frame",
    })
    expect(startEnd).toMatchObject({
      status: "active",
      model: "ray-3.2",
      operation: "POST /v1/generations video.start_frame/end_frame",
    })
  })

  test("preserva imagem original e imagem final aprovada como frames", () => {
    expect(buildLumaAgentsVideoGenerationRequest({
      prompt: "Movimento imobiliario suave",
      resolution: "720p",
      duration: "5s",
      aspectRatio: "9:16",
      startFrameUrl: "https://images.example.com/original.jpg",
      endFrameUrl: "https://images.example.com/approved.jpg",
    })).toEqual({
      model: "ray-3.2",
      type: "video",
      prompt: "Movimento imobiliario suave",
      aspect_ratio: "9:16",
      video: {
        resolution: "720p",
        duration: "5s",
        start_frame: { url: "https://images.example.com/original.jpg" },
        end_frame: { url: "https://images.example.com/approved.jpg" },
      },
    })
  })

  test("adapta a previa transformada ao contrato image_edit", () => {
    expect(buildLumaAgentsImageEditRequest({
      prompt: "Mobiliar sem mudar a arquitetura",
      aspectRatio: "16:9",
      sourceUrl: "https://images.example.com/original.jpg",
    })).toEqual({
      model: "uni-1",
      type: "image_edit",
      prompt: "Mobiliar sem mudar a arquitetura",
      aspect_ratio: "16:9",
      source: { url: "https://images.example.com/original.jpg" },
    })
  })

  test("lê a URL final no array output da Agents API", () => {
    const generation: LumaAgentsGeneration = {
      id: "generation-id",
      type: "video",
      state: "completed",
      model: "ray-3.2",
      output: [
        { type: "thumbnail", url: "https://outputs.example.com/thumb.jpg" },
        { type: "video", url: "https://outputs.example.com/video.mp4" },
      ],
      failure_reason: null,
      failure_code: null,
    }

    expect(getLumaAgentsOutputUrl(generation, "video")).toBe("https://outputs.example.com/video.mp4")
    expect(getLumaAgentsOutputUrl(generation, "image")).toBeUndefined()
  })
})
