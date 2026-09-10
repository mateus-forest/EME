import { withJourneyRoute } from "@/lib/journey/server"
import { NextResponse } from "next/server"

import { clearAuthCookie } from "@/lib/auth"

export const dynamic = "force-dynamic"

async function handlePOST() {
  const response = NextResponse.json({ success: true })
  response.headers.set("Cache-Control", "no-store, max-age=0")
  clearAuthCookie(response)
  return response
}

export const POST = withJourneyRoute("/api/auth/logout", handlePOST)
