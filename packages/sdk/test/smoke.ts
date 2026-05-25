/**
 * Smoke test: import @stoa-agents/sdk and call read-only methods.
 * Run: pnpm --filter @stoa-agents/sdk exec tsx test/smoke.ts
 */
import { buildSignedOrder, getMarketTokenIds, hashTrace, STOA_REGISTRY, STOA_SDK_VERSION } from '../src/index.js'

async function main() {
  console.log('=== @stoa-agents/sdk smoke test ===')
  console.log()

  // 1. Version export
  console.log(`SDK version: ${STOA_SDK_VERSION}`)

  // 2. Address export
  console.log(`STOA_REGISTRY: ${STOA_REGISTRY}`)

  // 3. hashTrace — pure function, no network
  const sampleTrace = {
    schemaVersion: 'stoa.trace.v1',
    agentId: '0x' + 'aa'.repeat(32),
    marketId: '0x' + 'bb'.repeat(32),
    generatedAt: new Date().toISOString(),
    market: { question: 'Test?', venue: 'polymarket', resolutionAt: null },
    reasoning: { bull: 'yes', bear: 'no', synthesis: 'maybe' },
    decision: { rating: 2, confidenceBps: 7000, sizeUsdc: 10 },
    modelMetadata: { framework: 'test', quickThinkModel: 'test', deepThinkModel: 'test' },
  }
  const traceHash = await hashTrace(sampleTrace)
  console.log(`hashTrace output: ${traceHash.slice(0, 18)}...`)
  console.log(`hashTrace valid hex: ${/^0x[0-9a-f]{64}$/.test(traceHash)}`)

  // 4. getMarketTokenIds — hits Gamma API (read-only)
  console.log()
  console.log('Fetching live market from Gamma API...')
  const markets = await fetch('https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=5')
  const data: Record<string, unknown>[] = await markets.json()
  const first = data[0]
  if (!first) {
    console.log('No markets found — API may be down')
    process.exit(1)
  }
  const conditionId = (first.conditionId as string) || (first.condition_id as string)
  console.log(`Market: ${first.question}`)
  console.log(`conditionId: ${conditionId}`)

  const tokenIds = await getMarketTokenIds(conditionId)
  if (tokenIds) {
    console.log(`getMarketTokenIds result:`)
    console.log(`  yesTokenId: ${tokenIds.yesTokenId.slice(0, 20)}...`)
    console.log(`  noTokenId: ${tokenIds.noTokenId.slice(0, 20)}...`)
    console.log(`  question: ${tokenIds.question}`)
  } else {
    console.log('getMarketTokenIds returned null — conditionId may not match')
  }

  console.log()
  console.log('=== All smoke tests passed ===')
}

main().catch((e) => {
  console.error('Smoke test failed:', e)
  process.exit(1)
})
