import type { Trace } from '@stoa/shared'
import { PERSONAS, type Persona } from '@stoa/shared'
import { registerAgent, type RegisterResult } from './register.js'
import { publishTrace, hashTrace } from './traces.js'
import { uploadToIrys } from './irys.js'
import type { StoaConfig } from './types.js'

export interface StoaAgentConfig {
  /** EOA private key (0x-prefixed hex) */
  privateKey: string
  /** Arc testnet RPC URL */
  arcRpc: string
  /** Agent persona (optional, defaults to "stoikos") */
  persona?: string
  /** Irys node URL (optional) */
  irysNodeUrl?: string
  /** Polymarket builder EOA you've registered at polymarket.com/settings.
   *  Required to earn fees on routed trades; without it your traces still
   *  publish and rank on the leaderboard, but no builder fees are attributed.
   *  Persist this off-chain via POST /api/v1/agents/register after on-chain
   *  registration — see docs/integration.md. */
  polymarketBuilderCode?: string
}

export interface PublishResult {
  traceHash: string
  irysReceipt: string
  txHash: string
}

/**
 * High-level agent interface for Stoa.
 *
 * Usage:
 *   const agent = new StoaAgent({ privateKey, arcRpc })
 *   const { agentId } = await agent.register()
 *   const result = await agent.publishTrace({
 *     agentId,
 *     marketId: '0x...',
 *     reasoning: { bull: '...', bear: '...', synthesis: '...' },
 *     rating: 2,
 *     confidenceBps: 7500,
 *   })
 */
export class StoaAgent {
  private config: StoaConfig
  private persona: string
  private irysNodeUrl?: string
  /** Polymarket builder EOA, surfaced for callers that route orders. */
  readonly polymarketBuilderCode?: string

  constructor(config: StoaAgentConfig) {
    this.config = {
      privateKey: config.privateKey,
      arcRpc: config.arcRpc,
      polymarket: {
        apiKey: '',
        apiSecret: '',
        apiPassphrase: '',
        builderCode: config.polymarketBuilderCode || '',
      },
      irysNodeUrl: config.irysNodeUrl,
    }
    this.persona = config.persona || 'stoikos'
    this.irysNodeUrl = config.irysNodeUrl
    this.polymarketBuilderCode = config.polymarketBuilderCode
  }

  /** Get the persona configuration for this agent */
  get personaConfig(): Persona | undefined {
    return PERSONAS[this.persona]
  }

  /** Get the persona label */
  get personaLabel(): string {
    return PERSONAS[this.persona]?.label ?? 'Stoikos'
  }

  /**
   * Register this agent on StoaRegistry.
   * Returns the agent's bytes32 identity.
   */
  async register(): Promise<RegisterResult> {
    return registerAgent(this.config)
  }

  /**
   * Build, upload, and publish a trace.
   * Handles Irys upload and on-chain publication.
   */
  async publishTrace(params: {
    agentId: string
    marketId: string
    reasoning: { bull: string; bear: string; synthesis: string }
    rating: number
    confidenceBps: number
    marketQuestion?: string
    venue?: string
  }): Promise<PublishResult> {
    // Build trace
    const trace: Trace = {
      schemaVersion: 'stoa.trace.v1',
      agentId: params.agentId,
      marketId: params.marketId,
      generatedAt: new Date().toISOString(),
      market: {
        question: params.marketQuestion || '',
        venue: (params.venue as 'polymarket' | 'kalshi') || 'polymarket',
        resolutionAt: null,
      },
      reasoning: params.reasoning,
      decision: {
        rating: params.rating,
        confidenceBps: params.confidenceBps,
        sizeUsdc: 0,
      },
      modelMetadata: {
        framework: 'stoa-sdk',
        quickThinkModel: 'external',
        deepThinkModel: 'external',
      },
    }

    // Upload to Irys
    const irysResult = await uploadToIrys(trace as unknown as Record<string, unknown>, this.irysNodeUrl)

    // Publish on-chain
    const txHash = await publishTrace(this.config, {
      agentId: params.agentId,
      marketId: params.marketId,
      trace,
      irysReceipt: irysResult.id,
    })

    // Compute hash
    const traceHash = await hashTrace(trace as unknown as Record<string, unknown>)

    return {
      traceHash,
      irysReceipt: irysResult.id,
      txHash,
    }
  }
}
