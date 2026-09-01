import { expect, test } from "@playwright/test"

import { listCosCapabilityCatalog } from "../../lib/cos/capability-catalog"
import {
  canInvokeCosLaunchCapability,
  COS_LAUNCH_CAPABILITY_IDS,
  COS_LAUNCH_NOT_AVAILABLE_MESSAGE,
  getCosLaunchCapabilityStatus,
  listCosLaunchCapabilityIds,
} from "../../lib/cos/launch-capabilities"

test.describe("COS launch capability boundaries", () => {
  test("classifies every registered capability exactly once", () => {
    const registeredIds = listCosCapabilityCatalog().map((capability) => capability.id).sort()
    const classifiedIds = listCosLaunchCapabilityIds().sort()

    expect(new Set(classifiedIds).size).toBe(classifiedIds.length)
    expect(classifiedIds).toEqual(registeredIds)
    expect(COS_LAUNCH_CAPABILITY_IDS.SUPPORTED).toHaveLength(22)
    expect(COS_LAUNCH_CAPABILITY_IDS.READ_ONLY).toHaveLength(37)
    expect(COS_LAUNCH_CAPABILITY_IDS.GUIDANCE_ONLY).toHaveLength(8)
    expect(COS_LAUNCH_CAPABILITY_IDS.NOT_AVAILABLE).toHaveLength(7)
  })

  test("keeps unclassified and incomplete operations unavailable", () => {
    expect(getCosLaunchCapabilityStatus("unknown.future.capability")).toBe("NOT_AVAILABLE")
    expect(canInvokeCosLaunchCapability("contract.send")).toBe(false)
    expect(canInvokeCosLaunchCapability("property.archive")).toBe(false)
    expect(canInvokeCosLaunchCapability("studio.generateVideo")).toBe(false)
    expect(canInvokeCosLaunchCapability("lead.create")).toBe(true)
  })

  test("uses a short user-facing response without internal vocabulary", () => {
    expect(COS_LAUNCH_NOT_AVAILABLE_MESSAGE).toBe(
      "Ainda não consigo executar essa ação diretamente por aqui. Posso te orientar sobre como fazer no EME.",
    )
    expect(COS_LAUNCH_NOT_AVAILABLE_MESSAGE).not.toMatch(/capability|handler|intent|action|snake_case/i)
  })

  test("does not classify a persisted mutation as read-only", () => {
    const readOnly = new Set<string>(COS_LAUNCH_CAPABILITY_IDS.READ_ONLY)
    const exceptions = new Set(["studio.generateStory"])
    const invalid = listCosCapabilityCatalog()
      .filter((capability) => readOnly.has(capability.id) && capability.mutatesData && !exceptions.has(capability.id))
      .map((capability) => capability.id)

    expect(invalid).toEqual([])
  })
})
