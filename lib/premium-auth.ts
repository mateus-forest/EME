import { createHash, randomBytes } from "node:crypto"

import { SignJWT, jwtVerify } from "jose"
import { type NextRequest, NextResponse } from "next/server"

import { getAuthEnv } from "@/lib/env.server"

const encoder = new TextEncoder()

export const TRUSTED_DEVICE_COOKIE_NAME = "eme_trusted_device"
export const WEBAUTHN_ACTION_COOKIE_NAME = "eme_webauthn_action"
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180
export const WEBAUTHN_ACTION_MAX_AGE_SECONDS = 60 * 5

type WebAuthnActionPayload = {
  purpose: "registration" | "authentication"
  challenge: string
  userId?: string
  deviceId?: string
}

function getAuthSecret() {
  return encoder.encode(getAuthEnv().secret)
}

export function createTrustedDeviceToken() {
  return randomBytes(32).toString("base64url")
}

export function hashTrustedDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function readTrustedDeviceToken(request: NextRequest) {
  return request.cookies.get(TRUSTED_DEVICE_COOKIE_NAME)?.value ?? null
}

export function setTrustedDeviceCookie(response: NextResponse, token: string) {
  response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthEnv().cookieSecure,
    path: "/",
    maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
  })
}

export function clearTrustedDeviceCookie(response: NextResponse) {
  response.cookies.set(TRUSTED_DEVICE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthEnv().cookieSecure,
    path: "/",
    expires: new Date(0),
  })
}

export async function createWebAuthnActionToken(payload: WebAuthnActionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${WEBAUTHN_ACTION_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret())
}

export async function verifyWebAuthnActionToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecret())

  return {
    purpose: payload.purpose as WebAuthnActionPayload["purpose"],
    challenge: String(payload.challenge),
    userId: typeof payload.userId === "string" ? payload.userId : undefined,
    deviceId: typeof payload.deviceId === "string" ? payload.deviceId : undefined,
  }
}

export async function setWebAuthnActionCookie(response: NextResponse, payload: WebAuthnActionPayload) {
  const token = await createWebAuthnActionToken(payload)

  response.cookies.set(WEBAUTHN_ACTION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthEnv().cookieSecure,
    path: "/",
    maxAge: WEBAUTHN_ACTION_MAX_AGE_SECONDS,
  })
}

export function clearWebAuthnActionCookie(response: NextResponse) {
  response.cookies.set(WEBAUTHN_ACTION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: getAuthEnv().cookieSecure,
    path: "/",
    expires: new Date(0),
  })
}

export function getRpIdFromHost(host: string) {
  return host.replace(/:\d+$/, "")
}

export function getOriginFromRequest(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? "http"
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000"
  return `${proto}://${host}`
}

export function describeUserAgent(userAgent: string | null | undefined) {
  const ua = (userAgent ?? "").toLowerCase()

  let platform = "Dispositivo"
  if (ua.includes("iphone")) platform = "iPhone"
  else if (ua.includes("ipad")) platform = "iPad"
  else if (ua.includes("android")) platform = "Android"
  else if (ua.includes("windows")) platform = "Windows"
  else if (ua.includes("mac os x") || ua.includes("macintosh")) platform = "Mac"
  else if (ua.includes("linux")) platform = "Linux"

  let browser = "Navegador"
  if (ua.includes("edg/")) browser = "Edge"
  else if (ua.includes("chrome/")) browser = "Chrome"
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari"
  else if (ua.includes("firefox/")) browser = "Firefox"

  return {
    platform,
    browser,
    label: `${browser} em ${platform}`,
  }
}
