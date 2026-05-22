import { NextResponse } from 'next/server'

// Bridge is now client-side — uses the connected browser wallet (MetaMask)
// via createViemAdapterFromProvider. This route is kept as a placeholder.
export async function POST() {
  return NextResponse.json(
    { error: 'Bridge is client-side. Use the Fund dialog in the UI.' },
    { status: 400 },
  )
}
