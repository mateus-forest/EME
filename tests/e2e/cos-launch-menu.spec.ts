import { expect, test } from "@playwright/test"

import { getCosLaunchCapabilityStatus } from "../../lib/cos/launch-capabilities"
import {
  getCosLaunchAttachmentOptions,
  getCosLaunchMenuGroups,
  getCosLaunchMenuSelection,
} from "../../lib/cos/launch-menu"

test.describe("COS launch action menu", () => {
  test("exposes only items compatible with each launch boundary", () => {
    const expectedStatus = { skills: "SUPPORTED", queries: "READ_ONLY", help: "GUIDANCE_ONLY" } as const
    const groups = getCosLaunchMenuGroups()
    const itemIds = groups.flatMap((group) => group.items.map((item) => item.id))

    expect(groups.map((group) => group.label)).toEqual(["Habilidades", "Consultas", "Ajuda"])
    expect(new Set(itemIds).size).toBe(itemIds.length)

    for (const group of groups) {
      for (const item of group.items) {
        const selection = getCosLaunchMenuSelection(item.id)
        expect(selection).not.toBeNull()
        expect(getCosLaunchCapabilityStatus(selection!.capabilityId)).toBe(expectedStatus[group.id])
      }
    }
  })

  test("keeps the menu concise and removes incomplete or redundant entries", () => {
    const labels = getCosLaunchMenuGroups().flatMap((group) => group.items.map((item) => item.label))

    expect(labels).toHaveLength(18)
    expect(labels).not.toContain("Anexar contrato")
    expect(labels).not.toContain("Tirar uma dúvida")
    expect(labels).not.toContain("Gerar vídeo")
    expect(labels).toContain("Cadastrar cliente")
    expect(labels).toContain("Criar imóvel")
    expect(labels).toContain("Dúvidas sobre o EME")
  })

  test("offers only one PDF document attachment", () => {
    expect(getCosLaunchAttachmentOptions()).toEqual([
      { id: "document", label: "Documento", accept: "application/pdf,.pdf", multiple: false },
    ])
  })
})
