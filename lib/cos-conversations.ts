export const DEFAULT_COS_CONVERSATION_TITLE = "Nova conversa"

export function cleanCosConversationTitle(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export function isDefaultCosConversationTitle(value: unknown) {
  return cleanCosConversationTitle(value) === DEFAULT_COS_CONVERSATION_TITLE
}

export function generateCosConversationTitle(message: string) {
  const normalized = message
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) return DEFAULT_COS_CONVERSATION_TITLE
  if (normalized.length <= 60) return normalized

  return `${normalized.slice(0, 57).trimEnd()}...`
}
