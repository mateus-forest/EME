import { UserRole } from "@/lib/prisma-enums"
import { SignJWT, jwtVerify } from "jose"
import { NextResponse } from "next/server"

import { getAuthEnv } from "@/lib/env.server"

const encoder = new TextEncoder()

export const AUTH_COOKIE_NAME = "eme_auth"

type AuthTokenPayload = {
  sub: string
  email: string
  role: UserRole
}

function getAuthSecret() {
  return encoder.encode(getAuthEnv().secret)
}

export async function createAuthToken(payload: AuthTokenPayload) {
  const { sessionMaxAgeSeconds } = getAuthEnv()

  return new SignJWT({
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds}s`)
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
  const { cookieSecure, sessionMaxAgeSeconds } = getAuthEnv()

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  })
}

export function clearAuthCookie(response: NextResponse) {
  const { cookieSecure } = getAuthEnv()

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    expires: new Date(0),
  })
}
