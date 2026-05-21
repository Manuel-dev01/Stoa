import { NextRequest, NextResponse } from 'next/server'
import { bridgeToArc, APP_KIT_CHAINS, type AppKitChain } from '@/lib/appkit'

const CHAIN_MAP: Record<string, AppKitChain> = {
  Polygon: APP_KIT_CHAINS.polygon,
  Base: APP_KIT_CHAINS.base,
  Arbitrum: APP_KIT_CHAINS.arbitrum,
  Ethereum: APP_KIT_CHAINS.ethereum,
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { fromChain, amount } = body

  if (!fromChain || !amount) {
    return NextResponse.json({ error: 'fromChain and amount required' }, { status: 400 })
  }

  const mappedChain = CHAIN_MAP[fromChain]
  if (!mappedChain) {
    return NextResponse.json({ error: `Unsupported chain: ${fromChain}` }, { status: 400 })
  }

  const privateKey = process.env.POLYMARKET_PRIVATE_KEY
  if (!privateKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const result = await bridgeToArc({ fromChain: mappedChain, amount: String(amount) }, privateKey)
    return NextResponse.json({ success: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bridge failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
