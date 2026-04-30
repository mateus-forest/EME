import { UserRole } from "@/lib/prisma-enums"
import {
  SignJWT,
  jwtVerify } from "jose"
import { NextResponse } from "next/server"

const encoder = new TextEncoder()

export const AUTH_COOKIE_NAME = "eme_auth"
const AUTH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type AuthTokenPayload = {
  sub: string
  email: string
  role: UserRole
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim()

  if (secret) {
    return encoder.encode(secret)
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production.")
  }

  return encoder.encode("eme-dev-secret")
}

export async function createAuthToken(payload: AuthTokenPayload) {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TOKEN_MAX_AGE_SECONDS}s`)
    .sign(getAuthSecret())
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecret())

  return {
    userId: String(payload.sub),
    email: String(payload.email),
    role: payload.role as UserRole,
  }
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_TOKEN_MAX_AGE_SECONDS,
  })
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
}
