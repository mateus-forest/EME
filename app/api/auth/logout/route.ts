import { NextResponse } from "next/server"

import { clearAuthCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  clearAuthCookie(response)
  return response
}
