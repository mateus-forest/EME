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

function requireFirstEnv(names: string[]) {
  for (const name of names) {
    const value = readEnv(name)
    if (value) return value
  }

  throw new Error(`${names.join(" ou ")} precisa estar configurada no ambiente.`)
}

export function getRequiredRuntimeEnv() {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    authSecret: requireFirstEnv(["AUTH_SECRET", "NEXTAUTH_SECRET"]),
    appUrl: requireEnv("NEXT_PUBLIC_APP_URL"),
  }
}

export function getAuthEnv() {
  const sessionMaxAgeDays = parsePositiveInteger(readEnv("SESSION_MAX_AGE_DAYS"), 30)
  const secureAuto = parseBoolean(readEnv("COOKIE_SECURE_AUTO"), true)

  return {
    secret: requireFirstEnv(["AUTH_SECRET", "NEXTAUTH_SECRET"]),
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
    proPriceId: readEnv("STRIPE_PRICE_PRO"),
    scalePriceId: readEnv("STRIPE_PRICE_SCALE"),
    credit250PriceId: readEnv("STRIPE_PRICE_CREDITS_250"),
    credit750PriceId: readEnv("STRIPE_PRICE_CREDITS_750"),
    credit1500PriceId: readEnv("STRIPE_PRICE_CREDITS_1500"),
    credit3000PriceId: readEnv("STRIPE_PRICE_CREDITS_3000"),
    property50PriceId: readEnv("STRIPE_PRICE_PROPERTIES_50"),
    property100PriceId: readEnv("STRIPE_PRICE_PROPERTIES_100"),
    property200PriceId: readEnv("STRIPE_PRICE_PROPERTIES_200"),
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

export function getPedraEnv() {
  const apiKey = process.env.PEDRA_API_KEY?.trim() ?? ""

  return { apiKey }
}

export function getXAIEnv() {
  return {
    apiKey: readEnv("XAI_API_KEY"),
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
