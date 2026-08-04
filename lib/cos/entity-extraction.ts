// Pure, DB-free extraction (no "server-only"/prisma imports) so it can be unit
// tested directly from scripts/run-cos-planner-scenarios.cjs without a database.

const NAME_STOPWORDS = new Set([
  "um", "uma", "uns", "umas", "o", "a", "os", "as", "e",
  "de", "da", "do", "das", "dos", "ao", "aos",
  "este", "esta", "esse", "essa", "isso", "aquele", "aquela",
])

const CLIENT_COMMAND_WORDS =
  /\b(?:cadastrar|cadastre|criar|crie|salvar|salva|adicionar|adicione|incluir|inclua|novo|nova|lead|contato|cliente)\b/gi

// Words that, if still present after stripping known command language, mean
// the leftover text is still an instruction/sentence, not a name.
const RESIDUAL_INSTRUCTION_PATTERN =
  /\b(anexe|anexar|vincule|vincular|junte|juntar|atualize|atualizar|edite|editar|mude|mudar|corrija|corrigir|busque|buscar|encontre|encontrar|traga|trazer|quero|queria|preciso|favor|documento|imovel|imóvel)\b/i

const NAME_MARKER_PATTERN =
  /\b(?:chamad[oa]|nomead[oa]|apelidad[oa]|de nome|nome)\b[:]?\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,1})/iu

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function normalizeForCompare(value: string) {
  return value.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase()
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

function looksLikeRawCommandSentence(value: string) {
  if (!value) return true
  const wordCount = value.trim().split(/\s+/).filter(Boolean).length
  if (wordCount > 4) return true
  if (RESIDUAL_INSTRUCTION_PATTERN.test(value)) return true
  return false
}

export type ExtractedClientIdentity = {
  name: string
  phone: string
  // true when name came from an unambiguous marker (e.g. "chamado X"), not a leftover-text guess
  confident: boolean
}

// Never returns raw command text as `name` — if no reliable value is found, `name` is left
// empty so the caller can treat it as a pending field instead of a bogus create.
export function extractClientIdentity(message: string): ExtractedClientIdentity {
  const phoneMatch = message.replace(/\D/g, "").match(/(\d{10,13})/)
  const phone = phoneMatch?.[1] ?? ""

  const markerMatch = message.match(NAME_MARKER_PATTERN)
  if (markerMatch?.[1]) {
    const candidate = collapseWhitespace(markerMatch[1])
    if (candidate && !RESIDUAL_INSTRUCTION_PATTERN.test(candidate)) {
      return { name: titleCase(candidate), phone, confident: true }
    }
  }

  const withoutCommands = message
    .replace(CLIENT_COMMAND_WORDS, " ")
    .replace(/[:;.!?]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && /\p{L}/u.test(token) && !NAME_STOPWORDS.has(normalizeForCompare(token)))
    .join(" ")

  const phoneStart = phone ? withoutCommands.search(new RegExp(phone.split("").join("\\D*"))) : -1
  const rawName = phoneStart >= 0 ? withoutCommands.slice(0, phoneStart) : withoutCommands
  const cleaned = collapseWhitespace(rawName.replace(/[,]+/g, " "))

  if (looksLikeRawCommandSentence(cleaned)) {
    return { name: "", phone, confident: false }
  }

  return { name: titleCase(cleaned), phone, confident: false }
}

const ATTACH_UPDATE_VERBS =
  /\b(anexe|anexar|vincule|vincular|junte|juntar|atualize|atualizar|edite|editar|mude|mudar|corrija|corrigir)\b/i

const NAMED_CLIENT_REFERENCE_PATTERN =
  /\b(?:cliente|lead|contato)\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2})/iu

function extractNamedClientReference(message: string): string | null {
  const match = message.match(NAMED_CLIENT_REFERENCE_PATTERN)
  if (!match?.[1]) return null

  const name = collapseWhitespace(match[1])
  if (!name || RESIDUAL_INSTRUCTION_PATTERN.test(name)) return null

  return titleCase(name)
}

// Detects messages that reference an *existing* named client via an attach/update-style
// verb (e.g. "Anexe esse documento ao cliente carlos"), as opposed to a create request.
export function detectNamedClientReference(message: string): string | null {
  if (!ATTACH_UPDATE_VERBS.test(message)) return null
  return extractNamedClientReference(message)
}

const DELETE_CLIENT_VERBS = /\b(exclua|excluir|delete|deletar|apague|apagar|remova|remover)\b/i

// Same shape as detectNamedClientReference, gated on delete-style verbs instead — kept separate
// rather than folding into ATTACH_UPDATE_VERBS since that regex is also relied on by the
// attach/update misclassification guard in lib/eme-backend.ts, which shouldn't start intercepting
// delete messages too.
export function detectNamedClientReferenceForDeletion(message: string): string | null {
  if (!DELETE_CLIENT_VERBS.test(message)) return null
  return extractNamedClientReference(message)
}
