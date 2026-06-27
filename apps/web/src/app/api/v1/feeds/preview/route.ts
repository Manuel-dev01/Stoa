/**
 * Ungated preview of the macro-alpha feed: the latest 3 synthesized items,
 * structured fields + verifiable hashes only (no prose — that stays behind the
 * 402 at /api/v1/feeds/macro-alpha). Powers the homepage showroom and the App
 * Flow film strip, and is a free taste a bot can poll before paying the toll.
 */
import { NextResponse } from "next/server"
import { getPreviewItems } from "@/lib/preview"

export const dynamic = "force-dynamic"

export async function GET() {
  const items = await getPreviewItems(3)
  return NextResponse.json(
    { items },
    { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=60" } }
  )
}
