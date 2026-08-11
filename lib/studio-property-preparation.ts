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

export const propertyPreparationRequestSchema = z.discriminatedUnion("operation", [
  furnishRoomRequestSchema,
  emptyRoomRequestSchema,
  renovationRequestSchema,
  editViaPromptRequestSchema,
  enhanceRequestSchema,
  perspectiveRequestSchema,
  skyRequestSchema,
  blurRequestSchema,
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
