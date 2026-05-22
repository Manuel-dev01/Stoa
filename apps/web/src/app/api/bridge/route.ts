import { NextRequest, NextResponse } from 'next/server'
import { bridgeToArc, APP_KIT_CHAINS, type AppKitChain, BridgeTimeoutError } from '@/lib/appkit'

const CHAIN_MAP: Record<string, AppKitChain> = {
  Polygon_Amoy: APP_KIT_CHAINS.polygonAmoy,
  Base_Sepolia: APP_KIT_CHAINS.baseSepolia,
  Arbitrum_Sepolia: APP_KIT_CHAINS.arbitrumSepolia,
  Ethereum_Sepolia: APP_KIT_CHAINS.ethereumSepolia,
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
    const isTimeout = e instanceof BridgeTimeoutError
    return NextResponse.json({ error: message, isTimeout }, { status: isTimeout ? 504 : 502 })
  }
}
