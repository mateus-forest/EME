import { z } from "zod"

export const propertyPreparationRoomTypes = [
  { value: "Living room", label: "Sala de estar" },
  { value: "Dining + Living room", label: "Sala de estar e jantar" },
  { value: "Bedroom", label: "Quarto" },
  { value: "Dining room", label: "Sala de jantar" },
  { value: "Terrace", label: "Terraço" },
  { value: "Entrance", label: "Entrada" },
  { value: "Office", label: "Escritório" },
  { value: "Bathroom", label: "Banheiro" },
] as const

export const propertyPreparationStyles = [
  { value: "Minimalist", label: "Minimalista" },
  { value: "Modern", label: "Moderno" },
  { value: "Scandinavian", label: "Escandinavo" },
  { value: "Industrial", label: "Industrial" },
  { value: "Bohemian", label: "Boêmio" },
  { value: "Mid-century modern", label: "Mid-century moderno" },
  { value: "Traditional", label: "Tradicional" },
  { value: "Mediterranean", label: "Mediterrâneo" },
  { value: "Coastal", label: "Litorâneo" },
  { value: "Rustic", label: "Rústico" },
  { value: "Farmhouse", label: "Casa de campo" },
  { value: "Contemporary", label: "Contemporâneo" },
] as const

export const propertyPreparationCreativityLevels = [
  { value: "Medium", label: "Recomendada", description: "Modelo principal para maior qualidade do resultado." },
  { value: "High", label: "Rápida", description: "Modelo mais leve, rápido e econômico." },
] as const

export const propertyPreparationSkyStyles = [
  { value: "sunny", label: "Ensolarado" },
  { value: "sunny-no-reflections", label: "Ensolarado, luz suave" },
  { value: "sunrise", label: "Amanhecer" },
  { value: "dawn", label: "Entardecer" },
  { value: "night", label: "Anoitecer" },
] as const

export const propertyPreparationBlurTargets = [
  { value: "faces", label: "Rostos" },
  { value: "license plates", label: "Placas de veículos" },
  { value: "logos", label: "Logotipos" },
] as const

export const propertyPreparationOperations = [
  { value: "furnish", label: "Mobiliar ambiente", shortLabel: "Mobiliar", description: "Adicione móveis e decoração a um ambiente vazio." },
  { value: "empty_room", label: "Esvaziar ambiente", shortLabel: "Esvaziar", description: "Remova móveis e objetos, preservando a arquitetura." },
  { value: "renovation", label: "Reformar / redecorar", shortLabel: "Reformar", description: "Atualize acabamentos e a apresentação do ambiente." },
  { value: "edit_via_prompt", label: "Editar por instrução", shortLabel: "Editar", description: "Descreva uma alteração pontual na fotografia." },
  { value: "enhance", label: "Melhorar fotografia", shortLabel: "Melhorar foto", description: "Aprimore luz, nitidez, cores e contraste." },
  { value: "enhance_and_correct_perspective", label: "Corrigir perspectiva", shortLabel: "Perspectiva", description: "Endireite linhas e melhore a fotografia." },
  { value: "sky_blue", label: "Melhorar céu", shortLabel: "Céu", description: "Substitua um céu apagado e ajuste a iluminação." },
  { value: "blur", label: "Desfocar elementos sensíveis", shortLabel: "Desfocar", description: "Desfoque automaticamente rostos, placas ou logotipos." },
  { value: "remove_object", label: "Remover objeto", shortLabel: "Remover objeto", description: "Marque visualmente o objeto ou a região que deseja remover." },
] as const

export type PropertyPreparationOperation = (typeof propertyPreparationOperations)[number]["value"]

const roomTypeValues = propertyPreparationRoomTypes.map((item) => item.value) as [string, ...string[]]
const styleValues = propertyPreparationStyles.map((item) => item.value) as [string, ...string[]]
const skyStyleValues = propertyPreparationSkyStyles.map((item) => item.value) as [string, ...string[]]
const blurTargetValues = propertyPreparationBlurTargets.map((item) => item.value)

const booleanFromForm = z.preprocess((value) => value === true || value === "true", z.boolean())

export const furnishRoomRequestSchema = z.object({
  operation: z.literal("furnish").default("furnish"),
  roomType: z.enum(roomTypeValues),
  style: z.enum(styleValues),
  creativity: z.enum(["Medium", "High"]).default("Medium"),
})

const emptyRoomRequestSchema = z.object({
  operation: z.literal("empty_room"),
})

const renovationRequestSchema = z.object({
  operation: z.literal("renovation"),
  style: z.enum(styleValues),
  preserveWindows: booleanFromForm.default(false),
  furnish: booleanFromForm.default(false),
  roomType: z.enum([...roomTypeValues, "Auto"] as [string, ...string[]]).default("Auto"),
  creativity: z.enum(["Medium", "High"]).default("Medium"),
})

const editViaPromptRequestSchema = z.object({
  operation: z.literal("edit_via_prompt"),
  prompt: z.string().trim().min(5).max(800),
})

const enhancementFields = {
  highFidelity: booleanFromForm.default(false),
  preserveOriginalFraming: booleanFromForm.default(false),
}

