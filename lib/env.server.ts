import "server-only"

function readEnv(name: string) {
  return process.env[name]?.trim() ?? ""
}

function parseBoolean(value: string, defaultValue = false) {
  if (!value) return defaultValue
  const normalized = value.toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) return true
  if (["0", "false", "no", "off"].includes(normalized)) return false
  return defaultValue
}

function parsePositiveInteger(value: string, defaultValue: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue
}

function requireEnv(name: string) {
  const value = readEnv(name)
  if (!value) {
    throw new Error(`${name} precisa estar configurada no ambiente.`)
  }
  return value
}

function readFirstEnv(names: string[]) {
  for (const name of names) {
    const value = readEnv(name)
    if (value) return value
  }

  return ""
}

export function getRequiredRuntimeEnv() {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    authSecret: requireEnv("AUTH_SECRET"),
    appUrl: requireEnv("NEXT_PUBLIC_APP_URL"),
  }
}

export function getAuthEnv() {
  const sessionMaxAgeDays = parsePositiveInteger(readEnv("SESSION_MAX_AGE_DAYS"), 30)
  const secureAuto = parseBoolean(readEnv("COOKIE_SECURE_AUTO"), true)

  return {
    secret: requireEnv("AUTH_SECRET"),
    sessionMaxAgeSeconds: sessionMaxAgeDays * 24 * 60 * 60,
    cookieSecure: secureAuto ? process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL) : false,
  }
}

export function getStripeEnv() {
  const enabled = parseBoolean(readEnv("STRIPE_ENABLED"), false)

  return {
    enabled,
    secretKey: readEnv("STRIPE_SECRET_KEY"),
    webhookSecret: readEnv("STRIPE_WEBHOOK_SECRET"),
    brokerPriceId: readEnv("STRIPE_PRICE_BROKER"),
    agencyBasePriceId: readFirstEnv(["STRIPE_PRICE_AGENCY_BASE", "STRIPE_PRICE_AGENCY"]),
    publishableKey: readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
  }
}

export function getOpenAIEnv() {
  const enabled = parseBoolean(readEnv("OPENAI_ENABLED"), false)

  return {
    enabled,
    apiKey: enabled ? requireEnv("OPENAI_API_KEY") : readEnv("OPENAI_API_KEY"),
    model: readEnv("OPENAI_MODEL") || "gpt-5-mini",
  }
}

export function getLumaAIEnv() {
  return {
    apiKey: readEnv("LUMAAI_API_KEY"),
    videoModel: readEnv("LUMAAI_VIDEO_MODEL") || "ray-2",
    previewVideoModel: readEnv("LUMAAI_VIDEO_PREVIEW_MODEL") || "ray-flash-2",
    imageModel: readEnv("LUMAAI_IMAGE_MODEL") || "photon-flash-1",
  }
}

export function getWhatsAppEnv() {
  const enabled = parseBoolean(readEnv("WHATSAPP_ENABLED"), false)

  return {
    enabled,
    provider: readEnv("WHATSAPP_PROVIDER"),
    accessToken: enabled ? requireEnv("WHATSAPP_ACCESS_TOKEN") : readEnv("WHATSAPP_ACCESS_TOKEN"),
    phoneNumberId: enabled ? requireEnv("WHATSAPP_PHONE_NUMBER_ID") : readEnv("WHATSAPP_PHONE_NUMBER_ID"),
    verifyToken: readEnv("WHATSAPP_VERIFY_TOKEN"),
    webhookSecret: readEnv("WHATSAPP_WEBHOOK_SECRET"),
    defaultCountryCode: readEnv("WHATSAPP_DEFAULT_COUNTRY_CODE") || "55",
  }
}

export function getSupabaseStorageEnv() {
  const enabled = parseBoolean(readEnv("SUPABASE_STORAGE_ENABLED"), false)

  return {
    enabled,
    supabaseUrl: readEnv("SUPABASE_URL"),
    publicSupabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: enabled ? requireEnv("SUPABASE_SERVICE_ROLE_KEY") : readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: enabled ? requireEnv("SUPABASE_STORAGE_BUCKET") : readEnv("SUPABASE_STORAGE_BUCKET"),
  }
}
