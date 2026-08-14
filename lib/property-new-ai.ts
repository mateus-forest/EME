import type { AdImportDraft } from "@/lib/property-ad-import-shared"

function normalizeDescriptionForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getWordNgrams(value: string, size: number) {
  const words = normalizeDescriptionForComparison(value).split(" ").filter(Boolean)
  if (words.length < size) return new Set(words.length ? [words.join(" ")] : [])

  return new Set(Array.from({ length: words.length - size + 1 }, (_, index) => words.slice(index, index + size).join(" ")))
}

export function isDescriptionTooSimilarToSource(source: string, candidate: string) {
  const normalizedSource = normalizeDescriptionForComparison(source)
  const normalizedCandidate = normalizeDescriptionForComparison(candidate)
  if (!normalizedSource || !normalizedCandidate) return false
  if (normalizedSource === normalizedCandidate) return true

  const sourceWords = normalizedSource.split(" ")
  const candidateWords = normalizedCandidate.split(" ")
  if (sourceWords.length >= 8 && normalizedCandidate.includes(normalizedSource)) return true

  const sourceNgrams = getWordNgrams(normalizedSource, 3)
  const candidateNgrams = getWordNgrams(normalizedCandidate, 3)
  if (!candidateNgrams.size) return false

  const matchingNgrams = Array.from(candidateNgrams).filter((gram) => sourceNgrams.has(gram)).length
  const overlap = matchingNgrams / candidateNgrams.size
  const expansion = candidateWords.length / Math.max(sourceWords.length, 1)
  return overlap >= 0.58 && expansion < 1.8
}

export function buildCommercialDescriptionPrompt(draft: AdImportDraft, retry = false) {
  const propertyFacts = {
    title: draft.title || null,
    type: draft.type || null,
    city: draft.city || null,
    neighborhood: draft.neighborhood || null,
    address: draft.address || null,
    price: draft.price || null,
    bedrooms: draft.bedrooms || null,
    bathrooms: draft.bathrooms || null,
    parking: draft.parking || null,
    area: draft.area || null,
    features: draft.features,
    tags: draft.tags,
  }

  return [
    "Escreva a descricao comercial de um anuncio imobiliario em portugues do Brasil.",
    "Use exclusivamente os fatos presentes no JSON abaixo; omita qualquer informacao ausente.",
    "Crie um texto novo, coeso e natural. Nao copie frases do material de origem nem reproduza uma transcricao.",
    "Nao acrescente vista, acabamento, lazer, seguranca, proximidades, estado de conservacao ou outros atributos nao informados.",
    "Nao mencione campos, JSON, fonte, usuario, audio, imagem, transcricao ou informacoes ausentes.",
    "Use de 80 a 140 palavras quando houver fatos suficientes. Se o contexto for curto, prefira um texto menor e verdadeiro.",
    retry ? "A tentativa anterior ficou semelhante demais ao material de origem. Mude a estrutura, a ordem e a redacao sem mudar os fatos." : "",
    "",
    JSON.stringify({
      propertyFacts,
      sourceTextToRewrite: draft.description || null,
    }),
  ].filter(Boolean).join("\n")
}
