type SecurityAttachment = {
  name: string
  textContent?: string
}

export type CosDecisionSecurityAudit = {
  flagged: boolean
  scorePenalty: number
  reasons: string[]
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/i,
  /ignore .*instru/i,
  /ignorar (todas as )?(instrucoes|instruções) anteriores/i,
  /system prompt/i,
  /prompt interno/i,
  /reveal (your|the) instructions/i,
  /mostre (suas|as) instrucoes internas/i,
  /bypass/i,
  /desconsidere as regras/i,
  /execute sem confirmar/i,
  /delete all/i,
  /apague tudo/i,
  /exclua tudo/i,
]

const SUSPICIOUS_ATTACHMENT_PATTERNS = [
  /<script/i,
  /ignore previous instructions/i,
  /system prompt/i,
  /rm -rf/i,
  /drop table/i,
  /bypass/i,
]

function hasPatternMatch(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

export function evaluateCosDecisionSecurity(input: {
  message: string
  attachments?: SecurityAttachment[]
}) : CosDecisionSecurityAudit {
  const reasons: string[] = []
  let scorePenalty = 0

  if (hasPatternMatch(input.message, PROMPT_INJECTION_PATTERNS)) {
    reasons.push("prompt_injection_message")
    scorePenalty += 0.35
  }

  for (const attachment of input.attachments ?? []) {
    const haystack = `${attachment.name}\n${attachment.textContent ?? ""}`
    if (hasPatternMatch(haystack, SUSPICIOUS_ATTACHMENT_PATTERNS)) {
      reasons.push(`suspicious_attachment:${attachment.name}`)
      scorePenalty += 0.2
    }
  }

  return {
    flagged: reasons.length > 0,
    scorePenalty: Math.min(0.7, Number(scorePenalty.toFixed(2))),
    reasons,
  }
}
