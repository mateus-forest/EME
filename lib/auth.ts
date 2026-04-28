import { UserRole } from "@/lib/prisma-enums"
import {
  SignJWT,
  jwtVerify } from "jose"
import { NextResponse } from "next/server"

const encoder = new TextEncoder()

export const AUTH_COOKIE_NAME = "eme_auth"

type AuthTokenPayload = {
  sub: string
  email: string
  role: UserRole
}

function getAuthSecret() {
  return encoder.encode(process.env.AUTH_SECRET ?? "eme-dev-secret")
}

export async function createAuthToken(payload: AuthTokenPayload) {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
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
    maxAge: 60 * 60 * 24 * 7,
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