const enhanceRequestSchema = z.object({
  operation: z.literal("enhance"),
  ...enhancementFields,
})

const perspectiveRequestSchema = z.object({
  operation: z.literal("enhance_and_correct_perspective"),
  ...enhancementFields,
})

const skyRequestSchema = z.object({
  operation: z.literal("sky_blue"),
  skyStyle: z.enum(skyStyleValues).default("sunny"),
})

const blurRequestSchema = z.object({
  operation: z.literal("blur"),
  objectsToBlur: z.string().trim().min(1).max(120).refine(
    (value) => value.split(",").map((item) => item.trim()).every((item) => blurTargetValues.includes(item as (typeof blurTargetValues)[number])),
    "Selecione apenas elementos suportados para desfoque.",
  ),
})

const removeObjectRequestSchema = z.object({
  operation: z.literal("remove_object"),
})

export const propertyPreparationRequestSchema = z.discriminatedUnion("operation", [
  furnishRoomRequestSchema,
  emptyRoomRequestSchema,
  renovationRequestSchema,
  editViaPromptRequestSchema,
  enhanceRequestSchema,
  perspectiveRequestSchema,
  skyRequestSchema,
  blurRequestSchema,
  removeObjectRequestSchema,
]).transform((input) => (
  "highFidelity" in input && input.highFidelity
    ? { ...input, preserveOriginalFraming: false }
    : input
))

export type FurnishRoomRequest = z.infer<typeof furnishRoomRequestSchema>
export type PropertyPreparationRequest = z.infer<typeof propertyPreparationRequestSchema>

export function getPropertyPreparationOperation(operation: PropertyPreparationOperation) {
  return propertyPreparationOperations.find((item) => item.value === operation) ?? propertyPreparationOperations[0]
}

export function getPropertyPreparationExternalCredits(input: PropertyPreparationRequest) {
  if (input.operation === "furnish" || input.operation === "renovation") {
    return input.creativity === "High" ? 1 : 2
  }
  if (input.operation === "edit_via_prompt") return 2
  return 1
}

const preservationRules = [
  "Preserve the original camera position, perspective, framing and apparent room dimensions.",
  "Preserve the building architecture, walls, ceiling, floor plan, doors, windows, openings and fixed structural elements unless the requested operation explicitly targets a finish.",
  "Do not add rooms, openings, doors, windows or structural elements.",
  "Keep the result photorealistic and suitable for a real-estate listing.",
].join(" ")

export function buildPropertyPreparationEditPrompt(input: PropertyPreparationRequest) {
  switch (input.operation) {
    case "furnish":
      return `${preservationRules} Furnish only the existing ${input.roomType} with coherent ${input.style} furniture, lighting and restrained decoration. Keep all architecture and fixed surfaces unchanged. Place furniture at realistic scale with correct perspective, contact shadows and circulation space. Composition level: ${input.creativity}. Do not renovate or change finishes.`
    case "empty_room":
      return `${preservationRules} Remove all movable furniture, loose decoration and personal objects from the room. Reconstruct only the small occluded portions of the existing floor and walls consistently. Do not change finishes, lighting design or architecture. Return the same room completely empty and clean.`
    case "renovation":
      return `${preservationRules} Redecorate and renovate the visible finishes in a coherent ${input.style} style. ${input.preserveWindows ? "Keep every window exactly in its original position, size and design." : "Do not add or remove windows."} ${input.furnish ? `Add coherent ${input.style} furniture for a ${input.roomType} at realistic scale.` : "Do not add furniture."} Composition level: ${input.creativity}. Do not alter the floor plan or structural geometry.`
    case "edit_via_prompt":
      return `${preservationRules} Apply only this requested visual edit: ${input.prompt}. Do not make unrelated changes.`
    case "enhance":
      return `${preservationRules} Improve only photographic quality: correct exposure and white balance, recover natural detail, reduce noise, improve sharpness and use realistic color and contrast. ${input.highFidelity ? "Use maximum input fidelity and do not change any visible object, material or finish." : "Keep the scene content unchanged."} ${input.preserveOriginalFraming ? "Preserve the exact original framing and crop." : "Avoid cropping unless minimally necessary."}`
    case "enhance_and_correct_perspective":
      return `${preservationRules} Correct lens distortion, horizon and converging vertical lines so architectural lines appear natural and professionally photographed. Improve exposure, white balance, detail and sharpness without changing any object, material, finish or structural geometry. ${input.highFidelity ? "Use maximum input fidelity." : "Keep high visual fidelity."} ${input.preserveOriginalFraming ? "Preserve the original framing and crop as closely as possible." : "Crop only the minimum needed for perspective correction."}`
    case "sky_blue":
      return `${preservationRules} Replace only the visible sky with a realistic ${input.skyStyle} sky and adjust ambient light and reflections subtly to match. Preserve the property, facade, vegetation, ground, boundaries and every non-sky object exactly. Do not add or remove architectural elements.`
    case "remove_object":
      return `${preservationRules} Remove only the object inside the provided edit mask. Reconstruct the occluded background consistently with the surrounding surfaces. Do not change anything outside the masked region.`
    case "blur":
      throw new Error("A operação de desfoque exige um provider especializado.")
  }
}
