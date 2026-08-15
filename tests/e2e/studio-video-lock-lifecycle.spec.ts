import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { shouldReleaseStudioVideoGenerationLock } from "@/lib/studio-ia-video-lock-lifecycle"

test.describe("Studio IA — ciclo de vida do lock de vídeo", () => {
  test("libera o lock quando o provedor falha antes de o job existir", () => {
    expect(shouldReleaseStudioVideoGenerationLock({
      generationLockId: "video_lock_provider_failure",
      jobPersisted: false,
      lockLinked: false,
    })).toBe(true)
  })

  test("preserva o lock de um job persistido e vinculado em andamento", () => {
    expect(shouldReleaseStudioVideoGenerationLock({
      generationLockId: "video_lock_active_job",
      jobPersisted: true,
      lockLinked: true,
    })).toBe(false)
  })

  test("libera um lock que não pôde ser vinculado ao job persistido", () => {
    expect(shouldReleaseStudioVideoGenerationLock({
      generationLockId: "video_lock_unlinked_job",
      jobPersisted: true,
      lockLinked: false,
    })).toBe(true)
  })

  test("a rota registra persistência e vínculo antes de decidir a limpeza", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/studio-ia/video/route.ts"),
      "utf8",
    )

    expect(source).toContain("jobPersisted = true")
    expect(source).toContain("lockLinked = await linkStudioVideoGenerationLock")
    expect(source).toContain("shouldReleaseStudioVideoGenerationLock({")
    expect(source).not.toContain("providerRequestStarted")
  })
})
