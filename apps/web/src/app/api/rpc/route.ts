import { NextRequest, NextResponse } from "next/server"

// Read the RPC URL inside the handler, not at module load. A top-level throw
// makes the route's bundle un-importable during `next build` page-data
// collection (where runtime env may be absent) and fails the whole build.
export async function POST(req: NextRequest) {
  const RPC_URL = process.env.ARC_RPC_URL || process.env.NEXT_PUBLIC_ARC_RPC
  if (!RPC_URL) {
    return NextResponse.json(
      { error: "ARC_RPC_URL or NEXT_PUBLIC_ARC_RPC must be set" },
      { status: 500 }
    )
  }
  const body = await req.json()
  const resp = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}
