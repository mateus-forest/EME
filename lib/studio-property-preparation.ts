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

const roomTypeValues = propertyPreparationRoomTypes.map((item) => item.value) as [string, ...string[]]
const styleValues = propertyPreparationStyles.map((item) => item.value) as [string, ...string[]]

export const furnishRoomRequestSchema = z.object({
  roomType: z.enum(roomTypeValues),
  style: z.enum(styleValues),
  creativity: z.enum(["Medium", "High"]).default("Medium"),
})

export type FurnishRoomRequest = z.infer<typeof furnishRoomRequestSchema>
