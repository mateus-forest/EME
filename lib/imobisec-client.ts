import {
  hasRelevantCreciNameMismatch,
  isOfficiallyActiveCreciStatus,
  isOfficiallyInactiveCreciStatus,
  normalizeCreciNumber,
  normalizeCreciUf,
  type CreciValidationReason,
  type CreciValidationResult,
} from "@/lib/creci-validation"

export const IMOBISEC_API_BASE_URL = "https://api.imobisec.com.br"
export const IMOBISEC_REQUEST_TIMEOUT_MS = 5_000

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type ImobisecCreciValidationInput = {
  state: unknown
  creci: unknown
  informedName: string
}

export type ImobisecCreciValidatorOptions = {
  apiKey: string
  fetchImpl?: FetchLike
  timeoutMs?: number
  now?: () => Date
}

type ImobisecCreciPayload = {
  creci?: unknown
  name?: unknown
  state?: unknown
  status?: unknown
  type?: unknown
}

function pendingResult(input: {
  reason: Extract<
    CreciValidationReason,
    "TIMEOUT" | "CONFIGURATION_ERROR" | "AUTHENTICATION_ERROR" | "PAYMENT_REQUIRED" | "RATE_LIMITED" | "PROVIDER_ERROR"
  >
  creci: string
  state: CreciValidationResult["state"]
  checkedAt: Date
}): CreciValidationResult {
  return {
    status: "PENDING",
    reason: input.reason,
    creci: input.creci,
    state: input.state,
    provider: "IMOBISEC",
    officialName: null,
    providerStatus: null,
    checkedAt: input.checkedAt,
    nameMismatch: false,
  }
}

function providerFailureReason(
  status: number,
): Extract<
  CreciValidationReason,
  "AUTHENTICATION_ERROR" | "PAYMENT_REQUIRED" | "RATE_LIMITED" | "PROVIDER_ERROR"
> {
  if (status === 401 || status === 403) return "AUTHENTICATION_ERROR"
  if (status === 402) return "PAYMENT_REQUIRED"
  if (status === 429) return "RATE_LIMITED"
  return "PROVIDER_ERROR"
}

export async function validateCreciWithImobisec(
  input: ImobisecCreciValidationInput,
  options: ImobisecCreciValidatorOptions,
): Promise<CreciValidationResult> {
  const checkedAt = (options.now ?? (() => new Date()))()
  const state = normalizeCreciUf(input.state)
  const creci = normalizeCreciNumber(input.creci) ?? ""

  if (!state || !creci) {
    return {
      status: "REJECTED",
      reason: "INVALID_INPUT",
      creci,
      state,
      provider: "IMOBISEC",
      officialName: null,
      providerStatus: null,
      checkedAt,
      nameMismatch: false,
    }
  }

  const apiKey = options.apiKey.trim()
  if (!apiKey) {
    return pendingResult({ reason: "CONFIGURATION_ERROR", creci, state, checkedAt })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? IMOBISEC_REQUEST_TIMEOUT_MS)

  try {
    const response = await (options.fetchImpl ?? fetch)(
      `${IMOBISEC_API_BASE_URL}/crecies/${encodeURIComponent(state)}/${encodeURIComponent(creci)}/PF`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Token-Key": apiKey,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    )

    if (response.status === 400 || response.status === 404) {
      return {
        status: "REJECTED",
        reason: response.status === 404 ? "NOT_FOUND" : "INVALID_INPUT",
        creci,
        state,
        provider: "IMOBISEC",
        officialName: null,
        providerStatus: null,
        checkedAt,
        nameMismatch: false,
      }
    }

    if (!response.ok) {
      return pendingResult({ reason: providerFailureReason(response.status), creci, state, checkedAt })
    }

    const payload = (await response.json().catch(() => null)) as ImobisecCreciPayload | null
    const officialName = typeof payload?.name === "string" && payload.name.trim() ? payload.name.trim() : null
    const providerStatus = typeof payload?.status === "string" && payload.status.trim() ? payload.status.trim() : null
    const responseState = normalizeCreciUf(payload?.state)
    const responseCreci = normalizeCreciNumber(payload?.creci)
    const responseType = typeof payload?.type === "string" ? payload.type.trim().toUpperCase() : null

    if (!payload || responseState !== state || responseCreci !== creci || responseType !== "PF" || !providerStatus) {
      return {
        status: "REVIEW_REQUIRED",
        reason: "AMBIGUOUS_RESPONSE",
        creci,
        state,
        provider: "IMOBISEC",
        officialName,
        providerStatus,
        checkedAt,
        nameMismatch: false,
      }
    }

    const nameMismatch = officialName
      ? hasRelevantCreciNameMismatch(input.informedName, officialName)
      : false

    if (isOfficiallyInactiveCreciStatus(providerStatus)) {
      return {
        status: "REJECTED",
        reason: "INACTIVE",
        creci,
        state,
        provider: "IMOBISEC",
        officialName,
        providerStatus,
        checkedAt,
        nameMismatch,
      }
    }

    if (!isOfficiallyActiveCreciStatus(providerStatus) || !officialName) {
      return {
        status: "REVIEW_REQUIRED",
        reason: "AMBIGUOUS_RESPONSE",
        creci,
        state,
        provider: "IMOBISEC",
        officialName,
        providerStatus,
        checkedAt,
        nameMismatch,
      }
    }

    return {
      status: nameMismatch ? "REVIEW_REQUIRED" : "VERIFIED",
      reason: nameMismatch ? "NAME_MISMATCH" : "ACTIVE",
      creci,
      state,
      provider: "IMOBISEC",
      officialName,
      providerStatus,
      checkedAt,
      nameMismatch,
    }
  } catch (error) {
    const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError")
    return pendingResult({ reason: timedOut ? "TIMEOUT" : "PROVIDER_ERROR", creci, state, checkedAt })
  } finally {
    clearTimeout(timeout)
  }
}
