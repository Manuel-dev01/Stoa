import { NextRequest, NextResponse } from "next/server"

const RPC_URL = process.env.ARC_RPC_URL || process.env.NEXT_PUBLIC_ARC_RPC
if (!RPC_URL) {
  throw new Error("ARC_RPC_URL or NEXT_PUBLIC_ARC_RPC must be set")
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const resp = await fetch(RPC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await resp.json()
  return NextResponse.json(data, { status: resp.status })
}
