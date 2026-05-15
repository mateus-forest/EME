export type PropertyAiPayload = {
  title: string
  type: "Apartamento" | "Casa" | "Comercial"
  city: string
  neighborhood: string
  price: string
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  description?: string
}

export type PropertyAiResult = {
  description: string
  suggestedTitle: string
  highlights: string[]
}

function isPropertyAiResult(data: unknown): data is PropertyAiResult {
  if (!data || typeof data !== "object") return false

  const candidate = data as Partial<PropertyAiResult>
  return (
    typeof candidate.description === "string" &&
    typeof candidate.suggestedTitle === "string" &&
    Array.isArray(candidate.highlights)
  )
}

export async function requestPropertyAi(payload: PropertyAiPayload) {
  const response = await fetch("/api/ai/generate-property", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => null)) as
    | PropertyAiResult
    | { error?: string }
    | null

  if (!response.ok) {
    const errorMessage = data && "error" in data ? data.error : undefined
    throw new Error(errorMessage || "Não foi possível gerar o anúncio com IA.")
  }

  if (!isPropertyAiResult(data)) {
    throw new Error("Não foi possível interpretar o anúncio gerado com IA.")
  }

  return {
    description: data.description,
    suggestedTitle: data.suggestedTitle,
    highlights: data.highlights.filter((item): item is string => typeof item === "string"),
  }
}
